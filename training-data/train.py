#!/usr/bin/env python3
"""
Segment-and-Score rep counting trainer.

Instead of predicting rep count for a whole recording (regression), this pipeline:
  1. Selects the best 1D canonical signal from 10 candidate axes (3 Euler angles,
     3 accelerometer components, 3 gyroscope components, 1 acc magnitude) by
     spectral concentration in the rep-frequency band.
  2. Over-segments the signal into candidate rep-segments using low-threshold
     peak detection — deliberately capturing more segments than actual reps.
  3. Pseudo-labels each segment as rep (1) or noise (0) using the recording's
     known total rep count as the only required label.
  4. Trains a RandomForestClassifier on per-segment features.
  5. Exports the classifier to JavaScript via m2cgen for on-device inference.

At inference time (predict.py) the classifier scores each candidate segment;
those above 0.5 are counted as reps, and their boundaries feed an analytical
phase-detection step that measures Phase A / Phase B speed without any labels.

Usage:
    python train.py

Input:
    recordings/*.json  — motion recordings with a 'reps' field

Output:
    output/features.csv  — per-segment feature matrix (for inspection)
    output/model.pkl     — trained classifier  (used by predict.py)
    output/model.js      — same classifier as a JS function  (for app)
    output/summary.txt   — evaluation report
"""

import json
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import signal as scipy_signal
from scipy.fft import rfft, rfftfreq
from scipy.signal import butter, filtfilt, savgol_filter
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    f1_score,
    mean_absolute_error,
    precision_score,
    recall_score,
)
from sklearn.model_selection import LeaveOneGroupOut
import m2cgen as m2c

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT           = Path(__file__).parent
RECORDINGS_DIR = ROOT / "recordings"
OUTPUT_DIR     = ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Over-segmentation constants
# ---------------------------------------------------------------------------
OVER_SEG_PROMINENCE_FRAC = 0.03  # 3 % of signal range — deliberately sensitive
MIN_SEG_DURATION_MS      = 300   # discard sub-300 ms micro-movements
MIN_HALF_REP_MS          = 150   # minimum half-rep (sets peak/valley min_distance)

# ---------------------------------------------------------------------------
# Categorical metadata — fixed lists so the feature vector size never changes
# ---------------------------------------------------------------------------
MUSCLE_GROUPS = sorted([
    "abdomen", "arms", "back", "chest", "core",
    "full_body", "glutes", "legs", "shoulders", "unknown",
])
EQUIPMENT_TYPES = sorted([
    "barbell", "bodyweight", "cable", "cardio", "dumbbell", "kettlebell",
    "machine", "other", "plate_machine", "pneumatic_machine", "resistance_band",
    "smith_machine", "unknown",
])
MECHANIC_TYPES = sorted([
    "cardio", "compound", "isolation", "mobility", "other",
    "plyometric", "stretching", "unknown",
])

# ---------------------------------------------------------------------------
# Feature names — defines the segment-level input vector (order matters)
# ---------------------------------------------------------------------------
_SEG_SIGNAL_FEATURES = [
    "amplitude",            # peak-to-trough range within the segment
    "duration_ms",          # segment duration (start → end)
    "energy",               # integral of squared signal × avg_dt
    "prominence",           # prominence of the turning point in the 1D signal
    "relative_amplitude",   # amplitude / recording's full 1D signal range
    "relative_duration",    # duration_ms / median segment duration
    "temporal_regularity",  # 1 / (1 + CV of inter-segment intervals); higher = more rhythmic
    "position_frac",        # normalised time position [0, 1]; setup/unrack cluster near edges
    "neighbour_amp_ratio",  # amplitude / mean(immediate neighbours' amplitudes)
    "set_number",
    "spectral_entropy",     # Shannon entropy of segment PSD; low = concentrated/rep-like
]
_SEG_CATEGORICAL_FEATURES = (
    [f"muscle_{g}"   for g in MUSCLE_GROUPS]
    + [f"equip_{t}"  for t in EQUIPMENT_TYPES]
    + [f"mechanic_{t}" for t in MECHANIC_TYPES]
)
SEGMENT_FEATURE_COLS = _SEG_SIGNAL_FEATURES + _SEG_CATEGORICAL_FEATURES


# ---------------------------------------------------------------------------
# Step 1 — Preprocessing: best-axis bandpass → 1D canonical signal
# ---------------------------------------------------------------------------

# Bandpass bounds for the rep-frequency band.
#
# These are universal physiological constraints — NOT derived from any specific
# user's data and NOT demographic (they apply equally to all ages, genders, and
# body types):
#
#   _BP_LO_HZ = 0.10  →  10 s/rep  (6 reps/min) — the Superslow protocol and
#                         extreme powerlifting tempos sit right at this edge.
#                         Even the slowest controlled 5-count eccentric (5 s
#                         down) produces a 0.1 Hz cycle.
#
#   _BP_HI_HZ = 3.00  →  333 ms/rep  (180 reps/min) — maximum for any loaded
#                         voluntary movement; only unweighted plyometrics reach
#                         this ceiling.
#
# Note: lowering _BP_LO_HZ (e.g. to 0.02 Hz to "adapt" to recording length)
# lets slow drift compete in the spectral-score axis selection and causes the
# wrong sensor axis to be chosen.  If you need to support reps slower than
# 10 s/rep, lower _BP_LO_HZ to 0.05 and re-evaluate segmentation quality.
_BP_LO_HZ = 0.10
_BP_HI_HZ = 3.00


def _bandpass(sig: np.ndarray, sr: float) -> np.ndarray:
    nyq = sr / 2.0
    lo  = _BP_LO_HZ / nyq
    hi  = min(_BP_HI_HZ / nyq, 0.99)
    if lo >= hi:
        return sig
    b, a = butter(2, [lo, hi], btype="band")
    return filtfilt(b, a, sig)


def _spectral_score(sig: np.ndarray, sr: float) -> float:
    """
    Fraction of rep-band power at the single dominant frequency.
    High score = periodic signal.  Low score = broadband noise or DC-dominated.
    """
    freqs  = rfftfreq(len(sig), d=1.0 / sr)
    power  = np.abs(rfft(sig)) ** 2
    mask   = (freqs >= _BP_LO_HZ) & (freqs <= _BP_HI_HZ)
    if not mask.any():
        return 0.0
    peak_power  = float(power[mask].max())
    total_power = float(power[mask].sum()) + 1e-10
    return peak_power / total_power


def preprocess_to_1d(samples: list) -> tuple:
    """
    Select the single best signal axis for rep detection and bandpass-filter it.

    For each of the 6 raw axes (3 Euler-angle + 3 accelerometer):
      1. Unwrap Euler angles to handle ±180° discontinuities (hip-hinge, bicep curls).
      2. Savitzky-Golay smooth (~0.5 % window).
      3. Butterworth bandpass 0.1–3 Hz to remove drift and high-freq noise.
      4. Score by spectral concentration: fraction of rep-band power at the dominant
         frequency. A clean rep signal scores high; broadband noise scores low.

    The axis with the highest spectral score is selected.  This reliably picks
    angle axes for exercises with clear rotation (bench press, deadlift, squat)
    and accel axes when angle data is flat (lat pulldown, cable exercises).

    Returns (signal_1d: ndarray, timestamps: ndarray).
    """
    ts  = np.array([s["timestamp"]   for s in samples], dtype=float)
    ang = np.array([[s["angle"]["x"],  s["angle"]["y"],  s["angle"]["z"]]
                    for s in samples], dtype=float)
    acc = np.array([[s["accel"]["x"],  s["accel"]["y"],  s["accel"]["z"]]
                    for s in samples], dtype=float)
    gyr = np.array([[s["gyro"]["x"],   s["gyro"]["y"],   s["gyro"]["z"]]
                    for s in samples], dtype=float)

    n   = len(ts)
    sr  = n / ((ts[-1] - ts[0]) / 1000.0)
    win = max(5, (int(n * 0.005) // 2) * 2 + 1)  # ~0.5 % of samples, odd

    # Unwrap Euler angles per axis to remove ±180° jumps
    ang_uw = np.degrees(np.unwrap(np.radians(ang), axis=0))

    best_sig:   np.ndarray = None
    best_score: float      = -1.0

    for arr in (ang_uw, acc, gyr):
        for i in range(3):
            sm  = savgol_filter(arr[:, i], window_length=win, polyorder=2)
            bp  = _bandpass(sm, sr)
            rng = float(bp.max() - bp.min())
            if rng < 1e-4:
                continue
            score = _spectral_score(bp, sr)
            if score > best_score:
                best_score = score
                best_sig   = bp

    # 10th candidate: orientation-agnostic accelerometer magnitude
    acc_r = np.sqrt(np.sum(acc ** 2, axis=1))
    sm    = savgol_filter(acc_r, window_length=win, polyorder=2)
    bp    = _bandpass(sm, sr)
    rng   = float(bp.max() - bp.min())
    if rng >= 1e-4:
        score = _spectral_score(bp, sr)
        if score > best_score:
            best_score = score
            best_sig   = bp

    if best_sig is None:
        # Absolute fallback: bandpass angle-z (will yield a flat / empty signal)
        sm       = savgol_filter(ang_uw[:, 2], window_length=win, polyorder=2)
        best_sig = _bandpass(sm, sr)

    return best_sig, ts


# ---------------------------------------------------------------------------
# Step 2 — Over-segmentation: full-rep candidate segments
# ---------------------------------------------------------------------------

def over_segment(signal_1d: np.ndarray, timestamps: np.ndarray) -> list:
    """
    Slice the 1D signal into candidate full-rep segments.

    Strategy: find all valleys (local minima) and all peaks (local maxima)
    with a low prominence threshold. Build two segment sets — valley-to-valley
    and peak-to-peak — and return whichever has more segments (more over-
    segmented), breaking ties by lower duration CV (more consistent = better).

    Each segment dict contains:
        start_idx, turning_idx, end_idx  — sample indices
        start_ts,  turning_ts,  end_ts   — timestamps (ms)
    """
    sig_range = float(signal_1d.max() - signal_1d.min())
    if sig_range < 1e-3:
        return []

    rec_duration_s = (float(timestamps[-1]) - float(timestamps[0])) / 1000.0
    sample_rate    = len(timestamps) / max(rec_duration_s, 1e-6)
    min_prom       = sig_range * OVER_SEG_PROMINENCE_FRAC
    min_dist       = max(1, int(sample_rate * MIN_HALF_REP_MS / 1000.0))

    peaks,   _ = scipy_signal.find_peaks( signal_1d, prominence=min_prom, distance=min_dist)
    valleys, _ = scipy_signal.find_peaks(-signal_1d, prominence=min_prom, distance=min_dist)

    def build_segs(boundaries: np.ndarray, valley_boundaries: bool) -> list:
        segs = []
        for i in range(len(boundaries) - 1):
            s_idx = int(boundaries[i])
            e_idx = int(boundaries[i + 1])
            if timestamps[e_idx] - timestamps[s_idx] < MIN_SEG_DURATION_MS:
                continue
            chunk    = signal_1d[s_idx : e_idx + 1]
            # The internal turning point is the peak (if boundaries are valleys)
            # or the trough (if boundaries are peaks)
            turn_rel = int(np.argmax(chunk)) if valley_boundaries else int(np.argmin(chunk))
            turn_idx = s_idx + turn_rel
            segs.append({
                "start_idx":   s_idx,
                "turning_idx": turn_idx,
                "end_idx":     e_idx,
                "start_ts":    float(timestamps[s_idx]),
                "turning_ts":  float(timestamps[turn_idx]),
                "end_ts":      float(timestamps[e_idx]),
            })
        return segs

    segs_v = build_segs(valleys, valley_boundaries=True)
    segs_p = build_segs(peaks,   valley_boundaries=False)

    def duration_cv(segs: list) -> float:
        if len(segs) < 2:
            return np.inf
        durs = np.array([s["end_ts"] - s["start_ts"] for s in segs])
        return float(np.std(durs) / (np.mean(durs) + 1e-6))

    if len(segs_v) > len(segs_p):
        return segs_v
    if len(segs_p) > len(segs_v):
        return segs_p
    return segs_v if duration_cv(segs_v) <= duration_cv(segs_p) else segs_p


# ---------------------------------------------------------------------------
# Step 3 — Per-segment feature extraction
# ---------------------------------------------------------------------------

def extract_segment_features(
    seg_idx:    int,
    seg:        dict,
    signal_1d:  np.ndarray,
    timestamps: np.ndarray,
    all_segs:   list,
    metadata:   dict,
) -> dict:
    """
    Compute the fixed-size feature vector for one candidate segment.

    `seg_idx`  — position of `seg` in `all_segs` (avoids O(n) list search)
    `all_segs` — full list of candidate segments for this recording (context)
    `metadata` — dict with keys: muscleGroup, equipmentType, mechanicType, setNumber
    """
    s = seg["start_idx"]
    e = seg["end_idx"]
    t = seg["turning_idx"]

    chunk       = signal_1d[s : e + 1]
    amplitude   = float(chunk.max() - chunk.min())
    duration_ms = float(timestamps[e] - timestamps[s])
    avg_dt_s    = (duration_ms / 1000.0) / max(1, len(chunk) - 1)
    energy      = float(np.sum(chunk ** 2) * avg_dt_s)

    global_range = float(signal_1d.max() - signal_1d.min()) or 1.0

    # Prominence of the internal turning point in the full 1D signal context
    try:
        if signal_1d[t] >= signal_1d[s]:          # turning point is a peak
            prom = float(scipy_signal.peak_prominences(signal_1d, [t])[0][0])
        else:                                       # turning point is a trough
            prom = float(scipy_signal.peak_prominences(-signal_1d, [t])[0][0])
    except Exception:
        prom = amplitude  # fallback

    # Context features derived from all candidate segments in this recording
    durations = [float(sg["end_ts"] - sg["start_ts"]) for sg in all_segs]
    med_dur   = float(np.median(durations)) or 1.0

    rel_amp = amplitude   / global_range
    rel_dur = duration_ms / med_dur

    # Temporal regularity: inverse of the coefficient of variation of
    # inter-segment start intervals. A rhythmic set of reps has low CV → high score.
    if len(all_segs) > 2:
        starts    = np.array([float(sg["start_ts"]) for sg in all_segs])
        intervals = np.diff(starts)
        cv_iv     = float(np.std(intervals) / (np.mean(intervals) + 1e-6))
        temporal_regularity = 1.0 / (1.0 + cv_iv)
    else:
        temporal_regularity = 0.5

    # Normalised time position [0, 1]; setup and unrack events cluster near 0 or 1
    rec_start = float(timestamps[0])
    rec_end   = float(timestamps[-1])
    position_frac = (seg["start_ts"] - rec_start) / max(1.0, rec_end - rec_start)

    # Amplitude relative to immediate neighbours
    nb_amps = []
    for nb_idx in (seg_idx - 1, seg_idx + 1):
        if 0 <= nb_idx < len(all_segs):
            nb = all_segs[nb_idx]
            nb_chunk = signal_1d[nb["start_idx"] : nb["end_idx"] + 1]
            nb_amps.append(float(nb_chunk.max() - nb_chunk.min()))
    neighbour_amp_ratio = amplitude / (float(np.mean(nb_amps)) + 1e-6) if nb_amps else 1.0

    # Spectral entropy of the segment (low = concentrated/rep-like, high = noisy)
    # chunk is already bandpass-filtered so this measures power concentration in the rep band
    if len(chunk) >= 4:
        power_seg = np.abs(rfft(chunk)) ** 2
        p_pdf     = power_seg / (power_seg.sum() + 1e-10)
        spectral_entropy = float(-np.sum(p_pdf * np.log(p_pdf + 1e-10)))
    else:
        spectral_entropy = 0.0

    feats: dict = {
        "amplitude":            amplitude,
        "duration_ms":          duration_ms,
        "energy":               energy,
        "prominence":           prom,
        "relative_amplitude":   rel_amp,
        "relative_duration":    rel_dur,
        "temporal_regularity":  temporal_regularity,
        "position_frac":        position_frac,
        "neighbour_amp_ratio":  neighbour_amp_ratio,
        "set_number":           float(metadata.get("setNumber") or 1),
        "spectral_entropy":     spectral_entropy,
    }

    # One-hot categorical features
    mg = str(metadata.get("muscleGroup")   or "unknown").strip().lower()
    eq = str(metadata.get("equipmentType") or "unknown").strip().lower()
    mt = str(metadata.get("mechanicType")  or "unknown").strip().lower()
    if mg not in MUSCLE_GROUPS:   mg = "unknown"
    if eq not in EQUIPMENT_TYPES: eq = "unknown"
    if mt not in MECHANIC_TYPES:  mt = "unknown"

    for g in MUSCLE_GROUPS:
        feats[f"muscle_{g}"] = 1.0 if mg == g else 0.0
    for t_ in EQUIPMENT_TYPES:
        feats[f"equip_{t_}"] = 1.0 if eq == t_ else 0.0
    for t_ in MECHANIC_TYPES:
        feats[f"mechanic_{t_}"] = 1.0 if mt == t_ else 0.0

    return feats


# ---------------------------------------------------------------------------
# Step 4 — Pseudo-labelling
# ---------------------------------------------------------------------------

def pseudo_label_segments(segments: list, n_reps: int) -> list:
    """
    Assign is_rep=1 to the top n_reps segments and is_rep=0 to the rest.

    Ranking score = amplitude × sqrt(energy) × temporal_consistency,
    where temporal_consistency rewards segments whose duration is close to
    the median — genuine reps in a set tend to be similarly paced.

    Returns None if the segmenter produced fewer candidates than known reps
    (cannot safely pseudo-label in that case).
    """
    if not segments or len(segments) < n_reps:
        return None

    durations = [sg["end_ts"] - sg["start_ts"] for sg in segments]
    med_dur   = float(np.median(durations)) or 1.0

    for seg in segments:
        dur = seg["end_ts"] - seg["start_ts"]
        tc  = 1.0 / (1.0 + abs(dur - med_dur) / med_dur)
        seg["pseudo_score"] = seg["amplitude"] * np.sqrt(seg["energy"] + 1e-6) * tc

    ranked = sorted(segments, key=lambda sg: -sg["pseudo_score"])
    for i, seg in enumerate(ranked):
        seg["is_rep"] = 1 if i < n_reps else 0

    return segments


def label_segments_from_markers(segments: list, rep_markers: list) -> list:
    """
    Assign is_rep=1 to the segment with the highest time-overlap (IoU) for
    each manual rep marker. Segments not matched to any marker get is_rep=0.

    Each marker must have keys startMs and endMs (absolute ms timestamps
    matching the samples[i].timestamp field).
    """
    for seg in segments:
        seg["is_rep"] = 0

    claimed: set = set()

    for marker in rep_markers:
        m_start = float(marker["startMs"])
        m_end   = float(marker["endMs"])
        m_dur   = m_end - m_start

        best_idx = None
        best_iou = 0.0

        for i, seg in enumerate(segments):
            if i in claimed:
                continue
            overlap = max(0.0, min(seg["end_ts"], m_end) - max(seg["start_ts"], m_start))
            if overlap == 0.0:
                continue
            s_dur = seg["end_ts"] - seg["start_ts"]
            iou   = overlap / (s_dur + m_dur - overlap + 1e-6)
            if iou > best_iou:
                best_iou = iou
                best_idx = i

        if best_idx is not None and best_iou > 0.05:
            segments[best_idx]["is_rep"] = 1
            claimed.add(best_idx)

    return segments


# ---------------------------------------------------------------------------
# Step 5 — Dataset builder
# ---------------------------------------------------------------------------

def build_segment_dataset() -> tuple:
    """
    Iterate all recordings, pseudo-label segments, extract features.
    Returns (DataFrame where each row is one candidate segment,
             list of skipped-under-segmented dicts with keys: name, n_segs, n_reps).
    """
    rows             = []
    skipped_noreps   = 0
    skipped_under    = 0
    skipped_under_list: list = []

    for path in sorted(RECORDINGS_DIR.glob("*.json")):
        with open(path) as f:
            data = json.load(f)

        if "reps" not in data:
            skipped_noreps += 1
            print(f"  SKIP (no reps field): {path.name}")
            continue

        n_reps  = int(data["reps"])
        samples = data.get("samples", [])

        if len(samples) < 20:
            print(f"  SKIP (too short — {len(samples)} samples): {path.name}")
            continue

        try:
            signal_1d, timestamps = preprocess_to_1d(samples)
            segs = over_segment(signal_1d, timestamps)
        except Exception as exc:
            print(f"  ERROR preprocess/segment {path.name}: {exc}")
            continue

        if not segs:
            print(f"  SKIP (no segments found): {path.name}")
            continue

        # Annotate each segment with amplitude + energy (needed for pseudo-labelling)
        for seg in segs:
            chunk          = signal_1d[seg["start_idx"] : seg["end_idx"] + 1]
            seg["amplitude"] = float(chunk.max() - chunk.min())
            dur            = float(timestamps[seg["end_idx"]] - timestamps[seg["start_idx"]])
            avg_dt         = (dur / 1000.0) / max(1, len(chunk) - 1)
            seg["energy"]  = float(np.sum(chunk ** 2) * avg_dt)

        rep_markers = data.get("repMarkers")
        if rep_markers:
            labeled    = label_segments_from_markers(segs, rep_markers)
            label_src  = f"manual ({len(rep_markers)} markers)"
        else:
            labeled = pseudo_label_segments(segs, n_reps)
            if labeled is None:
                skipped_under += 1
                skipped_under_list.append({"name": path.name, "n_segs": len(segs), "n_reps": n_reps})
                print(f"  SKIP (under-segmented: {len(segs)} segs < {n_reps} reps): {path.name}")
                continue
            label_src = "pseudo"

        print(f"  {path.name}: {n_reps} reps, {len(segs)} candidate segments "
              f"({sum(1 for sg in labeled if sg['is_rep'])} labeled rep, "
              f"{sum(1 for sg in labeled if not sg['is_rep'])} noise) [{label_src}]")

        metadata = {
            "muscleGroup":   data.get("muscleGroup"),
            "equipmentType": data.get("equipmentType"),
            "mechanicType":  data.get("mechanicType"),
            "setNumber":     data.get("setNumber"),
        }

        for idx, seg in enumerate(labeled):
            try:
                feats = extract_segment_features(
                    idx, seg, signal_1d, timestamps, labeled, metadata
                )
                feats["is_rep"]       = int(seg["is_rep"])
                feats["recording_id"] = path.name
                rows.append(feats)
            except Exception as exc:
                print(f"  ERROR features {path.name} seg {idx}: {exc}")

    print(f"\n  Under-segmented (skipped): {skipped_under}")
    print(f"  No reps label   (skipped): {skipped_noreps}")
    return pd.DataFrame(rows), skipped_under_list


# ---------------------------------------------------------------------------
# Evaluation: leave-one-recording-out cross-validation
# ---------------------------------------------------------------------------

def loocv_by_recording(df: pd.DataFrame) -> tuple:
    """
    Leave-one-recording-out CV using LeaveOneGroupOut.

    Each fold holds out all segments from one recording so the classifier
    never sees correlated segments (from the same movement) at test time.

    Returns:
        seg_preds, seg_true           — segment-level binary predictions / labels
        rec_preds, rec_actual, rec_names — recording-level rep counts
    """
    X      = df[SEGMENT_FEATURE_COLS].values
    y      = df["is_rep"].values
    groups = df["recording_id"].values

    seg_preds, seg_true   = [], []
    rec_preds, rec_actual = [], []
    rec_names             = []

    logo = LeaveOneGroupOut()
    for train_idx, test_idx in logo.split(X, y, groups):
        clf = RandomForestClassifier(
            n_estimators=200, max_depth=6,
            class_weight="balanced", random_state=42,
        )
        clf.fit(X[train_idx], y[train_idx])

        probs     = clf.predict_proba(X[test_idx])[:, 1]
        preds_seg = (probs > 0.5).astype(int)
        seg_preds.extend(preds_seg.tolist())
        seg_true.extend(y[test_idx].tolist())

        test_groups = groups[test_idx]
        for rec in np.unique(test_groups):
            mask = test_groups == rec
            rec_preds.append(int(preds_seg[mask].sum()))
            rec_actual.append(int(y[test_idx][mask].sum()))
            rec_names.append(rec)

    return seg_preds, seg_true, rec_preds, rec_actual, rec_names


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("\n── Building segment dataset ────────────────────────────────────")
    df, skipped_under_list = build_segment_dataset()

    if len(df) == 0:
        sys.exit("No segments generated. Check that recordings/*.json have a 'reps' field.")

    n_recs  = df["recording_id"].nunique()
    n_rep   = int((df["is_rep"] == 1).sum())
    n_noise = int((df["is_rep"] == 0).sum())

    print(f"\n  Total segments : {len(df)}")
    print(f"  Recordings     : {n_recs}")
    print(f"  Rep segments   : {n_rep}")
    print(f"  Noise segments : {n_noise}")

    if len(df) < 10:
        sys.exit("Need at least 10 labeled segments. Add more recordings.")

    df.to_csv(OUTPUT_DIR / "features.csv", index=False)
    print("  Feature matrix saved → output/features.csv")

    # ── Leave-one-recording-out CV ──────────────────────────────────────
    print("\n── Leave-one-recording-out CV ──────────────────────────────────")
    seg_preds, seg_true, rec_preds, rec_actual, rec_names = loocv_by_recording(df)

    prec = precision_score(seg_true, seg_preds, zero_division=0)
    rec  = recall_score(seg_true,    seg_preds, zero_division=0)
    f1   = f1_score(seg_true,        seg_preds, zero_division=0)

    print(f"\n  Segment-level:")
    print(f"    Precision : {prec:.2f}")
    print(f"    Recall    : {rec:.2f}")
    print(f"    F1        : {f1:.2f}")

    col = 44
    print(f"\n  Recording-level:")
    print(f"  {'Recording':<{col}} {'True':>5} {'Pred':>5} {'Err':>5}")
    print(f"  {'─'*col} {'─'*5} {'─'*5} {'─'*5}")
    for name, true, pred in zip(rec_names, rec_actual, rec_preds):
        err    = pred - true
        marker = "  !" if err != 0 else ""
        print(f"  {name:<{col}} {true:>5} {pred:>5} {err:>+5}{marker}")

    mae   = mean_absolute_error(rec_actual, rec_preds)
    exact = sum(1 for t, p in zip(rec_actual, rec_preds) if t == p)
    print(f"\n  MAE:         {mae:.2f}")
    print(f"  Exact match: {exact}/{len(rec_actual)}  ({100*exact/len(rec_actual):.0f}%)")

    # ── Suspicious recordings report ────────────────────────────────────
    seg_counts = df.groupby("recording_id").size()
    rep_counts = df.groupby("recording_id")["is_rep"].sum()
    seg_rep_ratio = seg_counts / rep_counts.replace(0, 1)

    HIGH_RATIO  = 3.5   # too many noise candidates → unreliable pseudo-labels
    LOW_RATIO   = 1.3   # barely over-segmented → model has little room to separate
    LOOCV_ERR   = 3     # absolute LOOCV error threshold

    sus_lines = []

    sus_noisy = seg_rep_ratio[seg_rep_ratio > HIGH_RATIO].sort_values(ascending=False)
    if len(sus_noisy):
        sus_lines.append("── High candidate:rep ratio (> {:.1f}x) — unreliable pseudo-labels ──".format(HIGH_RATIO))
        for rid, ratio in sus_noisy.items():
            n_segs = int(seg_counts[rid])
            n_reps = int(rep_counts[rid])
            sus_lines.append(f"  {rid}  ({n_segs} segs / {n_reps} reps = {ratio:.1f}x)")

    sus_sparse = seg_rep_ratio[seg_rep_ratio < LOW_RATIO].sort_values()
    if len(sus_sparse):
        sus_lines.append("\n── Low candidate:rep ratio (< {:.1f}x) — barely over-segmented ──".format(LOW_RATIO))
        for rid, ratio in sus_sparse.items():
            n_segs = int(seg_counts[rid])
            n_reps = int(rep_counts[rid])
            sus_lines.append(f"  {rid}  ({n_segs} segs / {n_reps} reps = {ratio:.1f}x)")

    loocv_errors = [
        (name, true, pred, abs(pred - true))
        for name, true, pred in zip(rec_names, rec_actual, rec_preds)
        if abs(pred - true) >= LOOCV_ERR
    ]
    loocv_errors.sort(key=lambda x: -x[3])
    if loocv_errors:
        sus_lines.append(f"\n── Large LOOCV error (|err| >= {LOOCV_ERR}) ──")
        for name, true, pred, err in loocv_errors:
            sus_lines.append(f"  {name}  true={true}  pred={pred}  err={pred - true:+d}")

    if skipped_under_list:
        sus_lines.append("\n── Skipped (under-segmented) ──")
        for s in skipped_under_list:
            sus_lines.append(f"  {s['name']}  ({s['n_segs']} segs < {s['n_reps']} reps)")

    sus_path = OUTPUT_DIR / "sus_data.txt"
    if sus_lines:
        sus_path.write_text("\n".join(sus_lines) + "\n")
        print(f"\n── Suspicious recordings → output/sus_data.txt ({len(sus_noisy) + len(sus_sparse) + len(loocv_errors) + len(skipped_under_list)} flagged)")
    else:
        sus_path.write_text("No suspicious recordings detected.\n")
        print("\n── No suspicious recordings detected.")

    # ── Train final classifier on ALL data ──────────────────────────────
    print("\n── Training final classifier on all data ───────────────────────")
    X_all = df[SEGMENT_FEATURE_COLS].values
    y_all = df["is_rep"].values

    clf = RandomForestClassifier(
        n_estimators=200, max_depth=6,
        class_weight="balanced", random_state=42,
    )
    clf.fit(X_all, y_all)

    # ── Feature importances ─────────────────────────────────────────────
    print("\n── Feature importances (top 15) ────────────────────────────────")
    ranked = sorted(
        zip(SEGMENT_FEATURE_COLS, clf.feature_importances_), key=lambda x: -x[1]
    )
    for feat, imp in ranked[:15]:
        bar = "█" * int(imp * 60)
        print(f"  {feat:<32} {imp:.3f}  {bar}")

    # ── Save model.pkl ──────────────────────────────────────────────────
    pkl_path = OUTPUT_DIR / "model.pkl"
    with open(pkl_path, "wb") as f:
        pickle.dump({"model": clf, "feature_cols": SEGMENT_FEATURE_COLS}, f)
    print(f"\n── Saved → output/model.pkl")

    # ── Export to JavaScript ────────────────────────────────────────────
    raw_js   = m2c.export_to_javascript(clf, function_name="classifySegment")
    minified = " ".join(line.strip() for line in raw_js.splitlines() if line.strip())
    feat_list = ", ".join(SEGMENT_FEATURE_COLS)

    js_path = OUTPUT_DIR / "model.js"
    js_path.write_text(
        "// @ts-nocheck\n"
        "/* eslint-disable */\n"
        "/*\n"
        " * auto-generated by train.py — do not edit.\n"
        " * classifySegment(input) returns [prob_noise, prob_rep].\n"
        " * Usage: classifySegment(features)[1] > 0.5  →  is a real rep.\n"
        f" * Input order ({len(SEGMENT_FEATURE_COLS)} features): {feat_list}\n"
        " */\n"
        + minified
        + "\nexport{classifySegment};\n"
    )
    print(f"── Saved → output/model.js")

    # ── Summary report ──────────────────────────────────────────────────
    summary_lines = [
        "Training summary (Segment-and-Score)",
        "=" * 40,
        f"Recordings     : {n_recs}",
        f"Total segments : {len(df)}",
        f"Rep segments   : {n_rep}",
        f"Noise segments : {n_noise}",
        "",
        "LOOCV — Segment-level:",
        f"  Precision : {prec:.2f}",
        f"  Recall    : {rec:.2f}",
        f"  F1        : {f1:.2f}",
        "",
        "LOOCV — Recording-level:",
        f"  MAE         : {mae:.2f}",
        f"  Exact match : {exact}/{len(rec_actual)} ({100*exact/len(rec_actual):.0f}%)",
        "",
        f"Feature order ({len(SEGMENT_FEATURE_COLS)} features):",
        *[f"  {i:>2}: {name}" for i, name in enumerate(SEGMENT_FEATURE_COLS)],
    ]
    (OUTPUT_DIR / "summary.txt").write_text("\n".join(summary_lines))
    print(f"── Saved → output/summary.txt\n")


if __name__ == "__main__":
    main()
