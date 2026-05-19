#!/usr/bin/env python3
"""
Predict the rep count for a single new recording.

Usage:
    python predict.py recordings/deadlift.json
    python predict.py /path/to/any_recording.json

Requires output/model.pkl — run train.py first.
"""

import json
import pickle
import sys
from pathlib import Path

ROOT = Path(__file__).parent


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python predict.py <path-to-recording.json>")

    recording_path = Path(sys.argv[1])
    if not recording_path.exists():
        sys.exit(f"File not found: {recording_path}")

    pkl_path = ROOT / "output" / "model.pkl"
    if not pkl_path.exists():
        sys.exit("output/model.pkl not found — run train.py first.")

    # Load the model
    with open(pkl_path, "rb") as f:
        bundle = pickle.load(f)
    model       = bundle["model"]
    feature_cols = bundle["feature_cols"]

    # Load the recording and import helpers from train.py
    sys.path.insert(0, str(ROOT))
    from train import extract_features, build_categorical_features

    with open(recording_path) as f:
        data = json.load(f)

    samples = data["samples"]
    feats   = extract_features(samples)
    build_categorical_features(
        feats,
        str(data.get("muscleGroup") or "unknown"),
        str(data.get("equipmentType") or "unknown"),
        str(data.get("mechanicType") or "unknown"),
    )

    # Build input vector in the correct order (default 0.0 for any unknown col)
    x = [[feats.get(col, 0.0) for col in feature_cols]]

    raw_pred     = float(model.predict(x)[0])
    rounded_pred = round(raw_pred)

    print(f"\nRecording : {recording_path.name}")
    print(f"Samples   : {len(samples)}")
    print(f"Duration  : {feats['duration_ms'] / 1000:.1f}s")
    print(f"Prediction: {rounded_pred} reps  (raw: {raw_pred:.2f})")

    if "reps" in data:
        true_count = int(data["reps"])
        err        = rounded_pred - true_count
        print(f"Ground truth: {true_count} reps  (error: {err:+d})")

    print()


if __name__ == "__main__":
    main()
