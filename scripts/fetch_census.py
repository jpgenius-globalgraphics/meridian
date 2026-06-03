"""
Fetch ACS 5-year estimates from the US Census Bureau for every county.

Pulls the following variables (latest available ACS 5-year vintage):
  B19013_001E — Median household income
  B25077_001E — Median home value (owner-occupied)
  B25064_001E — Median gross rent
  B23025_005E — Civilian labor force: unemployed
  B23025_003E — Civilian labor force: in labor force
  B01003_001E — Total population
  B17001_002E — Income in past 12 months below poverty level
  B15003_001E — Educational attainment denominator (pop 25+)
  B15003_022E — Bachelor's degree
  B15003_023E — Master's degree
  B15003_024E — Professional school degree
  B15003_025E — Doctorate degree
  B01002_001E — Median age

Output: data/raw/census_data.json, keyed by 5-digit FIPS (state+county).

Requires CENSUS_API_KEY in the environment. Get a free key at:
  https://api.census.gov/data/key_signup.html
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import requests

# Latest stable ACS 5-year release. Bump the year if a newer release is published.
ACS_YEAR = 2022
BASE_URL = f"https://api.census.gov/data/{ACS_YEAR}/acs/acs5"

VARIABLES = [
    "B19013_001E",   # median household income
    "B25077_001E",   # median home value
    "B25064_001E",   # median rent
    "B23025_005E",   # unemployed
    "B23025_003E",   # civilian labor force
    "B01003_001E",   # population
    "B17001_002E",   # below poverty
    "B15003_001E",   # education denominator
    "B15003_022E",   # bachelors
    "B15003_023E",   # masters
    "B15003_024E",   # professional
    "B15003_025E",   # doctorate
    "B01002_001E",   # median age
    "NAME",
]

# 51 state FIPS codes (50 states + DC). Skips territories (PR/AS/GU/etc).
STATE_FIPS = [
    "01","02","04","05","06","08","09","10","11","12","13","15","16","17","18",
    "19","20","21","22","23","24","25","26","27","28","29","30","31","32","33",
    "34","35","36","37","38","39","40","41","42","44","45","46","47","48","49",
    "50","51","53","54","55","56",
]


def _safe_int(v: Any) -> int | None:
    try:
        n = int(v)
        # Census uses negative sentinels for "no data"
        return n if n >= 0 else None
    except (TypeError, ValueError):
        return None


def _safe_float(v: Any) -> float | None:
    try:
        n = float(v)
        return n if n >= 0 else None
    except (TypeError, ValueError):
        return None


def fetch_state(state_fips: str, api_key: str) -> list[list[str]]:
    """Return raw Census API response rows for one state (header + N counties)."""
    params = {
        "get": ",".join(VARIABLES),
        "for": "county:*",
        "in": f"state:{state_fips}",
        "key": api_key,
    }
    for attempt in range(3):
        try:
            r = requests.get(BASE_URL, params=params, timeout=60)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            wait = 2 ** attempt
            print(f"  [state {state_fips}] retry in {wait}s: {e}", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Failed to fetch state {state_fips} after 3 attempts")


def parse_row(header: list[str], row: list[str]) -> tuple[str, dict[str, Any]]:
    """Parse one Census row into (fips, record)."""
    rec = dict(zip(header, row))
    state = rec["state"]
    county = rec["county"]
    fips = f"{state}{county}"

    pop = _safe_int(rec.get("B01003_001E"))
    lf = _safe_int(rec.get("B23025_003E"))
    unemployed = _safe_int(rec.get("B23025_005E"))
    poverty = _safe_int(rec.get("B17001_002E"))
    edu_denom = _safe_int(rec.get("B15003_001E"))
    bachelors_or_higher = sum(
        v for v in (
            _safe_int(rec.get("B15003_022E")),
            _safe_int(rec.get("B15003_023E")),
            _safe_int(rec.get("B15003_024E")),
            _safe_int(rec.get("B15003_025E")),
        ) if v is not None
    )

    out = {
        "fips": fips,
        "name_raw": rec.get("NAME", ""),
        "population": pop,
        "median_income": _safe_int(rec.get("B19013_001E")),
        "median_home_value": _safe_int(rec.get("B25077_001E")),
        "median_rent": _safe_int(rec.get("B25064_001E")),
        "median_age": _safe_float(rec.get("B01002_001E")),
        "unemployment_rate": (
            round(unemployed / lf * 100, 2) if (unemployed is not None and lf and lf > 0) else None
        ),
        "poverty_rate": (
            round(poverty / pop * 100, 2) if (poverty is not None and pop and pop > 0) else None
        ),
        "bachelors_rate": (
            round(bachelors_or_higher / edu_denom * 100, 2)
            if (edu_denom and edu_denom > 0) else None
        ),
    }
    return fips, out


def main() -> int:
    api_key = os.environ.get("CENSUS_API_KEY")
    if not api_key:
        print("ERROR: CENSUS_API_KEY environment variable is required.", file=sys.stderr)
        print("Get a free key: https://api.census.gov/data/key_signup.html", file=sys.stderr)
        return 1

    out_dir = Path(__file__).resolve().parent.parent / "data" / "raw"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "census_data.json"

    results: dict[str, dict[str, Any]] = {}
    for i, state in enumerate(STATE_FIPS, 1):
        print(f"[{i:2d}/{len(STATE_FIPS)}] state {state}...", flush=True)
        rows = fetch_state(state, api_key)
        header, *data_rows = rows
        for row in data_rows:
            fips, rec = parse_row(header, row)
            results[fips] = rec
        time.sleep(0.1)  # be polite

    out_path.write_text(json.dumps(results, indent=2))
    print(f"\nWrote {len(results)} counties → {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
