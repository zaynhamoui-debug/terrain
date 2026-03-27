/**
 * Import Clay CSV into Supabase clay_companies table.
 * Usage: node scripts/import-clay.mjs /path/to/file.csv
 */
import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse'
import { createReadStream } from 'fs'
import { config } from 'dotenv'

config()

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY
const CSV_PATH          = process.argv[2]
const BATCH_SIZE        = 200

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}
if (!CSV_PATH) {
  console.error('Usage: node scripts/import-clay.mjs /path/to/file.csv')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function normalizeHeadcount(raw) {
  if (!raw) return null
  return raw.replace(/\s*employees?/i, '').replace(/,/g, '').trim()
}

function extractLinkedin(url) {
  if (!url) return null
  const m = url.match(/linkedin\.com\/(company\/[^/?#]+)/i)
  return m ? m[1] : null
}

function truncate(str, max = 500) {
  if (!str) return null
  return str.length > max ? str.slice(0, max) + '…' : str
}

async function run() {
  const rows = []

  await new Promise((resolve, reject) => {
    createReadStream(CSV_PATH)
      .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true, trim: true }))
      .on('data', row => {
        // CSV columns: (unnamed), Name, Description, Primary Industry, Size, Type, Location, Country, Domain, LinkedIn URL
        const name = row['Name']?.trim()
        if (!name) return

        rows.push({
          name,
          description: truncate(row['Description']),
          industry:    row['Primary Industry']?.trim() || null,
          headcount:   normalizeHeadcount(row['Size']),
          location:    row['Location']?.trim() || null,
          country:     row['Country']?.trim() || null,
          website:     row['Domain']?.trim() || null,
          linkedin:    extractLinkedin(row['LinkedIn URL']),
        })
      })
      .on('end', resolve)
      .on('error', reject)
  })

  console.log(`Parsed ${rows.length} companies. Importing in batches of ${BATCH_SIZE}…`)

  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('clay_companies').upsert(batch, { onConflict: 'name', ignoreDuplicates: true })
    if (error) {
      console.error(`Batch ${i}–${i + BATCH_SIZE} failed:`, error.message)
    } else {
      inserted += batch.length
      process.stdout.write(`\r${inserted}/${rows.length} processed…`)
    }
  }

  console.log(`\nDone. ${inserted} companies imported.`)
}

run().catch(err => { console.error(err); process.exit(1) })
