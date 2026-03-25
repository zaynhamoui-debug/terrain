# TERRAIN — Market Intelligence

AI-powered competitive market maps. Enter a sector or company, get a structured landscape of players, funding, white spaces, and momentum signals.

## Stack
- React + Vite + TypeScript
- Tailwind CSS (Playfair Display + DM Mono)
- Supabase (auth + Postgres)
- Claude API with web search

---

## Setup

### 1. Install
```bash
git clone <repo>
cd terrain
npm install
```

### 2. Environment variables
```bash
cp .env.example .env
```

Fill in `.env`:
| Variable | Where |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon key |
| `VITE_ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |

### 3. Database
Run `supabase/migrations/001_init.sql` in Supabase → SQL Editor.

### 4. Run
```bash
npm run dev
```

Open http://localhost:5173

---

## Features
- **Market map generator** — Claude researches real companies with web search
- **Segment filter tabs** — filter view by market segment
- **Company detail modal** — full profile, investors, customers
- **Per-company notes** — saved to Supabase, persist across sessions
- **Recent maps** — auto-saved, reload any previous map
- **Auth** — email/password via Supabase, all routes protected

## Database Schema
```
saved_maps:  id, user_id, query, map_data (jsonb), created_at
map_notes:   id, user_id, company_id, map_id, note, updated_at
             UNIQUE(user_id, company_id, map_id)
```
RLS enabled — users access only their own data.
