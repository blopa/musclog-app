#!/usr/bin/env python3
"""
Combine a recording's video and IMU charts into a single side-by-side video.

For each subfolder in recordings/:
  - Reads the .json sensor data and .mp4 video file.
  - Pre-renders two IMU charts (orientation + acceleration) with rep marker bands.
  - For each video frame, draws an orange cursor on the charts at the matching time.
  - Composites [orientation chart / video / acceleration chart] stacked vertically.
  - Writes recordings/<folder>/combined.mp4

Layout:
    ┌────────────────┐
    │  Orientation   │
    ├────────────────┤
    │     video      │
    ├────────────────┤
    │  Acceleration  │
    └────────────────┘

Dependencies (add to requirements.txt):
    opencv-python
    matplotlib

Usage:
    python generate-video-combined.py                            # all subfolders
    python generate-video-combined.py recordings/h98h9e8th94/   # specific folder(s)
"""

import io
import sys
import json
import numpy as np
import cv2
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pathlib import Path
from datetime import datetime

SCRIPT_DIR     = Path(__file__).parent
RECORDINGS_DIR = SCRIPT_DIR / "recordings"

sys.path.insert(0, str(SCRIPT_DIR))
from ble_dead_reckoning import compute_position  # noqa: E402

MAX_POINTS = 4000
DPI        = 100
CHART_W    = 640   # output pixels per chart (width)
CHART_H    = 360   # output pixels per chart (height)

# Colour palette mirrors the HTML/Plotly charts
CHART_CONFIGS = [
    {
        "title":    "Orientation (angle)",
        "ylabel":   "Angle (deg)",
        "channels": [
            ("angle.x",   "#fb923c"),
            ("angle.y",   "#facc15"),
            ("angle.z",   "#84cc16"),
        ],
    },
    {
        "title":    "Acceleration",
        "ylabel":   "Accel (g)",
        "channels": [
            ("accel.x",   "#60a5fa"),
            ("accel.y",   "#818cf8"),
            ("accel.z",   "#a78bfa"),
            ("accel.|a|", "#e5e7eb"),
        ],
    },
]


# ---------------------------------------------------------------------------
# Chart rendering helpers
# ---------------------------------------------------------------------------

def _hex_to_mpl(h: str) -> tuple:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))


def render_chart_base(
    channels: dict,
    t_rel_sec: list,
    rep_markers: list,
    t0: float,
    config: dict,
) -> tuple:
    """
    Render a static chart image (traces + rep bands, no cursor).

    Returns:
        img_bgr  – numpy uint8 array of shape (CHART_H, CHART_W, 3)
        bbox     – matplotlib Bbox of the axes in figure-pixel coords
                   (bottom-left origin, as matplotlib returns)
        t_min    – leftmost x value (seconds)
        t_max    – rightmost x value (seconds)
    """
    fig = plt.figure(figsize=(CHART_W / DPI, CHART_H / DPI), dpi=DPI)
    fig.patch.set_facecolor("#161b22")

    ax = fig.add_subplot(111)
    ax.set_facecolor("#0d1117")
    ax.tick_params(colors="#c9d1d9", labelsize=9)
    for spine in ax.spines.values():
        spine.set_edgecolor("#374151")
    ax.grid(True, color="#1f2937", linewidth=0.5)
    ax.set_xlabel("Time (s)", color="#c9d1d9", fontsize=9)
    ax.set_ylabel(config["ylabel"], color="#c9d1d9", fontsize=9)
    ax.set_title(config["title"], color="#d1d5db", fontsize=10, pad=4)

    t_arr  = np.asarray(t_rel_sec)
    t_min  = float(t_arr[0])
    t_max  = float(t_arr[-1])

    for name, color in config["channels"]:
        if name in channels:
            ax.plot(t_arr, channels[name],
                    color=_hex_to_mpl(color), linewidth=0.9, label=name)

    # Rep marker bands (matching the blue from the HTML viewer)
    for m in rep_markers:
        x0 = (m["startMs"] - t0) / 1000
        x1 = (m["endMs"]   - t0) / 1000
        ax.axvspan(x0, x1, alpha=0.2, color="#2563eb", zorder=0)

    ax.set_xlim(t_min, t_max)

    ax.legend(
        loc="lower center", bbox_to_anchor=(0.5, -0.32),
        ncol=len(config["channels"]), fontsize=8,
        facecolor="#1a1f2b", edgecolor="#374151",
        labelcolor="#c9d1d9", framealpha=0.8,
    )

    fig.tight_layout(rect=[0, 0.1, 1, 1])
    fig.canvas.draw()

    bbox = ax.get_window_extent(renderer=fig.canvas.get_renderer())

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=DPI, bbox_inches=None)
    buf.seek(0)
    arr = np.frombuffer(buf.getvalue(), dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    plt.close(fig)

    return img, bbox, t_min, t_max


def draw_cursor(
    base_img: np.ndarray,
    t_sec: float,
    bbox,
    t_min: float,
    t_max: float,
) -> np.ndarray:
    """
    Return a copy of base_img with an orange vertical cursor line at t_sec.

    matplotlib bbox uses bottom-left origin; cv2 uses top-left — we flip y.
    """
    img = base_img.copy()
    if t_max <= t_min:
        return img

    frac  = max(0.0, min(1.0, (t_sec - t_min) / (t_max - t_min)))
    x_px  = int(round(bbox.x0 + frac * bbox.width))
    img_h = base_img.shape[0]
    y_top = int(round(img_h - bbox.y1))
    y_bot = int(round(img_h - bbox.y0))

    # Orange #f97316 in BGR
    cv2.line(img, (x_px, y_top), (x_px, y_bot), (22, 115, 249), 2,
             lineType=cv2.LINE_AA)
    return img


# ---------------------------------------------------------------------------
# Per-folder processing
# ---------------------------------------------------------------------------

def find_pair(folder: Path):
    """Return (json_path, mp4_path) or None if either is missing."""
    json_files = list(folder.glob("*.json"))
    mp4_files  = list(folder.glob("*.mp4"))
    if not json_files:
        print(f"  SKIP (no .json): {folder.name}")
        return None
    if not mp4_files:
        print(f"  SKIP (no .mp4): {folder.name}")
        return None
    if len(json_files) > 1:
        print(f"  WARN (multiple .json, using first): {folder.name}")
    if len(mp4_files) > 1:
        print(f"  WARN (multiple .mp4, using first): {folder.name}")
    return json_files[0], mp4_files[0]


def process_folder(folder: Path) -> None:
    pair = find_pair(folder)
    if pair is None:
        return

    json_path, mp4_path = pair
    out_path = folder / "combined.mp4"

    with open(json_path) as f:
        data = json.load(f)

    samples = data.get("samples", [])
    if len(samples) < 20:
        print(f"  SKIP (too short — {len(samples)} samples): {folder.name}")
        return

    samples_sorted = sorted(samples, key=lambda s: s["timestamp"])
    rep_markers    = data.get("repMarkers", [])

    # Dead-reckoning
    dr              = compute_position(samples_sorted)
    timestamps_full = dr["timestamps_ms"]
    position_full   = dr["position_m"]   # (N, 3)

    # Downsample for chart rendering
    if len(samples_sorted) > MAX_POINTS:
        idx           = np.round(np.linspace(0, len(samples_sorted) - 1, MAX_POINTS)).astype(int)
        samples_keep  = [samples_sorted[i] for i in idx]
        timestamps    = timestamps_full[idx]
        position_keep = position_full[idx]
    else:
        samples_keep  = samples_sorted
        timestamps    = timestamps_full
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

    # t0 = wall-clock ms of recording start → chart x-axis origin = video t=0
    started_at_str = data.get("startedAt")
    if started_at_str:
        t0 = int(
            datetime.fromisoformat(started_at_str.replace("Z", "+00:00")).timestamp() * 1000
        )
    else:
        t0 = int(timestamps[0])

    t_rel_sec = [(float(t) - t0) / 1000 for t in timestamps]

    # Pre-render static chart images
    print(f"  Rendering chart bases…", end=" ", flush=True)
    chart_bases = []
    chart_metas = []
    for cfg in CHART_CONFIGS:
        base, bbox, t_min, t_max = render_chart_base(
            channels, t_rel_sec, rep_markers, t0, cfg
        )
        chart_bases.append(base)
        chart_metas.append((bbox, t_min, t_max))
    print("done.")

    # Open source video
    cap = cv2.VideoCapture(str(mp4_path))
    if not cap.isOpened():
        print(f"  ERROR: cannot open {mp4_path}")
        return

    src_fps  = cap.get(cv2.CAP_PROP_FPS) or 30.0
    src_w    = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    src_h    = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Output dimensions — everything is stacked vertically at a common width
    # (CHART_W). The video is scaled to that width, preserving aspect ratio.
    out_w    = CHART_W
    video_h  = int(round(src_h * (CHART_W / src_w))) if src_w else src_h
    out_h    = CHART_H * len(CHART_CONFIGS) + video_h

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_path), fourcc, src_fps, (out_w, out_h))
    if not writer.isOpened():
        print(f"  ERROR: VideoWriter failed to open (codec mp4v not available?)")
        cap.release()
        return

    print(f"  Compositing {n_frames} frames ({src_w}×{src_h} @ {src_fps:.1f} fps) "
          f"→ {out_path.name}  ", end="", flush=True)

    frame_idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break

        t_sec = frame_idx / src_fps

        # Draw cursor on each chart: CHART_CONFIGS = [orientation, acceleration]
        chart_panels = [
            draw_cursor(base, t_sec, bbox, t_min, t_max)
            for base, (bbox, t_min, t_max) in zip(chart_bases, chart_metas)
        ]

        # Scale the video frame to the common width, then stack:
        #   orientation chart / video / acceleration chart
        video_row = cv2.resize(frame, (out_w, video_h))
        writer.write(np.vstack([chart_panels[0], video_row, chart_panels[1]]))
        frame_idx += 1

        if frame_idx % max(1, n_frames // 20) == 0:
            pct = frame_idx / max(1, n_frames) * 100
            print(f"{pct:.0f}%…", end=" ", flush=True)

    cap.release()
    writer.release()
    print(f"\n  → {out_path}  ({frame_idx} frames written)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if len(sys.argv) > 1:
        folders = [Path(a).resolve() for a in sys.argv[1:]]
    else:
        if not RECORDINGS_DIR.exists():
            print(f"ERROR: recordings directory not found: {RECORDINGS_DIR}")
            sys.exit(1)
        folders = sorted(p for p in RECORDINGS_DIR.iterdir() if p.is_dir())

    if not folders:
        print("No recording folders found.")
        sys.exit(0)

    print(f"\n── Generating combined videos ({len(folders)} folders) ──────────")
    for folder in folders:
        if not folder.is_dir():
            print(f"  NOT A DIRECTORY: {folder}")
            continue
        print(f"\n{folder.name}")
        process_folder(folder)

    print("\nDone.\n")


if __name__ == "__main__":
    main()
