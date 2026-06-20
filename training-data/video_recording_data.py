from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import numpy as np

from ble_dead_reckoning import compute_position

MAX_POINTS = 4000
GENERATED_VIDEO_NAMES = {"combined.mp4"}


@dataclass(frozen=True)
class RecordingPair:
    json_path: Path
    mp4_path: Path


@dataclass(frozen=True)
class PreparedVideoRecording:
    folder: Path
    json_path: Path
    mp4_path: Path
    data: dict
    n_reps: int
    rep_markers: list
    timestamps: np.ndarray
    timestamps_list: list[float]
    t_rel_sec: list[float]
    channels: dict[str, list[float]]
    data_duration_s: float
    started_at_ms: int
    meta: str


class RecordingPrepError(Exception):
    def __init__(
        self,
        status: str,
        message: str,
        *,
        n_reps: int = 0,
        n_markers: int = 0,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.message = message
        self.n_reps = n_reps
        self.n_markers = n_markers


def meta_str(data: dict) -> str:
    parts = []
    if data.get("exerciseName"):
        parts.append(data["exerciseName"])
    if data.get("muscleGroup"):
        parts.append(f'muscle: {data["muscleGroup"]}')
    if data.get("equipmentType"):
        parts.append(f'equip: {data["equipmentType"]}')
    if data.get("mechanicType"):
        parts.append(f'mechanic: {data["mechanicType"]}')
    if data.get("setNumber"):
        parts.append(f'set {data["setNumber"]}')
    reps = data.get("reps")
    if reps is not None:
        parts.append(f"{reps} reps expected")
    return " / ".join(parts) if parts else "no metadata"


def find_recording_pair(folder: Path) -> RecordingPair:
    json_files = sorted(folder.glob("*.json"))
    mp4_files = sorted(
        p for p in folder.glob("*.mp4") if p.name not in GENERATED_VIDEO_NAMES
    )

    if not json_files:
        raise RecordingPrepError("missing_files", f"  SKIP (no .json): {folder.name}")
    if not mp4_files:
        raise RecordingPrepError("missing_files", f"  SKIP (no source .mp4): {folder.name}")
    if len(json_files) > 1:
        names = ", ".join(p.name for p in json_files)
        raise RecordingPrepError(
            "ambiguous_files",
            f"  SKIP (multiple .json files: {names}): {folder.name}",
        )
    if len(mp4_files) > 1:
        names = ", ".join(p.name for p in mp4_files)
        raise RecordingPrepError(
            "ambiguous_files",
            f"  SKIP (multiple source .mp4 files: {names}): {folder.name}",
        )

    return RecordingPair(json_path=json_files[0], mp4_path=mp4_files[0])


def build_chart_channels(
    samples_sorted: list,
    *,
    max_points: int = MAX_POINTS,
) -> tuple[np.ndarray, list[float], dict[str, list[float]]]:
    dr = compute_position(samples_sorted)
    timestamps_full = dr["timestamps_ms"]
    position_full = dr["position_m"]

    if len(samples_sorted) > max_points:
        idx = np.round(np.linspace(0, len(samples_sorted) - 1, max_points)).astype(int)
        samples_keep = [samples_sorted[i] for i in idx]
        timestamps = timestamps_full[idx]
        position_keep = position_full[idx]
    else:
        samples_keep = samples_sorted
        timestamps = timestamps_full
        position_keep = position_full

    channels = {
        "pos.x (m)": [round(float(v), 6) for v in position_keep[:, 0]],
        "pos.y (m)": [round(float(v), 6) for v in position_keep[:, 1]],
        "pos.z (m)": [round(float(v), 6) for v in position_keep[:, 2]],
    }
    for kind in ("accel", "gyro", "angle"):
        for axis in ("x", "y", "z"):
            channels[f"{kind}.{axis}"] = [
                round(float(s[kind][axis]), 6) for s in samples_keep
            ]

    channels["accel.|a|"] = [
        round(float(np.linalg.norm([s["accel"]["x"], s["accel"]["y"], s["accel"]["z"]])), 6)
        for s in samples_keep
    ]

    timestamps_list = [round(float(t), 1) for t in timestamps]
    return timestamps, timestamps_list, channels


def started_at_ms_or_first_sample(data: dict, timestamps: np.ndarray) -> int:
    started_at_str = data.get("startedAt")
    if started_at_str:
        return int(
            datetime.fromisoformat(started_at_str.replace("Z", "+00:00")).timestamp()
            * 1000
        )
    return int(timestamps[0])


def prepare_video_recording(folder: Path) -> PreparedVideoRecording:
    pair = find_recording_pair(folder)

    with open(pair.json_path) as f:
        data = json.load(f)

    samples = data.get("samples", [])
    n_reps = int(data.get("reps", 0))
    rep_markers = data.get("repMarkers", [])

    if len(samples) < 20:
        raise RecordingPrepError(
            "too_short",
            f"  SKIP (too short - {len(samples)} samples): {folder.name}",
            n_reps=n_reps,
            n_markers=len(rep_markers),
        )

    samples_sorted = sorted(samples, key=lambda s: s["timestamp"])
    timestamps, timestamps_list, channels = build_chart_channels(samples_sorted)
    started_at_ms = started_at_ms_or_first_sample(data, timestamps)

    return PreparedVideoRecording(
        folder=folder,
        json_path=pair.json_path,
        mp4_path=pair.mp4_path,
        data=data,
        n_reps=n_reps,
        rep_markers=rep_markers,
        timestamps=timestamps,
        timestamps_list=timestamps_list,
        t_rel_sec=[(float(t) - started_at_ms) / 1000 for t in timestamps],
        channels=channels,
        data_duration_s=round((timestamps[-1] - timestamps[0]) / 1000.0, 3),
        started_at_ms=started_at_ms,
        meta=meta_str(data),
    )
