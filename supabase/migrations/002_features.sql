-- Watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id   TEXT        NOT NULL,
  company_data JSONB       NOT NULL,
  sector       TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlist: all own" ON watchlist FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add is_public to saved_maps
ALTER TABLE saved_maps ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

-- Update saved_maps RLS to allow public reads
DROP POLICY IF EXISTS "saved_maps: all own" ON saved_maps;
CREATE POLICY "saved_maps: select own or public" ON saved_maps FOR SELECT USING (auth.uid() = user_id OR is_public = TRUE);
CREATE POLICY "saved_maps: insert own"           ON saved_maps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_maps: update own"           ON saved_maps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "saved_maps: delete own"           ON saved_maps FOR DELETE USING (auth.uid() = user_id);
