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
    raw-data/*.json  — motion recordings with a 'repMarkers' field (mandatory: the
                       total rep count is derived from len(repMarkers), never stored
                       separately)

One classifier is trained per exercise mechanic type (compound, isolation,
cardio, ...) plus a "general" classifier pooled across all recordings. A
mechanic type only gets its own dedicated classifier once it has enough
labeled recordings (see MIN_RECORDINGS_PER_MECHANIC /
MIN_SEGMENTS_PER_CLASS_MECHANIC below); until then it falls back to the
general classifier both at export time (a thin JS re-export, see
_write_fallback_js) and at predict.py inference time.

Output:
    output/features.csv        — per-segment feature matrix (for inspection)
    output/models/manifest.json — which mechanic types got a dedicated model
    output/models/model_<name>.pkl — trained classifier (used by predict.py)
                                      <name> is "general" or a mechanic type
    output/models/model_<name>.js  — same classifier as a JS function (for app)
    output/summary.txt         — evaluation report
"""

import json
import pickle
import sys
from datetime import datetime, timezone
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
RECORDINGS_DIR = ROOT / "raw-data"
OUTPUT_DIR     = ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
MODELS_DIR     = OUTPUT_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Over-segmentation constants
# ---------------------------------------------------------------------------
OVER_SEG_PROMINENCE_FRAC = 0.03  # 3 % of signal range — deliberately sensitive
MIN_SEG_DURATION_MS      = 300   # discard sub-300 ms micro-movements
MIN_HALF_REP_MS          = 150   # minimum half-rep (sets peak/valley min_distance)

# ---------------------------------------------------------------------------
# Per-mechanic-type model thresholds
# ---------------------------------------------------------------------------
# A mechanic type only gets its own dedicated classifier once it clears both
# bars below; otherwise it falls back to the general (pooled) classifier.
# Requiring >=3 recordings also guarantees LeaveOneGroupOut has >=3 groups,
# so a within-group LOOCV report is always possible for a dedicated model.
MIN_RECORDINGS_PER_MECHANIC     = 3
MIN_SEGMENTS_PER_CLASS_MECHANIC = 15

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

    # Plain (non-one-hot) mechanic type, used to group segments by mechanic
    # type when training per-mechanic-type models. Not part of
    # SEGMENT_FEATURE_COLS — every model (general or per-mechanic) is still
    # trained on the full one-hot feature vector, so a dedicated per-type
    # model's mechanic_* columns are simply constant within that subset.
    feats["mechanic_type"] = mt

    return feats


# ---------------------------------------------------------------------------
# Step 4 — Labelling from manual rep markers
# ---------------------------------------------------------------------------

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

def build_segment_dataset() -> pd.DataFrame:
    """
    Iterate all recordings that have repMarkers, label segments via IoU matching,
    and extract features. Returns a DataFrame where each row is one candidate segment.

    Recordings without a non-empty 'repMarkers' field are skipped — repMarkers is the
    only required label; the total rep count is derived from len(repMarkers).
    """
    rows              = []
    skipped_nomarkers = 0

    for path in sorted(RECORDINGS_DIR.glob("*.json")):
        with open(path) as f:
            data = json.load(f)

        rep_markers = data.get("repMarkers")
        if not rep_markers:
            skipped_nomarkers += 1
            print(f"  SKIP (no repMarkers): {path.name}")
            continue

        n_reps  = len(rep_markers)
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

        labeled   = label_segments_from_markers(segs, rep_markers)
        label_src = f"manual ({n_reps} markers)"

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

    print(f"\n  No repMarkers (skipped): {skipped_nomarkers}")
    return pd.DataFrame(rows)


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
# Per-model training / export helpers
# ---------------------------------------------------------------------------

def _fit_classifier(df: pd.DataFrame) -> RandomForestClassifier:
    clf = RandomForestClassifier(
        n_estimators=200, max_depth=6,
        class_weight="balanced", random_state=42,
    )
    clf.fit(df[SEGMENT_FEATURE_COLS].values, df["is_rep"].values)
    return clf


def _export_classifier(clf: RandomForestClassifier, name: str) -> None:
    """Save `clf` as output/models/model_<name>.pkl and .js (via m2cgen)."""
    pkl_path = MODELS_DIR / f"model_{name}.pkl"
    with open(pkl_path, "wb") as f:
        pickle.dump({"model": clf, "feature_cols": SEGMENT_FEATURE_COLS}, f)

    raw_js    = m2c.export_to_javascript(clf, function_name="classifySegment")
    minified  = " ".join(line.strip() for line in raw_js.splitlines() if line.strip())
    feat_list = ", ".join(SEGMENT_FEATURE_COLS)

    js_path = MODELS_DIR / f"model_{name}.js"
    js_path.write_text(
        "// @ts-nocheck\n"
        "/* eslint-disable */\n"
        "/*\n"
        " * auto-generated by train.py — do not edit.\n"
        f" * Mechanic type: {name}\n"
        " * classifySegment(input) returns [prob_noise, prob_rep].\n"
        " * Usage: classifySegment(features)[1] > 0.5  →  is a real rep.\n"
        f" * Input order ({len(SEGMENT_FEATURE_COLS)} features): {feat_list}\n"
        " */\n"
        + minified
        + "\nexport{classifySegment};\n"
    )
    print(f"  {name:<12} → output/models/model_{name}.pkl, model_{name}.js")


def _write_fallback_js(name: str, reason: str) -> None:
    """Write a thin JS re-export of the general model for a mechanic type
    that doesn't (yet) have enough data for its own dedicated classifier."""
    js_path = MODELS_DIR / f"model_{name}.js"
    js_path.write_text(
        "// @ts-nocheck\n"
        "/* eslint-disable */\n"
        "/*\n"
        " * auto-generated by train.py — do not edit.\n"
        f" * No dedicated model for mechanic type \"{name}\" ({reason}).\n"
        " * Falls back to the general (all-exercise) model. Re-run train.py\n"
        " * once raw-data/ has enough labeled recordings for this type.\n"
        " */\n"
        "import { classifySegment } from './model_general.js';\n"
        "export { classifySegment };\n"
    )
    print(f"  {name:<12} → fallback to general ({reason})")


def _train_and_export_by_mechanic(df: pd.DataFrame) -> list:
    """
    Train the general (pooled) classifier, then one dedicated classifier per
    mechanic type that has enough labeled data (see MIN_RECORDINGS_PER_MECHANIC /
    MIN_SEGMENTS_PER_CLASS_MECHANIC). Mechanic types without enough data get a
    thin JS file that re-exports the general classifier instead.

    Returns a list of per-mechanic-type report rows for the summary/manifest.
    """
    # ── General (pooled) model — always trained, used as the fallback ──────
    clf_general = _fit_classifier(df)
    _export_classifier(clf_general, "general")

    print("\n  Feature importances (general model, top 15):")
    ranked = sorted(
        zip(SEGMENT_FEATURE_COLS, clf_general.feature_importances_), key=lambda x: -x[1]
    )
    for feat, imp in ranked[:15]:
        bar = "█" * int(imp * 60)
        print(f"    {feat:<32} {imp:.3f}  {bar}")

    # ── Per-mechanic-type models ────────────────────────────────────────────
    report: list = []
    trained_types: list = []

    for mt in MECHANIC_TYPES:
        subset = df[df["mechanic_type"] == mt]
        n_recs   = subset["recording_id"].nunique()
        n_rep    = int((subset["is_rep"] == 1).sum())
        n_noise  = int((subset["is_rep"] == 0).sum())

        row = {
            "mechanicType": mt,
            "recordings":   int(n_recs),
            "repSegments":  n_rep,
            "noiseSegments": n_noise,
        }

        has_enough_data = (
            n_recs >= MIN_RECORDINGS_PER_MECHANIC
            and n_rep >= MIN_SEGMENTS_PER_CLASS_MECHANIC
            and n_noise >= MIN_SEGMENTS_PER_CLASS_MECHANIC
        )

        if not has_enough_data:
            reason = (
                f"only {n_recs} recording(s), {n_rep} rep / {n_noise} noise segments — "
                f"needs >={MIN_RECORDINGS_PER_MECHANIC} recordings and "
                f">={MIN_SEGMENTS_PER_CLASS_MECHANIC} segments per class"
            )
            _write_fallback_js(mt, reason)
            row["status"] = "fallback"
            row["reason"] = reason
            report.append(row)
            continue

        seg_preds, seg_true, rec_preds, rec_actual, _ = loocv_by_recording(subset)
        mt_prec = precision_score(seg_true, seg_preds, zero_division=0)
        mt_rec  = recall_score(seg_true, seg_preds, zero_division=0)
        mt_f1   = f1_score(seg_true, seg_preds, zero_division=0)
        mt_mae  = mean_absolute_error(rec_actual, rec_preds)
        print(
            f"  {mt:<12} LOOCV: precision={mt_prec:.2f} recall={mt_rec:.2f} "
            f"f1={mt_f1:.2f} MAE={mt_mae:.2f} ({n_recs} recordings)"
        )

        clf_mt = _fit_classifier(subset)
        _export_classifier(clf_mt, mt)
        trained_types.append(mt)

        row.update({
            "status": "trained",
            "precision": mt_prec,
            "recall": mt_rec,
            "f1": mt_f1,
            "mae": mt_mae,
        })
        report.append(row)

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "featureCols": SEGMENT_FEATURE_COLS,
        "mechanicTypes": MECHANIC_TYPES,
        "trainedMechanicTypes": trained_types,
        "perMechanicType": report,
    }
    (MODELS_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"\n  Dedicated models trained for: {trained_types or '(none — all fall back to general)'}")
    print(f"  → output/models/manifest.json")

    return report


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("\n── Building segment dataset ────────────────────────────────────")
    df = build_segment_dataset()

    if len(df) == 0:
        sys.exit("No segments generated. Check that raw-data/*.json have a 'repMarkers' field.")

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

    sus_path = OUTPUT_DIR / "sus_data.txt"
    if sus_lines:
        sus_path.write_text("\n".join(sus_lines) + "\n")
        print(f"\n── Suspicious recordings → output/sus_data.txt ({len(sus_noisy) + len(sus_sparse) + len(loocv_errors)} flagged)")
    else:
        sus_path.write_text("No suspicious recordings detected.\n")
        print("\n── No suspicious recordings detected.")

    # ── Train + export one classifier per mechanic type, plus general ──────
    print("\n── Training per-mechanic-type classifiers ──────────────────────")
    mechanic_report = _train_and_export_by_mechanic(df)

    # ── Summary report ──────────────────────────────────────────────────
    summary_lines = [
        "Training summary (Segment-and-Score)",
        "=" * 40,
        f"Recordings     : {n_recs}",
        f"Total segments : {len(df)}",
        f"Rep segments   : {n_rep}",
        f"Noise segments : {n_noise}",
        "",
        "LOOCV (pooled) — Segment-level:",
        f"  Precision : {prec:.2f}",
        f"  Recall    : {rec:.2f}",
        f"  F1        : {f1:.2f}",
        "",
        "LOOCV (pooled) — Recording-level:",
        f"  MAE         : {mae:.2f}",
        f"  Exact match : {exact}/{len(rec_actual)} ({100*exact/len(rec_actual):.0f}%)",
        "",
        f"Feature order ({len(SEGMENT_FEATURE_COLS)} features):",
        *[f"  {i:>2}: {name}" for i, name in enumerate(SEGMENT_FEATURE_COLS)],
        "",
        "Per-mechanic-type models:",
        *[
            f"  {row['mechanicType']:<12} {row['status']:<10} "
            f"recordings={row['recordings']:>3} rep_segs={row['repSegments']:>4} "
            f"noise_segs={row['noiseSegments']:>4}"
            + (f"  MAE={row['mae']:.2f}" if row.get("mae") is not None else "")
            for row in mechanic_report
        ],
    ]
    (OUTPUT_DIR / "summary.txt").write_text("\n".join(summary_lines))
    print(f"── Saved → output/summary.txt\n")


if __name__ == "__main__":
    main()
