# Altus Index

A personalized economic opportunity map of the United States. Helps young people
decide where to move to build wealth, scored against their personal profile
(age, career, salary goal, risk tolerance, remote/in-office, ownership plans).

Built with Next.js 15 + MapLibre GL + Tailwind, deployed as a static export to
Cloudflare Pages.

---

## Quick start

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local and set NEXT_PUBLIC_MAPTILER_KEY
npm run dev
```

Open http://localhost:3000.

The repo ships with curated estimates for ~50 representative counties
(`data/counties_generated.json`) so the app works without running the pipeline.

---

## Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `NEXT_PUBLIC_MAPTILER_KEY` | Next.js (client) | MapTiler "Darkmatter" basemap tiles. Get one free at https://www.maptiler.com/cloud/ |
| `CENSUS_API_KEY` | Python pipeline | Census ACS API key. Free at https://api.census.gov/data/key_signup.html |
| `BLS_API_KEY` *(optional)* | Python pipeline | BLS registration key — only needed for higher rate limits |

---

## Data pipeline

The pipeline pulls fresh data from authoritative US government sources, scores
each county on five dimensions, and writes a JSON file that the Next.js app
imports directly.

### Sources

- **US Census Bureau ACS 5-year** — median income, home value, rent,
  education, poverty, population, age.
- **Opportunity Atlas (Chetty et al.)** — tract-level economic mobility,
  aggregated to county.

Unemployment is derived directly from ACS (`B23025_005E / B23025_003E`); the
optional BLS LAUS fetcher remains in the repo but is no longer part of the
default pipeline (its public-tier API is unreliable for large pulls).

### Run it

```bash
# 1. Install Python deps
pip install -r scripts/requirements.txt

# 2. Set your Census key
export CENSUS_API_KEY=your_key_here

# 3. Fetch each source (each writes to data/raw/)
python3 scripts/fetch_census.py        # ~1 minute, 50 state requests
python3 scripts/fetch_opportunity.py   # downloads a ~150 MB CSV once, then aggregates

# 4. Build the final county DB consumed by the Next.js app
python3 scripts/build_database.py

# 5. Restart the dev server to pick up the new data
npm run dev
```

`scripts/build_database.py` writes:

- `data/counties_generated.json` — every US county that has Census data
  (~3,143 counties) with full dimension scores and metadata. Imported
  directly by `lib/data/counties.ts`.
- `data/unmatched_counties.log` — FIPS of counties missing data, for QA.

Counties whose scores derive from real Census/BLS/Opportunity Atlas data
are tagged `dataQuality: "real"`; ones using proxies are tagged
`"estimated"`. The county detail card shows a small badge for each.

---

## Scoring methodology

Each county is scored 0–100 on five dimensions:

| Dimension | Source | Formula |
|---|---|---|
| Income Growth | ACS B19013 + B15003 | normalize $20k–$150k, +0–10 for bachelor's % |
| Economic Mobility | Opportunity Atlas (or poverty proxy) | percentile of `kfr_pooled_pooled_p25` |
| Housing Affordability | ACS B25077 / B19013 | `max(0, 100 − (price/income − 2) × 12.5)` |
| Employment | BLS LAUS | 2% unemp = 100, 12% = 0 (linear) |
| Cost of Living | ACS B25064 (median rent) | $600 = 100, $3000 = 0 (linear) |

Composite score uses career-specific weights, personalized for age,
remote-work plans, risk tolerance, and home ownership goals. See
`/methodology` in-app for the full breakdown.

---

## Cloudflare Pages deployment

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `out` |
| `NODE_VERSION` env var | `20` |
| `NEXT_PUBLIC_MAPTILER_KEY` env var | your MapTiler key |

The pipeline runs locally (not in CI). Commit the updated
`data/counties_generated.json` to refresh production scores.

---

## Project layout

```
app/                  Next.js App Router pages
components/           UI components (Map, SearchPanel, ResultsSidebar, CountyDetail)
lib/
  data/               Types + counties.ts (imports from data/counties_generated.json)
  scoringEngine.ts    Weighted scoring + 10-year projection
  format.ts           Currency / percent helpers
scripts/              Python data pipeline
data/
  raw/                Raw fetched data (census_data.json, bls_data.json, opportunity_data.json)
  counties_generated.json   Final database consumed by the app
```
