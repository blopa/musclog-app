#!/usr/bin/env python3
"""
Generate video-synced interactive HTML pages for annotating rep boundaries.

For each subfolder in recordings/:
  1. Finds the .json recording and .mp4 video file.
  2. Plots all 9 raw sensor channels (accel/gyro/angle × x/y/z) — no filter, no PCA.
  3. Generates a standalone index.html with a synced video player + Plotly chart.

Workflow:
  - Press S (or click "Mark Start") to capture rep start at current video time.
  - Press E (or click "Mark End") to capture rep end, adding the marker.
  - Click on the chart to seek the video to that position.
  - The orange cursor line tracks video playback in real time.
  - Download buttons export repMarkers.json or the full updated JSON.

Also generates recordings/index.html listing all subfolders and their annotation status.

Usage:
    python generate-video-markers.py                            # all subfolders
    python generate-video-markers.py recordings/h98h9e8th94/   # specific folder(s)
"""

import json
import sys
from pathlib import Path

import numpy as np

SCRIPT_DIR = Path(__file__).parent
RECORDINGS_DIR = SCRIPT_DIR / "recordings"

sys.path.insert(0, str(SCRIPT_DIR))

MAX_POINTS = 4000  # downsample chart data for reasonable HTML file size

# ---------------------------------------------------------------------------
# HTML template — uses __PLACEHOLDER__ substitution to avoid f-string escaping
# ---------------------------------------------------------------------------

TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rep Markers — __TITLE__</title>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js" charset="utf-8"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #0f0f0f; color: #e0e0e0; padding: 16px; max-width: 1400px; margin: 0 auto; }
  h1 { font-size: 16px; font-weight: 600; margin-bottom: 4px; color: #f0f0f0; }
  .meta { font-size: 12px; color: #6b7280; margin-bottom: 12px; }
  .top-row { display: flex; gap: 16px; margin-bottom: 12px; align-items: stretch; flex-wrap: wrap; }
  .video-wrap { flex: 0 0 auto; }
  video { display: block; max-width: 380px; width: 100%; border-radius: 8px; background: #000; }
  .right-col { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 300px; }
  .controls { display: flex; flex-direction: column; gap: 8px; }
  .btn-group { display: flex; gap: 8px; flex-wrap: wrap; }
  button { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: opacity .15s; }
  button:hover:not(:disabled) { opacity: 0.8; }
  #btn-start { background: #16a34a; color: #fff; flex: 1; }
  #btn-end { background: #dc2626; color: #fff; flex: 1; }
  #btn-end:disabled { background: #374151; color: #6b7280; cursor: not-allowed; }
  #btn-undo { background: #374151; color: #d1d5db; }
  #btn-clear { background: #450a0a; color: #fca5a5; }
  #btn-dl-markers { background: #065f46; color: #6ee7b7; }
  #btn-dl-full { background: #1e3a5f; color: #93c5fd; }
  .shortcut { font-size: 11px; opacity: 0.65; }
  hr.divider { border: none; border-top: 1px solid #1f2937; margin: 2px 0; }
  .status { font-size: 13px; color: #fbbf24; padding: 4px 0; min-height: 22px; }
  #chart { width: 100%; flex: 1; min-height: 280px; border-radius: 8px; overflow: hidden; }
  .section-title { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; margin: 12px 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 6px 10px; background: #1a1f2b; color: #6b7280; font-weight: 500; border-bottom: 1px solid #1f2937; }
  td { padding: 5px 10px; border-bottom: 1px solid #1a1a1a; }
  tr:hover td { background: #111827; }
  .del-btn { color: #f87171; cursor: pointer; background: none; border: none; font-size: 15px; padding: 0 2px; line-height: 1; }
  a.back { display: inline-block; margin-bottom: 12px; font-size: 12px; color: #4b7bec; text-decoration: none; }
  a.back:hover { text-decoration: underline; }
  #timing-warning { display: none; background: #451a03; border: 1px solid #92400e; color: #fdba74; border-radius: 6px; padding: 8px 12px; font-size: 13px; margin-bottom: 12px; }
</style>
</head>
<body>

<a class="back" href="../index.html">← back to recordings</a>
<h1>__TITLE__</h1>
<div class="meta">__META__</div>
<div id="timing-warning"></div>

<div class="top-row">
  <div class="video-wrap">
    <video id="video" controls preload="metadata" src="__VIDEO_SRC__"></video>
  </div>
  <div class="right-col">
    <div class="controls">
      <div class="btn-group">
        <button id="btn-start">▶ Mark Start <span class="shortcut">[S]</span></button>
        <button id="btn-end" disabled>■ Mark End <span class="shortcut">[E]</span></button>
      </div>
      <hr class="divider">
      <div class="status" id="status">Press S to mark rep start at current video time.</div>
      <hr class="divider">
      <div class="btn-group">
        <button id="btn-undo">↩ Undo</button>
        <button id="btn-clear">✕ Clear all</button>
      </div>
      <hr class="divider">
      <div class="btn-group">
        <button id="btn-dl-markers">⬇ repMarkers.json</button>
      </div>
      <div class="btn-group">
        <button id="btn-dl-full">⬇ Full updated JSON</button>
      </div>
    </div>
    <div id="chart"></div>
  </div>
</div>

<div class="section-title">Markers — <span id="marker-count">0</span> / __EXPECTED_REPS__ reps</div>
<table>
  <thead><tr><th>#</th><th>Start (ms)</th><th>End (ms)</th><th>Duration (ms)</th><th></th></tr></thead>
  <tbody id="marker-tbody"></tbody>
</table>

<script>
const TIMESTAMPS      = __TIMESTAMPS__;
const CHANNELS        = __CHANNELS__;   // { "accel.x": [...], "accel.y": [...], ... }
const FILENAME        = __FILENAME__;
const RAW_DATA        = __RAW_DATA__;
const EXPECTED_REPS   = __EXPECTED_REPS__;
const DATA_DURATION_S = __DATA_DURATION_S__;
const STARTED_AT_MS   = __STARTED_AT_MS__;   // wall-clock ms of handleStart on phone

let markers = __EXISTING_MARKERS__;

// Use the phone's handleStart wall-clock time as chart t=0 so that the chart
// aligns with the video (which also starts capturing right after handleStart).
// Samples collected slightly before handleStart (BLE buffer pre-roll) will
// appear at negative times and are safe to ignore.
const t0      = STARTED_AT_MS;
const tRelSec = TIMESTAMPS.map(t => (t - t0) / 1000);

const video    = document.getElementById('video');
const btnStart = document.getElementById('btn-start');
const btnEnd   = document.getElementById('btn-end');
const statusEl = document.getElementById('status');

// ── Plotly chart ─────────────────────────────────────────────────────────────

let pendingStartSec = null;

function allShapes() {
  const shapes = [];

  // Committed rep markers (blue bands)
  markers.forEach(m => {
    shapes.push({
      type: 'rect', xref: 'x', yref: 'paper',
      x0: (m.startMs - t0) / 1000,
      x1: (m.endMs   - t0) / 1000,
      y0: 0, y1: 1,
      fillcolor: 'rgba(37,99,235,0.2)',
      line: { color: 'rgba(99,153,255,0.7)', width: 1 },
    });
  });

  // Pending start (yellow dotted line)
  if (pendingStartSec !== null) {
    shapes.push({
      type: 'line', xref: 'x', yref: 'paper',
      x0: pendingStartSec, x1: pendingStartSec, y0: 0, y1: 1,
      line: { color: '#fbbf24', width: 2, dash: 'dot' },
    });
  }

  // Video cursor (orange solid line)
  shapes.push({
    type: 'line', xref: 'x', yref: 'paper',
    x0: video.currentTime, x1: video.currentTime, y0: 0, y1: 1,
    line: { color: '#f97316', width: 2 },
  });

  return shapes;
}

const layout = {
  paper_bgcolor: '#161b22',
  plot_bgcolor:  '#0d1117',
  font:   { color: '#c9d1d9', size: 12 },
  margin: { t: 12, b: 40, l: 50, r: 20 },
  xaxis:  { title: 'Time (s)',  gridcolor: '#1f2937', zeroline: false },
  yaxis:  { title: 'Raw value', gridcolor: '#1f2937', zeroline: true,
            zerolinecolor: '#374151' },
  shapes: allShapes(),
  hovermode: 'x unified',
  legend: { orientation: 'h', y: -0.18 },
};

// One trace per raw channel — toggle with the legend.
// Defaults: angle.{x,y,z} visible; accel/gyro hidden but available.
const CHANNEL_ORDER = [
  ['angle.x', '#f97316', true],
  ['angle.y', '#fbbf24', true],
  ['angle.z', '#a3e635', true],
  ['accel.x', '#60a5fa', 'legendonly'],
  ['accel.y', '#818cf8', 'legendonly'],
  ['accel.z', '#a78bfa', 'legendonly'],
  ['gyro.x',  '#f472b6', 'legendonly'],
  ['gyro.y',  '#fb7185', 'legendonly'],
  ['gyro.z',  '#fca5a5', 'legendonly'],
];

const traces = CHANNEL_ORDER.map(function(entry) {
  const name = entry[0], color = entry[1], visible = entry[2];
  return {
    x: tRelSec,
    y: CHANNELS[name],
    type: 'scatter',
    mode: 'lines',
    line: { color: color, width: 1.2 },
    name: name,
    visible: visible,
    hovertemplate: name + '=%{y:.4f}<extra></extra>',
  };
});

Plotly.newPlot('chart', traces, layout, { responsive: true, displayModeBar: true });

// Chart click → seek video
document.getElementById('chart').on('plotly_click', function(data) {
  const xSec = data.points[0].x;
  video.currentTime = Math.max(0, xSec);
  video.pause();
});

// Timing mismatch warning
video.addEventListener('loadedmetadata', function() {
  const videoDur = video.duration;
  const diff = Math.abs(videoDur - DATA_DURATION_S);
  const pct  = diff / Math.max(videoDur, DATA_DURATION_S) * 100;
  if (diff > 0.5 && pct > 3) {
    const longer  = videoDur > DATA_DURATION_S ? 'video' : 'sensor data';
    const shorter = videoDur > DATA_DURATION_S ? 'sensor data' : 'video';
    const warn    = document.getElementById('timing-warning');
    warn.textContent = '⚠️ Timing mismatch: '
      + longer  + ' is ' + diff.toFixed(2) + 's longer than ' + shorter
      + ' (video: ' + videoDur.toFixed(2) + 's, sensor data: ' + DATA_DURATION_S.toFixed(2) + 's). '
      + 'Chart x-axis is based on sensor timestamps — video position may drift from the signal over time.';
    warn.style.display = 'block';
  }
});

// Video timeupdate → move orange cursor on chart (~20 fps throttle)
let lastCursorSec = -1;
video.addEventListener('timeupdate', function() {
  const t = video.currentTime;
  if (Math.abs(t - lastCursorSec) < 0.05) return;
  lastCursorSec = t;
  Plotly.relayout('chart', { shapes: allShapes() });
});

// ── Marking state ─────────────────────────────────────────────────────────────

function markStart() {
  pendingStartSec = video.currentTime;
  btnEnd.disabled = false;
  statusEl.textContent = 'Start at ' + pendingStartSec.toFixed(3) + 's. Now press E to mark end.';
  Plotly.relayout('chart', { shapes: allShapes() });
}

function markEnd() {
  if (pendingStartSec === null) return;
  let s = pendingStartSec;
  let e = video.currentTime;
  if (e < s) { const tmp = s; s = e; e = tmp; }
  const startMs = Math.round(t0 + s * 1000);
  const endMs   = Math.round(t0 + e * 1000);
  markers.push({ startMs, endMs });
  markers.sort((a, b) => a.startMs - b.startMs);
  pendingStartSec = null;
  btnEnd.disabled = true;
  renderTable();
  Plotly.relayout('chart', { shapes: allShapes() });
  statusEl.textContent = markers.length + ' / ' + EXPECTED_REPS + ' reps marked. Press S to mark next rep.';
}

btnStart.addEventListener('click', markStart);
btnEnd.addEventListener('click', markEnd);

document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 's' || e.key === 'S') { e.preventDefault(); markStart(); }
  if (e.key === 'e' || e.key === 'E') { e.preventDefault(); markEnd(); }
});

// ── Marker table ──────────────────────────────────────────────────────────────

function renderTable() {
  document.getElementById('marker-count').textContent = markers.length;
  const rows = markers.map((m, i) =>
    '<tr>'
    + '<td>' + (i + 1) + '</td>'
    + '<td>' + m.startMs + '</td>'
    + '<td>' + m.endMs + '</td>'
    + '<td>' + (m.endMs - m.startMs) + '</td>'
    + '<td><button class="del-btn" onclick="deleteMarker(' + i + ')">✕</button></td>'
    + '</tr>'
  );
  document.getElementById('marker-tbody').innerHTML = rows.join('');
}

function deleteMarker(i) {
  markers.splice(i, 1);
  renderTable();
  Plotly.relayout('chart', { shapes: allShapes() });
}

document.getElementById('btn-undo').addEventListener('click', function() {
  if (!markers.length) return;
  markers.pop();
  pendingStartSec = null;
  btnEnd.disabled = true;
  renderTable();
  Plotly.relayout('chart', { shapes: allShapes() });
  statusEl.textContent = 'Undone. Press S to mark next rep start.';
});

document.getElementById('btn-clear').addEventListener('click', function() {
  if (!markers.length) return;
  if (!confirm('Clear all ' + markers.length + ' markers?')) return;
  markers = [];
  pendingStartSec = null;
  btnEnd.disabled = true;
  renderTable();
  Plotly.relayout('chart', { shapes: allShapes() });
  statusEl.textContent = 'Cleared. Press S to start marking.';
});

// ── Download ──────────────────────────────────────────────────────────────────

function download(filename, obj) {
  const a = document.createElement('a');
  a.href  = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(obj, null, 2));
  a.download = filename;
  a.click();
}

document.getElementById('btn-dl-markers').addEventListener('click', function() {
  download(FILENAME.replace(/\\.json$/, '') + '_repMarkers.json', markers);
});

document.getElementById('btn-dl-full').addEventListener('click', function() {
  download(FILENAME, Object.assign({}, RAW_DATA, { repMarkers: markers }));
});

// ── Init ──────────────────────────────────────────────────────────────────────
renderTable();
if (markers.length) {
  Plotly.relayout('chart', { shapes: allShapes() });
  statusEl.textContent = markers.length + ' existing markers loaded. Press S to add more.';
}
</script>
</body>
</html>
"""

INDEX_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Recordings Index</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #0f0f0f; color: #e0e0e0; padding: 24px; max-width: 960px; margin: 0 auto; }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  p { font-size: 13px; color: #6b7280; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 7px 10px; background: #1a1f2b; color: #6b7280; border-bottom: 1px solid #1f2937; }
  td { padding: 6px 10px; border-bottom: 1px solid #1a1a1a; }
  tr:hover td { background: #111827; }
  a { color: #4b7bec; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .badge { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .badge-ok   { background: #14532d; color: #86efac; }
  .badge-warn { background: #451a03; color: #fdba74; }
</style>
</head>
<body>
<h1>Recordings Index</h1>
<p>Click a recording to open its video annotation editor. Download the full updated JSON and replace the original file in raw-data/ to use the markers for training.</p>
<table>
  <thead><tr><th>Recording</th><th>Info</th><th>Expected reps</th><th>Markers</th></tr></thead>
  <tbody>__ROWS__</tbody>
</table>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _meta_str(data: dict) -> str:
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
        parts.append(f'{reps} reps expected')
    return "  ·  ".join(parts) if parts else "no metadata"


def find_pair(folder: Path):
    """Return (json_path, mp4_path) from a recording subfolder, or None on error."""
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


def generate_html(folder: Path) -> dict:
    pair = find_pair(folder)
    if pair is None:
        return {"name": folder.name, "status": "missing_files", "n_reps": 0, "n_markers": 0}

    json_path, mp4_path = pair

    with open(json_path) as f:
        data = json.load(f)

    samples  = data.get("samples", [])
    n_reps   = int(data.get("reps", 0))

    if len(samples) < 20:
        print(f"  SKIP (too short — {len(samples)} samples): {folder.name}")
        return {"name": folder.name, "status": "too_short", "n_reps": n_reps, "n_markers": 0}

    # Sort by timestamp — BLE batches occasionally arrive slightly out of order,
    # so without sorting Plotly would draw small visual zig-zags between adjacent
    # samples. Display-only sort; values themselves are untouched.
    samples_sorted  = sorted(samples, key=lambda s: s["timestamp"])
    timestamps_full = np.array([s["timestamp"] for s in samples_sorted], dtype=float)

    existing_markers = data.get("repMarkers", [])

    if len(samples_sorted) > MAX_POINTS:
        idx          = np.round(np.linspace(0, len(samples_sorted) - 1, MAX_POINTS)).astype(int)
        samples_keep = [samples_sorted[i] for i in idx]
        timestamps   = timestamps_full[idx]
    else:
        samples_keep = samples_sorted
        timestamps   = timestamps_full

    # Extract each raw channel — no filter, no smoothing, no projection.
    channels = {
        f"{kind}.{axis}": [round(float(s[kind][axis]), 6) for s in samples_keep]
        for kind in ("accel", "gyro", "angle")
        for axis in ("x", "y", "z")
    }

    ts_list       = [round(float(t), 1) for t in timestamps]
    data_duration = round((timestamps[-1] - timestamps[0]) / 1000.0, 3)

    # Wall-clock ms of when handleStart fired on the phone — used as chart t=0
    # so the chart aligns with the video. Falls back to first sample timestamp
    # if the field is missing (older recordings).
    started_at_str = data.get("startedAt")
    if started_at_str:
        from datetime import datetime
        started_at_ms = int(
            datetime.fromisoformat(started_at_str.replace("Z", "+00:00")).timestamp() * 1000
        )
    else:
        started_at_ms = int(timestamps[0])

    title = json_path.name
    meta  = _meta_str(data)

    html = TEMPLATE
    html = html.replace("__TITLE__",            title)
    html = html.replace("__META__",             meta)
    html = html.replace("__VIDEO_SRC__",        mp4_path.name)
    html = html.replace("__EXPECTED_REPS__",    str(n_reps))
    html = html.replace("__TIMESTAMPS__",       json.dumps(ts_list))
    html = html.replace("__CHANNELS__",         json.dumps(channels))
    html = html.replace("__FILENAME__",         json.dumps(json_path.name))
    html = html.replace("__RAW_DATA__",         json.dumps(data))
    html = html.replace("__EXISTING_MARKERS__", json.dumps(existing_markers))
    html = html.replace("__DATA_DURATION_S__",  str(data_duration))
    html = html.replace("__STARTED_AT_MS__",    str(started_at_ms))

    out_path = folder / "index.html"
    out_path.write_text(html, encoding="utf-8")

    print(f"  {folder.name}: {n_reps} reps expected, {len(existing_markers)} existing markers → {out_path}")

    return {
        "name":      folder.name,
        "status":    "ok",
        "n_reps":    n_reps,
        "n_markers": len(existing_markers),
        "meta":      meta,
    }


def generate_index(summaries: list) -> None:
    rows = []
    for s in sorted(summaries, key=lambda x: x["name"]):
        if s["status"] != "ok":
            badge = f'<span class="badge badge-warn">{s["status"]}</span>'
            name_cell = s["name"]
        else:
            nm, nr = s["n_markers"], s["n_reps"]
            if nm == 0:
                badge = '<span class="badge badge-warn">no markers</span>'
            elif nm >= nr:
                badge = f'<span class="badge badge-ok">{nm} markers ✓</span>'
            else:
                badge = f'<span class="badge badge-warn">{nm} / {nr} markers</span>'
            name_cell = f'<a href="{s["name"]}/index.html">{s["name"]}</a>'

        rows.append(
            f'<tr><td>{name_cell}</td>'
            f'<td style="color:#9ca3af;font-size:12px">{s.get("meta", "")}</td>'
            f'<td>{s["n_reps"]}</td>'
            f'<td>{badge}</td></tr>'
        )

    html = INDEX_TEMPLATE.replace("__ROWS__", "".join(rows))
    out  = RECORDINGS_DIR / "index.html"
    out.write_text(html, encoding="utf-8")
    print(f"\n  Index → {out}")


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

    print(f"\n── Generating video marker HTML pages ({len(folders)} folders) ──────────")
    summaries = []
    for folder in folders:
        if not folder.is_dir():
            print(f"  NOT A DIRECTORY: {folder}")
            continue
        summaries.append(generate_html(folder))

    generate_index(summaries)
    print(f"\nDone. Open {RECORDINGS_DIR / 'index.html'} in a browser.\n")


if __name__ == "__main__":
    main()
