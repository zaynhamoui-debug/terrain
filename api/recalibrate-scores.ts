import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const RECALIBRATE_THRESHOLD = 100   // First trigger
const RECALIBRATE_STEP      = 50    // Every 50 after that

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth guard — accepts either CRON_SECRET header or ?force=1 from the client
  const secret   = req.headers['x-cron-secret'] ?? req.headers.authorization?.replace('Bearer ', '')
  const isForced = req.query.force === '1'

  if (!isForced && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // ── 1. Pull all feedback with labels ──────────────────────────────────────
    const { data: feedbackRows, error: fbErr } = await supabase
      .from('prospecting_feedback')
      .select(`
        id, label,
        daily_pick_id,
        daily_picks (
          company_id,
          prospecting_candidates ( mqs, mus, combined_score, scoring_breakdown )
        )
      `)
      .not('label', 'is', null)

    if (fbErr) throw fbErr

    const totalCount = feedbackRows?.length ?? 0

    // ── 2. Check if we've hit a threshold (unless forced) ────────────────────
    if (!isForced) {
      const shouldRun = totalCount >= RECALIBRATE_THRESHOLD &&
        (totalCount - RECALIBRATE_THRESHOLD) % RECALIBRATE_STEP === 0
      if (!shouldRun) {
        return res.status(200).json({
          skipped: true,
          reason: `Threshold not reached — ${totalCount} feedback rows`,
        })
      }
    }

    // ── 3. Load active scoring config ────────────────────────────────────────
    const { data: configRow } = await supabase
      .from('prospecting_scoring_configs')
      .select('version, config')
      .eq('is_active', true)
      .single()

    const prevVersion   = configRow?.version ?? 'heuristic-v1'
    const currentConfig = (configRow?.config ?? {}) as Record<string, unknown>
    const currentWeights = (currentConfig.mqs_weights ?? {}) as Record<string, number>

    // ── 4. Compute feature correlations ──────────────────────────────────────
    const positiveLabels = new Set(['like', 'intro_requested'])
    const negativeLabels = new Set(['not_relevant', 'too_late', 'dislike'])

    type FeedbackRow = {
      label: string
      daily_picks: {
        prospecting_candidates: {
          scoring_breakdown: Record<string, number>
        } | null
      } | null
    }

    const rows = (feedbackRows ?? []) as unknown as FeedbackRow[]

    const featureTotals: Record<string, { positive: number; total: number }> = {}

    for (const row of rows) {
      const isPositive = positiveLabels.has(row.label)
      const isNegative = negativeLabels.has(row.label)
      if (!isPositive && !isNegative) continue

      const breakdown = row.daily_picks?.prospecting_candidates?.scoring_breakdown ?? {}
      for (const [feature, rawVal] of Object.entries(breakdown)) {
        const val = Number(rawVal)
        if (!Number.isFinite(val)) continue
        if (!featureTotals[feature]) featureTotals[feature] = { positive: 0, total: 0 }
        featureTotals[feature].total += 1
        if (isPositive) featureTotals[feature].positive += 1
      }
    }

    // ── 5. Compute new weights ────────────────────────────────────────────────
    const newWeights: Record<string, number> = { ...currentWeights }
    const weightChanges: Record<string, { old: number; new: number }> = {}

    const originalSum = Object.values(currentWeights).reduce((a, b) => a + b, 0) || 1

    for (const feature of Object.keys(currentWeights)) {
      const stats = featureTotals[feature]
      if (!stats || stats.total < 5) continue   // not enough signal

      const positiveRate = stats.positive / stats.total

      // Shift weight toward/away from features correlated with positive outcomes
      // Baseline positive rate: 0.5 (neutral). Scale ±25%
      const nudge = (positiveRate - 0.5) * 0.5   // [-0.25, +0.25]
      const oldW  = currentWeights[feature]
      const newW  = Math.max(0.01, Math.min(0.30, oldW * (1 + nudge)))

      if (Math.abs(newW - oldW) > 0.001) {
        newWeights[feature] = newW
        weightChanges[feature] = { old: oldW, new: newW }
      }
    }

    // ── 6. Normalise to preserve original total weight ────────────────────────
    const newSum = Object.values(newWeights).reduce((a, b) => a + b, 0)
    if (newSum > 0) {
      const scale = originalSum / newSum
      for (const k of Object.keys(newWeights)) {
        newWeights[k] = Math.round(newWeights[k] * scale * 1000) / 1000
      }
    }

    // ── 7. Write new config version ──────────────────────────────────────────
    const recalibCount = Math.floor((totalCount - RECALIBRATE_THRESHOLD) / RECALIBRATE_STEP) + 1
    const newVersion   = `feedback-v${recalibCount}`

    const newConfig = {
      ...currentConfig,
      mqs_weights: newWeights,
      version: newVersion,
    }

    // Deactivate previous active config
    await supabase
      .from('prospecting_scoring_configs')
      .update({ is_active: false })
      .eq('is_active', true)

    await supabase.from('prospecting_scoring_configs').upsert({
      version:         newVersion,
      is_active:       true,
      config:          newConfig,
      rubric_markdown: `Auto-recalibrated from ${totalCount} feedback rows on ${new Date().toISOString().slice(0, 10)}.`,
    })

    // ── 8. Log to scoring_recalibration_log ──────────────────────────────────
    await supabase.from('scoring_recalibration_log').insert({
      feedback_count:   totalCount,
      previous_version: prevVersion,
      new_version:      newVersion,
      weight_changes:   weightChanges,
    })

    return res.status(200).json({
      ok:               true,
      previousVersion:  prevVersion,
      newVersion,
      feedbackCount:    totalCount,
      featuresAdjusted: Object.keys(weightChanges).length,
    })
  } catch (err) {
    console.error('[recalibrate-scores]', err)
    return res.status(500).json({ error: String(err) })
  }
}
