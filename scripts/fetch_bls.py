"""
Fetch county-level unemployment data from the BLS LAUS (Local Area Unemployment
Statistics) program.

The BLS Public Data API requires JSON POSTs with seriesids. Free tier allows
batches of 25 series per request. LAUS series IDs for counties follow:
  LAUCN{state_fips}{county_fips}0000000003  → unemployment rate
  LAUCN{state_fips}{county_fips}0000000004  → unemployed count
  LAUCN{state_fips}{county_fips}0000000005  → employed count
  LAUCN{state_fips}{county_fips}0000000006  → labor force

We use 0000000003 (unemployment rate) as the canonical signal.

This script enumerates counties from the previously generated census_data.json
(so it only fetches what we already know exists), batches them 25 at a time,
and writes data/raw/bls_data.json keyed by 5-digit FIPS.

No API key is required for the basic (low-volume) endpoint. For larger jobs,
register at https://data.bls.gov/registrationEngine/ and set BLS_API_KEY.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import requests

BLS_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/"
ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
CENSUS_PATH = RAW_DIR / "census_data.json"
OUT_PATH = RAW_DIR / "bls_data.json"

# Pull the trailing 12 months and use the most recent data point.
THIS_YEAR = time.gmtime().tm_year


def series_id(fips: str) -> str:
    state = fips[:2]
    county = fips[2:]
    return f"LAUCN{state}{county}0000000003"


def chunk(lst: list[str], n: int) -> list[list[str]]:
    return [lst[i:i + n] for i in range(0, len(lst), n)]


def fetch_batch(series_ids: list[str], api_key: str | None) -> dict[str, float]:
    payload = {
        "seriesid": series_ids,
        "startyear": str(THIS_YEAR - 1),
        "endyear": str(THIS_YEAR),
    }
    if api_key:
        payload["registrationkey"] = api_key

    for attempt in range(3):
        try:
            r = requests.post(BLS_URL, json=payload, timeout=60)
            r.raise_for_status()
            data = r.json()
            if data.get("status") != "REQUEST_SUCCEEDED":
                msg = "; ".join(data.get("message", []) or ["unknown"])
                raise RuntimeError(f"BLS error: {msg}")
            out: dict[str, float] = {}
            for s in data.get("Results", {}).get("series", []):
                sid = s["seriesID"]
                # Series ID layout: LAUCN + 2 state + 3 county + 10 chars
                fips = sid[5:10]
                pts = s.get("data", [])
                if not pts:
                    continue
                # Take the most recent month available
                latest = pts[0]
                try:
                    out[fips] = float(latest["value"])
                except (KeyError, ValueError):
                    continue
            return out
        except requests.RequestException as e:
            wait = 2 ** attempt
            print(f"  retry in {wait}s: {e}", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("Failed BLS batch after 3 attempts")


def main() -> int:
    if not CENSUS_PATH.exists():
        print(
            "ERROR: data/raw/census_data.json not found. Run fetch_census.py first.",
            file=sys.stderr,
        )
        return 1

    api_key = os.environ.get("BLS_API_KEY")
    census = json.loads(CENSUS_PATH.read_text())
    fips_list = sorted(census.keys())
    series_ids = [series_id(f) for f in fips_list]

    print(f"Fetching unemployment rates for {len(fips_list)} counties...", flush=True)
    results: dict[str, dict[str, float]] = {}
    batches = chunk(series_ids, 25)
    for i, batch in enumerate(batches, 1):
        print(f"  [{i:3d}/{len(batches)}] batch of {len(batch)}", flush=True)
        rates = fetch_batch(batch, api_key)
        for fips, rate in rates.items():
            results[fips] = {"unemployment_rate": rate}
        # Public-tier rate limit is 25 queries / day / IP without a key; with a key,
        # 500 / day. Sleep generously between batches to avoid throttling.
        time.sleep(0.5 if api_key else 2.0)

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(results, indent=2))
    print(f"\nWrote {len(results)} counties → {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
