insert into public.prospecting_scoring_configs (version, is_active, config, rubric_markdown)
values (
  'heuristic-v1',
  true,
  '{
    "version": "heuristic-v1",
    "harmonic_saved_searches": [
      {
        "id": 172255,
        "name": "Mucker Prospecting v1 - Daily Discovery",
        "purpose": "Broad early-stage discovery funnel for Mucker-fit software companies."
      },
      {
        "id": 172257,
        "name": "Mucker Prospecting v1 - Signals",
        "purpose": "Signal-heavy saved search emphasizing growth, funding timing, and quiet momentum."
      }
    ],
    "formula": {
      "combined_score": "(mqs * mus) / 100"
    },
    "thresholds": {
      "strong_pick": 70,
      "pick": 55,
      "watch": 45,
      "min_mqs": 50,
      "min_mus": 50
    },
    "mqs_weights": {
      "stage_fit": 0.15,
      "team_size_fit": 0.08,
      "founder_domain_operator": 0.12,
      "founder_technical_present": 0.08,
      "headcount_growth_qoq": 0.05,
      "recent_key_hire": 0.06,
      "fundraise_window_fit": 0.08,
      "software_driven": 0.08,
      "gross_margin_proxy": 0.02,
      "capital_efficiency_signal": 0.07,
      "product_live": 0.06,
      "icp_clarity": 0.05,
      "defensibility_hint": 0.05,
      "geographic_tam_breadth": 0.05
    },
    "mus_penalties": [
      "tier1_vc_on_captable",
      "hq_in_hot_geo",
      "funding_velocity_too_high",
      "hype_vertical_match",
      "competitor_density",
      "press_volume",
      "yc_or_accelerator",
      "well_funded_direct_competitor"
    ],
    "mus_rewards": [
      "quiet_builder",
      "non_obvious_geo",
      "boring_vertical",
      "operator_founder",
      "los_angeles_or_mucker_network_relevance"
    ]
  }'::jsonb,
  'See scoring/mucker-rubric-v1.md in this package.'
)
on conflict (version) do update
set is_active = excluded.is_active,
    config = excluded.config,
    rubric_markdown = excluded.rubric_markdown;

