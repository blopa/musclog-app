#!/usr/bin/env python3
"""
Predict rep count and per-rep phase details for a single recording.

Full pipeline:
  1. preprocess_to_1d()  — PCA on Euler angles → 1D canonical signal
  2. over_segment()       — candidate full-rep segments
  3. Classify each segment with the trained RandomForestClassifier
  4. Count surviving segments (prob_rep > 0.5) → predicted rep count
  5. detect_phases()      — analytical phase split within each rep
                            Phase A = start → turning point (one direction)
                            Phase B = turning point → end  (return direction)
                            Speed   = angular displacement / duration (deg/s)

No additional labels are needed beyond what was used for training.

Usage:
    python predict.py raw-data/deadlift.json
    python predict.py /path/to/any_recording.json  [--json]

Add --json to print the full result as JSON.

Requires output/model.pkl — run train.py first.
"""

import json
import pickle
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent


# ---------------------------------------------------------------------------
# Phase detection (analytical — no ML)
# ---------------------------------------------------------------------------

def detect_phases(seg: dict, signal_1d: np.ndarray, timestamps: np.ndarray) -> dict:
    """
    Split one rep segment into two directional phases at its turning point.

    The `turning_idx` stored in the segment is already the internal peak
    or trough found by over_segment(), i.e. the exact moment the movement
    reverses direction.

    Phase A = start_idx → turning_idx  (first direction of motion)
    Phase B = turning_idx → end_idx    (return direction)

    Speed is reported in deg/s (angular displacement / duration).

    Note: without a calibration recording, Phase A and Phase B are unlabeled
    directionally. A future calibration step can resolve which is concentric
    vs eccentric by determining which direction of the PCA signal corresponds
    to "lifting against gravity".
    """
    s = seg["start_idx"]
    t = seg["turning_idx"]
    e = seg["end_idx"]

    phase_a_ms = float(timestamps[t] - timestamps[s])
    phase_b_ms = float(timestamps[e] - timestamps[t])
    disp_a     = abs(float(signal_1d[t] - signal_1d[s]))
    disp_b     = abs(float(signal_1d[e] - signal_1d[t]))

    phase_a_dps = disp_a / (phase_a_ms / 1000.0) if phase_a_ms > 0.0 else 0.0
    phase_b_dps = disp_b / (phase_b_ms / 1000.0) if phase_b_ms > 0.0 else 0.0

    return {
        "phase_a_duration_ms": round(phase_a_ms, 1),
        "phase_b_duration_ms": round(phase_b_ms, 1),
        "phase_a_speed_dps":   round(phase_a_dps, 2),
        "phase_b_speed_dps":   round(phase_b_dps, 2),
    }


# ---------------------------------------------------------------------------
# Full prediction pipeline
# ---------------------------------------------------------------------------

def predict_recording(recording_path: Path) -> dict:
    """
    Load a recording JSON, run the full Segment-and-Score pipeline, and
    return a result dict with predicted rep count and per-rep phase detail.
    """
    sys.path.insert(0, str(ROOT))
    from train import (
        SEGMENT_FEATURE_COLS,
        extract_segment_features,
        over_segment,
        preprocess_to_1d,
    )

    pkl_path = ROOT / "output" / "model.pkl"
    if not pkl_path.exists():
        sys.exit("output/model.pkl not found — run train.py first.")

    with open(pkl_path, "rb") as f:
        bundle = pickle.load(f)
    model        = bundle["model"]
    feature_cols = bundle["feature_cols"]

    with open(recording_path) as f:
        data = json.load(f)

    samples  = data.get("samples", [])
    metadata = {
        "muscleGroup":   data.get("muscleGroup"),
        "equipmentType": data.get("equipmentType"),
        "mechanicType":  data.get("mechanicType"),
        "setNumber":     data.get("setNumber"),
    }

    if len(samples) < 20:
        return {
            "recording":          recording_path.name,
            "predicted_reps":     0,
            "candidate_segments": 0,
            "classified_as_rep":  0,
            "reps":               [],
            "error":              f"recording too short ({len(samples)} samples)",
        }

    signal_1d, timestamps = preprocess_to_1d(samples)
    all_segs              = over_segment(signal_1d, timestamps)

    if not all_segs:
        return {
            "recording":          recording_path.name,
            "predicted_reps":     0,
            "candidate_segments": 0,
            "classified_as_rep":  0,
            "reps":               [],
            "error":              "no segments found in signal (motion too small?)",
        }

    # Annotate segments with amplitude + energy (required by extract_segment_features)
    for seg in all_segs:
        chunk          = signal_1d[seg["start_idx"] : seg["end_idx"] + 1]
        seg["amplitude"] = float(chunk.max() - chunk.min())
        dur            = float(timestamps[seg["end_idx"]] - timestamps[seg["start_idx"]])
        avg_dt         = (dur / 1000.0) / max(1, len(chunk) - 1)
        seg["energy"]  = float(np.sum(chunk ** 2) * avg_dt)

    # Extract features and classify each segment
    feature_matrix = []
    for idx, seg in enumerate(all_segs):
        feats = extract_segment_features(idx, seg, signal_1d, timestamps, all_segs, metadata)
        feature_matrix.append([feats.get(col, 0.0) for col in feature_cols])

    probs        = model.predict_proba(np.array(feature_matrix))[:, 1]
    rep_pairs    = [(seg, float(p)) for seg, p in zip(all_segs, probs) if p > 0.5]

    # Sort surviving reps chronologically
    rep_pairs.sort(key=lambda x: x[0]["start_ts"])

    rec_start   = float(timestamps[0])
    reps_detail = []
    for i, (seg, conf) in enumerate(rep_pairs, 1):
        phases     = detect_phases(seg, signal_1d, timestamps)
        dur_ms     = float(seg["end_ts"] - seg["start_ts"])
        reps_detail.append({
            "index":               i,
            "start_ms":            round(seg["start_ts"] - rec_start, 1),
            "end_ms":              round(seg["end_ts"]   - rec_start, 1),
            "duration_ms":         round(dur_ms, 1),
            **phases,
            "classifier_confidence": round(conf, 3),
        })

    result: dict = {
        "recording":          recording_path.name,
        "predicted_reps":     len(reps_detail),
        "candidate_segments": len(all_segs),
        "classified_as_rep":  len(reps_detail),
        "reps":               reps_detail,
    }

    rep_markers = data.get("repMarkers")
    if rep_markers:
        true_count = len(rep_markers)
        result["ground_truth_reps"] = true_count
        result["count_error"]       = len(reps_detail) - true_count
    elif "reps" in data:
        true_count = int(data["reps"])
        result["ground_truth_reps"] = true_count
        result["count_error"]       = len(reps_detail) - true_count

    return result


# ---------------------------------------------------------------------------
# CLI output
# ---------------------------------------------------------------------------

def _print_result(result: dict, n_samples: int) -> None:
    print(f"\nRecording         : {result['recording']}")
    print(f"Samples           : {n_samples}")
    print(f"Candidate segments: {result['candidate_segments']}")
    print(f"Classified as rep : {result['classified_as_rep']}")
    print(f"Predicted reps    : {result['predicted_reps']}")

    if "ground_truth_reps" in result:
        err = result["count_error"]
        print(f"Ground truth reps : {result['ground_truth_reps']}  (error: {err:+d})")

    if "error" in result:
        print(f"\nNote: {result['error']}")

    reps = result.get("reps", [])
    if not reps:
        print("\n  No reps detected.")
        return

    print(f"\nPer-rep breakdown:")
    hdr = f"  {'Rep':>4}  {'Total':>8}  {'Phase A':>8}  {'Phase B':>8}  "
    hdr += f"{'spd A':>8}  {'spd B':>8}  {'Conf':>6}"
    sep = "  " + "─" * (len(hdr) - 2)
    print(hdr)
    print(sep)

    for r in reps:
        print(
            f"  {r['index']:>4}"
            f"  {r['duration_ms']/1000:>7.2f}s"
            f"  {r['phase_a_duration_ms']/1000:>7.2f}s"
            f"  {r['phase_b_duration_ms']/1000:>7.2f}s"
            f"  {r['phase_a_speed_dps']:>7.1f}°/s"
            f"  {r['phase_b_speed_dps']:>7.1f}°/s"
            f"  {r['classifier_confidence']:>6.2f}"
        )

    durations  = [r["duration_ms"] for r in reps]
    phase_a_ms = [r["phase_a_duration_ms"] for r in reps]
    phase_b_ms = [r["phase_b_duration_ms"] for r in reps]
    spd_a      = [r["phase_a_speed_dps"] for r in reps]
    spd_b      = [r["phase_b_speed_dps"] for r in reps]
    n          = len(reps)

    print(f"\n  Averages:")
    print(f"    Total duration : {sum(durations)/n/1000:.2f}s")
    print(f"    Phase A        : {sum(phase_a_ms)/n/1000:.2f}s  "
          f"({sum(spd_a)/n:.1f}°/s avg)")
    print(f"    Phase B        : {sum(phase_b_ms)/n/1000:.2f}s  "
          f"({sum(spd_b)/n:.1f}°/s avg)")
    print(f"    Total TUT      : {sum(durations)/1000:.1f}s")
    print()


def main() -> None:
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        sys.exit("Usage: python predict.py <recording.json> [--json]")

    as_json        = "--json" in args
    recording_args = [a for a in args if not a.startswith("-")]

    if not recording_args:
        sys.exit("Usage: python predict.py <recording.json> [--json]")

    recording_path = Path(recording_args[0])
    if not recording_path.exists():
        sys.exit(f"File not found: {recording_path}")

    with open(recording_path) as f:
        data = json.load(f)
    n_samples = len(data.get("samples", []))

    result = predict_recording(recording_path)

    if as_json:
        print(json.dumps(result, indent=2))
    else:
        _print_result(result, n_samples)


if __name__ == "__main__":
    main()
