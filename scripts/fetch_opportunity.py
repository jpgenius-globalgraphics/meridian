"""
Download the Opportunity Atlas county-level outcomes file (Chetty et al. 2018)
and extract the kfr_pooled_pooled_p25 series.

kfr_pooled_pooled_p25 = mean income rank at age 35 for children pooled across
race and sex, born to parents at the 25th percentile of the national income
distribution. Higher = more upward mobility.

Source:
  https://opportunityinsights.org/wp-content/uploads/2018/10/county_outcomes_simple.csv

This is the county-aggregated release — already keyed by FIPS, so no tract→county
roll-up is needed. The original tract-level file is at the same path with
"tract_" instead of "county_" if higher granularity is ever required.

Output: data/raw/opportunity_data.json — { "<fips5>": { "mobility_p25": <0-1> } }
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
CSV_PATH = RAW_DIR / "county_outcomes_simple.csv"
OUT_PATH = RAW_DIR / "opportunity_data.json"

CSV_URL = (
    "https://opportunityinsights.org/wp-content/uploads/2018/10/"
    "county_outcomes_simple.csv"
)


def download_csv() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if CSV_PATH.exists() and CSV_PATH.stat().st_size > 0:
        print(f"Using cached CSV at {CSV_PATH}")
        return
    print(f"Downloading {CSV_URL}...")
    with requests.get(CSV_URL, stream=True, timeout=300) as r:
        r.raise_for_status()
        with CSV_PATH.open("wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
    print(f"Saved → {CSV_PATH}")


def extract() -> dict[str, dict[str, float]]:
    """Load the county CSV and pull kfr_pooled_pooled_p25 per FIPS."""
    print("Reading CSV...")
    df = pd.read_csv(CSV_PATH, dtype={"state": str, "county": str})

    # Drop rows missing the mobility metric we need
    if "kfr_pooled_pooled_p25" not in df.columns:
        cols = ", ".join(df.columns[:20])
        raise RuntimeError(
            f"kfr_pooled_pooled_p25 missing from CSV. First 20 cols: {cols}"
        )

    df = df.dropna(subset=["kfr_pooled_pooled_p25"])
    df["state"] = df["state"].str.zfill(2)
    df["county"] = df["county"].str.zfill(3)
    df["fips"] = df["state"] + df["county"]

    out = {
        row.fips: {"mobility_p25": float(row.kfr_pooled_pooled_p25)}
        for row in df.itertuples()
    }
    print(f"Extracted mobility for {len(out)} counties")
    return out


def main() -> int:
    try:
        download_csv()
        results = extract()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    OUT_PATH.write_text(json.dumps(results, indent=2))
    print(f"Wrote {len(results)} counties → {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
