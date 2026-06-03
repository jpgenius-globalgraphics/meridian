"""
Merge fetched Census + Opportunity Atlas data and emit the final county
database consumed by the Next.js app.

Inputs (run the other fetch_*.py scripts first):
  data/raw/census_data.json        (required)
  data/raw/opportunity_data.json   (optional — poverty-rate proxy used if missing)

Output:
  data/counties_generated.json   — final county objects in CountyData shape
  data/unmatched_counties.log    — fips with missing data, one per line

Unemployment comes directly from the Census ACS-derived rate
(B23025_005E unemployed / B23025_003E labor force) — BLS is not used because
its public API is unreliable for large county-batched pulls.

We keep only the top 800 counties by population (covers ~85% of US population)
and compute the 5 dimension scores (0-100) and a composite matchScore. Lat/lng
centroids come from the Census 2023 county Gazetteer file (auto-downloaded).
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
OUT_PATH = ROOT / "data" / "counties_generated.json"
UNMATCHED_LOG = ROOT / "data" / "unmatched_counties.log"

CENSUS_PATH = RAW_DIR / "census_data.json"
OPP_PATH = RAW_DIR / "opportunity_data.json"

# Census Gazetteer 2023 — county-level centroids and state codes.
GAZETTEER_URL = (
    "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/"
    "2023_Gaz_counties_national.zip"
)
GAZETTEER_PATH = RAW_DIR / "2023_Gaz_counties_national.txt"

# State FIPS → 2-letter postal code
STATE_ABBR = {
    "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE",
    "11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA",
    "20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN",
    "28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM",
    "36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI",
    "45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA",
    "54":"WV","55":"WI","56":"WY",
}


def ensure_gazetteer() -> pd.DataFrame:
    """Download and parse the Census county Gazetteer file for centroid lat/lng."""
    if not GAZETTEER_PATH.exists():
        import io, zipfile
        print(f"Downloading Census Gazetteer county file...")
        r = requests.get(GAZETTEER_URL, timeout=120)
        r.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            inner = next(n for n in zf.namelist() if n.endswith(".txt"))
            GAZETTEER_PATH.write_bytes(zf.read(inner))
    df = pd.read_csv(GAZETTEER_PATH, sep="\t", dtype={"GEOID": str})
    df.columns = [c.strip() for c in df.columns]
    # The Gazetteer file has columns: USPS, GEOID, ANSICODE, NAME, ALAND, AWATER,
    # ALAND_SQMI, AWATER_SQMI, INTPTLAT, INTPTLONG
    df = df.rename(columns={"USPS": "state_abbr", "GEOID": "fips",
                            "NAME": "county_name",
                            "INTPTLAT": "lat", "INTPTLONG": "lng"})
    df["fips"] = df["fips"].str.zfill(5)
    return df[["fips", "county_name", "state_abbr", "lat", "lng"]]


def load_inputs() -> tuple[dict, dict]:
    if not CENSUS_PATH.exists():
        raise SystemExit("Run fetch_census.py first")
    census = json.loads(CENSUS_PATH.read_text())
    opp = json.loads(OPP_PATH.read_text()) if OPP_PATH.exists() else {}
    return census, opp


# ─── Dimension scoring ───────────────────────────────────────────────────────

def income_score(median_income: float | None, bachelors_rate: float | None) -> float:
    """Normalize $20k → 0, $150k → 100, then add small bump for educated counties."""
    if median_income is None:
        return 50.0
    base = (median_income - 20000) / (150000 - 20000) * 100
    base = max(0.0, min(100.0, base))
    if bachelors_rate is not None:
        # +0..10 points scaled with bachelor's rate (0–60%+ range)
        base += min(10.0, bachelors_rate / 6.0)
    return min(100.0, base)


def mobility_score(mobility_p25: float | None, all_p25: list[float],
                   poverty_rate: float | None) -> tuple[float, bool]:
    """Return (score, used_real). Use Opportunity Atlas percentile if available."""
    if mobility_p25 is not None and len(all_p25) > 0:
        arr = np.array(all_p25)
        pct = float((arr < mobility_p25).mean()) * 100
        return max(0.0, min(100.0, pct)), True
    # Proxy: invert poverty rate. 0% poverty → 100, 30%+ poverty → 0.
    if poverty_rate is not None:
        return max(0.0, min(100.0, 100 - (poverty_rate / 30.0 * 100))), False
    return 50.0, False


def housing_score(median_home: float | None, median_income: float | None) -> float:
    """Price-to-income ratio: 2.0 → 100, 10+ → 0. Linear."""
    if not median_home or not median_income or median_income <= 0:
        return 50.0
    ratio = median_home / median_income
    score = 100 - ((ratio - 2.0) * 12.5)
    return max(0.0, min(100.0, score))


def employment_score(unemployment_rate: float | None) -> float:
    """2% → 100, 12% → 0. Linear."""
    if unemployment_rate is None:
        return 50.0
    score = 100 - ((unemployment_rate - 2.0) * 10.0)
    return max(0.0, min(100.0, score))


def col_score(median_rent: float | None) -> float:
    """$600 → 100, $3000+ → 0. Linear."""
    if median_rent is None:
        return 50.0
    score = 100 - ((median_rent - 600) / (3000 - 600) * 100)
    return max(0.0, min(100.0, score))


def composite_score(scores: dict[str, float]) -> float:
    """Default-weighted composite: income 25 / mobility 25 / housing 20 / employment 20 / COL 10."""
    return (
        scores["incomeGrowthScore"] * 0.25 +
        scores["mobilityScore"] * 0.25 +
        scores["housingScore"] * 0.20 +
        scores["employmentScore"] * 0.20 +
        scores["costOfLivingScore"] * 0.10
    )


# ─── Why descriptions ────────────────────────────────────────────────────────

def why_description(name: str, state: str, scores: dict[str, float],
                    median_income: float | None,
                    median_home: float | None) -> str:
    """Generate 2–3 sentence narrative based on top/bottom dimensions."""
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    top1, top2 = ranked[0], ranked[1]
    bottom = ranked[-1]

    label = {
        "incomeGrowthScore": "strong income levels",
        "mobilityScore": "high economic mobility",
        "housingScore": "affordable housing",
        "employmentScore": "robust job market",
        "costOfLivingScore": "low cost of living",
    }
    weak = {
        "incomeGrowthScore": "wages lag national peers",
        "mobilityScore": "economic mobility is limited",
        "housingScore": "housing affordability is strained",
        "employmentScore": "unemployment runs above average",
        "costOfLivingScore": "everyday costs are elevated",
    }

    s1 = f"{name} County, {state} stands out for {label[top1[0]]} and {label[top2[0]]}."
    s2 = f"On the other side, {weak[bottom[0]]}."
    s3 = ""
    if median_income and median_home:
        ratio = median_home / median_income
        if ratio < 4:
            s3 = f" Income-to-home-price ratio is favorable here ({ratio:.1f}x)."
        elif ratio > 7:
            s3 = f" Home prices run {ratio:.1f}x local income — a meaningful headwind."
    return f"{s1} {s2}{s3}".strip()


# ─── Main ────────────────────────────────────────────────────────────────────

def main() -> int:
    census, opp = load_inputs()
    print(f"Loaded census={len(census)}, opportunity={len(opp)}")

    # Gazetteer for lat/lng + state abbreviation
    try:
        gaz = ensure_gazetteer()
        gaz_by_fips = {r.fips: r for r in gaz.itertuples()}
    except Exception as e:
        print(f"WARNING: Gazetteer unavailable ({e}); centroids will be 0,0.", file=sys.stderr)
        gaz_by_fips = {}

    # Include every county that has Census data.
    selected_fips = {fips for fips, rec in census.items() if rec.get("population") is not None}
    print(f"Scoring {len(selected_fips)} counties")

    # All mobility values (for percentile normalization)
    all_p25 = [v["mobility_p25"] for v in opp.values() if "mobility_p25" in v]

    out: list[dict[str, Any]] = []
    unmatched: list[str] = []

    for fips in selected_fips:
        rec = census[fips]
        opp_rec = opp.get(fips, {})

        # Unemployment derived from ACS (B23025_005E / B23025_003E)
        unemp = rec.get("unemployment_rate")

        median_income = rec.get("median_income")
        median_home = rec.get("median_home_value")
        median_rent = rec.get("median_rent")
        bachelors = rec.get("bachelors_rate")
        poverty = rec.get("poverty_rate")
        pop = rec.get("population") or 0

        scores: dict[str, float] = {}
        scores["incomeGrowthScore"] = income_score(median_income, bachelors)
        mob_score, mob_real = mobility_score(opp_rec.get("mobility_p25"), all_p25, poverty)
        scores["mobilityScore"] = mob_score
        scores["housingScore"] = housing_score(median_home, median_income)
        scores["employmentScore"] = employment_score(unemp)
        scores["costOfLivingScore"] = col_score(median_rent)

        # Round all scores to ints for cleaner display
        scores = {k: round(v) for k, v in scores.items()}

        # Lat/lng + state abbr from Gazetteer
        gaz_rec = gaz_by_fips.get(fips)
        if gaz_rec:
            lat = float(gaz_rec.lat)
            lng = float(gaz_rec.lng)
            state_abbr = gaz_rec.state_abbr
            county_name = gaz_rec.county_name.replace(" County", "").replace(" Parish", "")
        else:
            lat, lng = 0.0, 0.0
            state_abbr = STATE_ABBR.get(fips[:2], "")
            raw_name = rec.get("name_raw", "")
            county_name = raw_name.split(",")[0].replace(" County", "").replace(" Parish", "")
            if not county_name:
                unmatched.append(f"{fips}: no gazetteer match")

        # Skip counties missing critical signals entirely
        critical_missing = (median_income is None and median_home is None and unemp is None)
        if critical_missing:
            unmatched.append(f"{fips}: missing income/home/unemployment")
            continue

        data_quality = "real" if (median_income and median_home and unemp is not None) else "estimated"

        out.append({
            "fips": fips,
            "name": county_name or "Unknown",
            "state": state_abbr,
            "lat": round(lat, 4),
            "lng": round(lng, 4),
            "population": int(pop),
            "medianIncome": int(median_income or 0),
            "medianHomePrice": int(median_home or 0),
            "unemploymentRate": float(round(unemp, 2)) if unemp is not None else 0.0,
            "incomeGrowthScore": scores["incomeGrowthScore"],
            "mobilityScore": scores["mobilityScore"],
            "housingScore": scores["housingScore"],
            "employmentScore": scores["employmentScore"],
            "costOfLivingScore": scores["costOfLivingScore"],
            "medianRent": int(median_rent) if median_rent else None,
            "povertyRate": float(poverty) if poverty is not None else None,
            "bachelorsRate": float(bachelors) if bachelors is not None else None,
            "medianAge": float(rec.get("median_age")) if rec.get("median_age") is not None else None,
            "dataQuality": data_quality,
            "whyDescription": why_description(
                county_name or "Unknown", state_abbr, scores, median_income, median_home
            ),
        })

    out.sort(key=lambda c: composite_score(c), reverse=True)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, indent=2))
    UNMATCHED_LOG.write_text("\n".join(unmatched) + "\n" if unmatched else "")
    print(f"Wrote {len(out)} counties → {OUT_PATH}")
    if unmatched:
        print(f"Logged {len(unmatched)} unmatched → {UNMATCHED_LOG}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
