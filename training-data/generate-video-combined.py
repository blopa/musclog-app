#!/usr/bin/env python3
"""
Combine a recording's video and IMU charts into a single video.

For each subfolder in recordings/:
  - Reads the .json sensor data and .mp4 video file.
  - Pre-renders two IMU charts (orientation + acceleration) with rep marker bands.
  - For each video frame, draws an orange cursor on the charts at the matching time.
  - Overlays charts semi-transparently on the top and bottom of the video frame.
  - Output size matches the original video dimensions (no extra height added).
  - Writes recordings/<folder>/combined.mp4

Layout (within the original video height):
    ┌────────────────┐
    │  Orientation   │  ← overlaid on top third
    │                │
    │ (video frame)  │
    │                │
    │  Acceleration  │  ← overlaid on bottom third
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
from pathlib import Path

import numpy as np
import cv2
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

SCRIPT_DIR     = Path(__file__).parent
RECORDINGS_DIR = SCRIPT_DIR / "recordings"

sys.path.insert(0, str(SCRIPT_DIR))

from video_recording_data import RecordingPrepError, prepare_video_recording  # noqa: E402

DPI        = 100
CHART_W    = 640   # output pixels per chart (width)
CHART_H    = 360   # output pixels per chart (height)
OUTPUT_VIDEO_NAME = "combined.mp4"

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
    ax.tick_params(left=False, bottom=False, labelleft=False, labelbottom=False)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.grid(False)

    t_arr  = np.asarray(t_rel_sec)
    t_min  = float(t_arr[0])
    t_max  = float(t_arr[-1])

    for marker in rep_markers:
        try:
            start_sec = (float(marker["startMs"]) - t0) / 1000
            end_sec = (float(marker["endMs"]) - t0) / 1000
        except (KeyError, TypeError, ValueError):
            continue
        if end_sec < start_sec:
            start_sec, end_sec = end_sec, start_sec
        if end_sec < t_min or start_sec > t_max:
            continue
        ax.axvspan(
            max(start_sec, t_min),
            min(end_sec, t_max),
            color="#2563eb",
            alpha=0.20,
            linewidth=0,
            zorder=1,
        )

    for name, color in config["channels"]:
        if name in channels:
            ax.plot(t_arr, channels[name],
                    color=_hex_to_mpl(color), linewidth=0.9, zorder=2)

    ax.set_xlim(t_min, t_max)

    fig.tight_layout(rect=[0, 0, 1, 1], pad=0.2)
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


def process_folder(folder: Path) -> None:
    try:
        recording = prepare_video_recording(folder)
    except RecordingPrepError as err:
        print(err.message)
        return

    out_path = folder / OUTPUT_VIDEO_NAME

    # Pre-render static chart images
    print(f"  Rendering chart bases…", end=" ", flush=True)
    chart_bases = []
    chart_metas = []
    for cfg in CHART_CONFIGS:
        base, bbox, t_min, t_max = render_chart_base(
            recording.channels,
            recording.t_rel_sec,
            recording.rep_markers,
            recording.started_at_ms,
            cfg,
        )
        chart_bases.append(base)
        chart_metas.append((bbox, t_min, t_max))
    print("done.")

    # Open source video
    cap = cv2.VideoCapture(str(recording.mp4_path))
    if not cap.isOpened():
        print(f"  ERROR: cannot open {recording.mp4_path}")
        return

    src_fps  = cap.get(cv2.CAP_PROP_FPS) or 30.0
    src_w    = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    src_h    = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    if src_w <= 0 or src_h <= 0:
        print(f"  ERROR: invalid source video dimensions ({src_w}×{src_h})")
        cap.release()
        return

    # Keep the source dimensions; charts are overlaid inside the original frame.
    out_w           = src_w
    out_h           = src_h
    chart_overlay_h = max(1, out_h // 3)  # each chart occupies ~1/3 of the frame height
    chart_alpha     = 0.75           # chart opacity (0=invisible, 1=opaque)

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

        if frame.shape[1] != out_w or frame.shape[0] != out_h:
            video_row = cv2.resize(frame, (out_w, out_h))
        else:
            video_row = frame.copy()

        # Resize chart panels to overlay height
        top_chart    = cv2.resize(chart_panels[0], (out_w, chart_overlay_h))
        bottom_chart = cv2.resize(chart_panels[1], (out_w, chart_overlay_h))

        # Blend orientation chart onto top of the video frame
        video_row[:chart_overlay_h] = cv2.addWeighted(
            top_chart, chart_alpha,
            video_row[:chart_overlay_h], 1.0 - chart_alpha,
            0,
        )
        # Blend acceleration chart onto bottom of the video frame
        video_row[out_h - chart_overlay_h:] = cv2.addWeighted(
            bottom_chart, chart_alpha,
            video_row[out_h - chart_overlay_h:], 1.0 - chart_alpha,
            0,
        )

        writer.write(video_row)
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
