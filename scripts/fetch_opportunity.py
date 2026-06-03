"""
Download the Opportunity Atlas tract-level outcomes file (Chetty et al. 2018)
and aggregate the kfr_pooled_pooled_p25 series up to the county level.

kfr_pooled_pooled_p25 = mean income rank at age 35 for children pooled across
race and sex, born to parents at the 25th percentile of the national income
distribution. Higher = more upward mobility.

Source:
  https://data.nber.org/opportunity-atlas/tract_outcomes_simple.csv

This file is large (~150 MB). It only needs to be downloaded once.

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
CSV_PATH = RAW_DIR / "tract_outcomes_simple.csv"
OUT_PATH = RAW_DIR / "opportunity_data.json"

CSV_URL = "https://data.nber.org/opportunity-atlas/tract_outcomes_simple.csv"


def download_csv() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if CSV_PATH.exists():
        print(f"Using cached CSV at {CSV_PATH}")
        return
    print(f"Downloading {CSV_URL} (this can take a few minutes)...")
    with requests.get(CSV_URL, stream=True, timeout=600) as r:
        r.raise_for_status()
        with CSV_PATH.open("wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
    print(f"Saved → {CSV_PATH}")


def aggregate() -> dict[str, dict[str, float]]:
    """Load the tract CSV and average kfr_pooled_pooled_p25 to the county level."""
    # Only load the columns we need to keep memory under control.
    needed = ["state", "county", "kfr_pooled_pooled_p25"]
    print("Reading CSV (only required columns)...")
    df = pd.read_csv(CSV_PATH, usecols=needed, dtype={"state": str, "county": str})

    # Make sure state and county are zero-padded to 2 and 3 chars respectively.
    df["state"] = df["state"].str.zfill(2)
    df["county"] = df["county"].str.zfill(3)
    df["fips"] = df["state"] + df["county"]

    df = df.dropna(subset=["kfr_pooled_pooled_p25"])
    grouped = df.groupby("fips")["kfr_pooled_pooled_p25"].mean()

    print(f"Aggregated {len(grouped)} counties from {len(df)} tract rows")
    return {fips: {"mobility_p25": float(v)} for fips, v in grouped.items()}


def main() -> int:
    try:
        download_csv()
        results = aggregate()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    OUT_PATH.write_text(json.dumps(results, indent=2))
    print(f"Wrote {len(results)} counties → {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
