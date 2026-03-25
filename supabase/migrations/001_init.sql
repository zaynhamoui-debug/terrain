-- ============================================================
-- TERRAIN — Initial Schema
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_maps (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query       TEXT        NOT NULL,
  map_data    JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS map_notes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id   TEXT        NOT NULL,
  map_id       UUID        REFERENCES saved_maps(id) ON DELETE CASCADE,
  note         TEXT        NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, company_id, map_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_maps_user_id ON saved_maps(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_maps_created  ON saved_maps(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_map_notes_user_id   ON map_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_map_notes_lookup    ON map_notes(user_id, company_id, map_id);

-- RLS
ALTER TABLE saved_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_notes  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_maps: all own"
  ON saved_maps FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "map_notes: all own"
  ON map_notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
