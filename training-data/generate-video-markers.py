#!/usr/bin/env python3
"""
Generate video-synced interactive HTML pages for annotating rep boundaries.

For each subfolder in recordings/:
  1. Finds the .json recording and .mp4 video file.
  2. Computes world-frame position (X/Y/Z, metres) by dead-reckoning the IMU
     samples with ZUPT drift correction (see ble_dead_reckoning.py).
  3. Renders two complementary charts so reps are actually visible:
       • Orientation — the device's own drift-corrected Euler angle (default).
         Clearest for rotational lifts (curls, extensions, presses).
       • Acceleration — raw accel per axis + magnitude (default). Drift-free,
         works for any lift. Dead-reckoned position is kept here but hidden,
         since its double integration drifts far enough to bury the reps.
  4. Generates a standalone index.html with a synced video player + both charts.

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

SCRIPT_DIR = Path(__file__).parent
RECORDINGS_DIR = SCRIPT_DIR / "recordings"

sys.path.insert(0, str(SCRIPT_DIR))

from video_recording_data import RecordingPrepError, prepare_video_recording  # noqa: E402

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
  .chart-row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }
  .chart-panel { flex: 1; min-width: 340px; display: flex; flex-direction: column; }
  .chart-panel h2 { font-size: 13px; font-weight: 600; color: #d1d5db; margin: 0 0 1px; }
  .chart-panel .sub { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
  .chart-box { width: 100%; height: 320px; border-radius: 8px; overflow: hidden; }
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
  </div>
</div>

<div class="chart-row">
  <div class="chart-panel">
    <h2>Orientation (angle)</h2>
    <div class="sub">device-fused tilt — clearest for rotational lifts</div>
    <div id="chart-a" class="chart-box"></div>
  </div>
  <div class="chart-panel">
    <h2>Acceleration</h2>
    <div class="sub">raw accel + |a| — works for any lift; position kept but hidden</div>
    <div id="chart-b" class="chart-box"></div>
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

function makeLayout(yTitle) {
  return {
    paper_bgcolor: '#161b22',
    plot_bgcolor:  '#0d1117',
    font:   { color: '#c9d1d9', size: 12 },
    margin: { t: 12, b: 40, l: 50, r: 20 },
    xaxis:  { title: 'Time (s)', gridcolor: '#1f2937', zeroline: false },
    yaxis:  { title: yTitle, gridcolor: '#1f2937', zeroline: true,
              zerolinecolor: '#374151' },
    shapes: allShapes(),
    hovermode: 'x unified',
    legend: { orientation: 'h', y: -0.18 },
  };
}

// Two complementary charts. Dead-reckoned position (∬ accel) drifts so far over a
// set that it buries the reps, so it is no longer a default view:
//   Chart A — device-fused orientation (degrees). Clearest for rotational lifts.
//             |accel| is offered but hidden (different unit from degrees).
//   Chart B — raw acceleration (g) + magnitude. Drift-free; position/gyro hidden.
const CHART_A = {
  id: 'chart-a',
  yTitle: 'Angle (deg)',
  order: [
    ['angle.x',   '#fb923c', true],
    ['angle.y',   '#facc15', true],
    ['angle.z',   '#84cc16', true],
    ['accel.|a|', '#e5e7eb', 'legendonly'],
  ],
};
const CHART_B = {
  id: 'chart-b',
  yTitle: 'Accel (g) / Pos (m)',
  order: [
    ['accel.x',   '#60a5fa', true],
    ['accel.y',   '#818cf8', true],
    ['accel.z',   '#a78bfa', true],
    ['accel.|a|', '#e5e7eb', true],
    ['pos.x (m)', '#f97316', 'legendonly'],
    ['pos.y (m)', '#fbbf24', 'legendonly'],
    ['pos.z (m)', '#a3e635', 'legendonly'],
    ['gyro.x',    '#f472b6', 'legendonly'],
    ['gyro.y',    '#fb7185', 'legendonly'],
    ['gyro.z',    '#fca5a5', 'legendonly'],
  ],
};
const CHARTS = [CHART_A, CHART_B];

function buildTraces(order) {
  return order.map(function(entry) {
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
}

CHARTS.forEach(function(c) {
  Plotly.newPlot(c.id, buildTraces(c.order), makeLayout(c.yTitle),
                 { responsive: true, displayModeBar: true });
  // Chart click → seek video
  document.getElementById(c.id).on('plotly_click', function(data) {
    const xSec = data.points[0].x;
    video.currentTime = Math.max(0, xSec);
    video.pause();
  });
});

// Redraw marker/cursor shapes on every chart at once.
function relayoutShapes() {
  const shapes = allShapes();
  CHARTS.forEach(function(c) { Plotly.relayout(c.id, { shapes: shapes }); });
}

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
  relayoutShapes();
});

// ── Marking state ─────────────────────────────────────────────────────────────

function markStart() {
  pendingStartSec = video.currentTime;
  btnEnd.disabled = false;
  statusEl.textContent = 'Start at ' + pendingStartSec.toFixed(3) + 's. Now press E to mark end.';
  relayoutShapes();
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
  relayoutShapes();
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
  relayoutShapes();
}

document.getElementById('btn-undo').addEventListener('click', function() {
  if (!markers.length) return;
  markers.pop();
  pendingStartSec = null;
  btnEnd.disabled = true;
  renderTable();
  relayoutShapes();
  statusEl.textContent = 'Undone. Press S to mark next rep start.';
});

document.getElementById('btn-clear').addEventListener('click', function() {
  if (!markers.length) return;
  if (!confirm('Clear all ' + markers.length + ' markers?')) return;
  markers = [];
  pendingStartSec = null;
  btnEnd.disabled = true;
  renderTable();
  relayoutShapes();
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
  relayoutShapes();
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


def generate_html(folder: Path) -> dict:
    try:
        recording = prepare_video_recording(folder)
    except RecordingPrepError as err:
        print(err.message)
        return {
            "name": folder.name,
            "status": err.status,
            "n_reps": err.n_reps,
            "n_markers": err.n_markers,
        }

    html = TEMPLATE
    html = html.replace("__TITLE__",            recording.json_path.name)
    html = html.replace("__META__",             recording.meta)
    html = html.replace("__VIDEO_SRC__",        recording.mp4_path.name)
    html = html.replace("__EXPECTED_REPS__",    str(recording.n_reps))
    html = html.replace("__TIMESTAMPS__",       json.dumps(recording.timestamps_list))
    html = html.replace("__CHANNELS__",         json.dumps(recording.channels))
    html = html.replace("__FILENAME__",         json.dumps(recording.json_path.name))
    html = html.replace("__RAW_DATA__",         json.dumps(recording.data))
    html = html.replace("__EXISTING_MARKERS__", json.dumps(recording.rep_markers))
    html = html.replace("__DATA_DURATION_S__",  str(recording.data_duration_s))
    html = html.replace("__STARTED_AT_MS__",    str(recording.started_at_ms))

    out_path = folder / "index.html"
    out_path.write_text(html, encoding="utf-8")

    print(
        f"  {folder.name}: {recording.n_reps} reps expected, "
        f"{len(recording.rep_markers)} existing markers → {out_path}"
    )

    return {
        "name":      folder.name,
        "status":    "ok",
        "n_reps":    recording.n_reps,
        "n_markers": len(recording.rep_markers),
        "meta":      recording.meta,
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
