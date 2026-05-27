#!/usr/bin/env python3
"""
Generate interactive HTML pages for manually annotating rep boundaries.

For each recording in recordings/*.json:
  1. Extracts the same 1D canonical signal that train.py uses.
  2. Generates a standalone HTML page with an interactive chart.
  3. The chart lets you click to mark rep start/end boundaries.
  4. Download buttons export repMarkers JSON or the full updated JSON.

Output:
    output/markers/<recording_name>.html   — one interactive page per recording
    output/markers/index.html              — overview of all recordings

Usage:
    python generate-markers-html.py                  # all recordings
    python generate-markers-html.py bench_press.json # specific file(s)
"""

import json
import sys
from pathlib import Path

import numpy as np

from train import preprocess_to_1d, RECORDINGS_DIR, OUTPUT_DIR

MARKERS_DIR = OUTPUT_DIR / "markers"
MARKERS_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# HTML template (uses __PLACEHOLDER__ substitution to avoid f-string escaping)
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
  body { font-family: system-ui, sans-serif; background: #0f0f0f; color: #e0e0e0; padding: 16px; max-width: 1200px; margin: 0 auto; }
  h1 { font-size: 16px; font-weight: 600; margin-bottom: 4px; color: #f0f0f0; }
  .meta { font-size: 12px; color: #6b7280; margin-bottom: 12px; }
  #chart { width: 100%; height: 420px; border-radius: 8px; overflow: hidden; margin-bottom: 12px; }
  .controls { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; align-items: center; }
  button { padding: 6px 14px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: opacity .15s; }
  button:hover { opacity: 0.8; }
  #btn-mark        { background: #2563eb; color: #fff; }
  #btn-mark.active { background: #16a34a; }
  #btn-undo        { background: #374151; color: #d1d5db; }
  #btn-clear       { background: #450a0a; color: #fca5a5; }
  #btn-dl-markers  { background: #065f46; color: #6ee7b7; }
  #btn-dl-full     { background: #1e3a5f; color: #93c5fd; }
  .status { font-size: 13px; color: #fbbf24; flex: 1; min-width: 200px; }
  .section-title { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; margin: 12px 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 6px 10px; background: #1a1f2b; color: #6b7280; font-weight: 500; border-bottom: 1px solid #1f2937; }
  td { padding: 5px 10px; border-bottom: 1px solid #1a1a1a; }
  tr:hover td { background: #111827; }
  .del-btn { color: #f87171; cursor: pointer; background: none; border: none; font-size: 15px; padding: 0 2px; line-height: 1; }
  .badge { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .badge-ok   { background: #14532d; color: #86efac; }
  .badge-warn { background: #451a03; color: #fdba74; }
  a.back { display: inline-block; margin-bottom: 12px; font-size: 12px; color: #4b7bec; text-decoration: none; }
  a.back:hover { text-decoration: underline; }
</style>
</head>
<body>

<a class="back" href="index.html">← back to index</a>
<h1>__TITLE__</h1>
<div class="meta">__META__</div>

<div id="chart"></div>

<div class="controls">
  <button id="btn-mark">▶ Mark rep</button>
  <button id="btn-undo">↩ Undo</button>
  <button id="btn-clear">✕ Clear all</button>
  <span class="status" id="status">Click "Mark rep", then click the start of a rep on the chart.</span>
</div>
<div class="controls">
  <button id="btn-dl-markers">⬇ repMarkers.json</button>
  <button id="btn-dl-full">⬇ Full updated JSON (replace original)</button>
</div>

<div class="section-title">Markers — <span id="marker-count">0</span> / __EXPECTED_REPS__ reps</div>
<table>
  <thead><tr><th>#</th><th>Start (ms)</th><th>End (ms)</th><th>Duration (ms)</th><th></th></tr></thead>
  <tbody id="marker-tbody"></tbody>
</table>

<script>
const TIMESTAMPS     = __TIMESTAMPS__;
const SIGNAL         = __SIGNAL__;
const FILENAME       = __FILENAME__;
const RAW_DATA       = __RAW_DATA__;
const EXPECTED_REPS  = __EXPECTED_REPS__;

let markers = __EXISTING_MARKERS__;

const t0      = TIMESTAMPS[0];
const tRelSec = TIMESTAMPS.map(function(t) { return (t - t0) / 1000; });

// ── Plotly chart ────────────────────────────────────────────────────────────

function markerShapes() {
  return markers.map(function(m) {
    return {
      type: 'rect', xref: 'x', yref: 'paper',
      x0: (m.startMs - t0) / 1000,
      x1: (m.endMs   - t0) / 1000,
      y0: 0, y1: 1,
      fillcolor: 'rgba(37,99,235,0.2)',
      line: { color: 'rgba(99,153,255,0.7)', width: 1 },
    };
  });
}

var layout = {
  paper_bgcolor: '#161b22',
  plot_bgcolor:  '#0d1117',
  font:   { color: '#c9d1d9', size: 12 },
  margin: { t: 12, b: 40, l: 50, r: 20 },
  xaxis:  { title: 'Time (s)', gridcolor: '#1f2937', zeroline: false },
  yaxis:  { title: 'Signal',   gridcolor: '#1f2937', zeroline: false },
  shapes: markerShapes(),
  hovermode: 'x',
};

Plotly.newPlot('chart', [{
  x: tRelSec, y: SIGNAL,
  type: 'scatter', mode: 'lines',
  line: { color: '#58a6ff', width: 1.5 },
  name: 'signal',
  hovertemplate: 't=%{x:.3f}s<extra></extra>',
}], layout, { responsive: true, displayModeBar: false });

// ── State machine ───────────────────────────────────────────────────────────

var state        = 'idle';  // 'idle' | 'waiting_end'
var pendingStart = null;

var btnMark = document.getElementById('btn-mark');
var status  = document.getElementById('status');

btnMark.addEventListener('click', function() {
  if (state === 'idle') {
    state = 'waiting_end';
    btnMark.classList.add('active');
    btnMark.textContent = '✕ Cancel';
    status.textContent = 'Click the START of a rep on the chart.';
  } else {
    cancelPending();
  }
});

function cancelPending() {
  state        = 'idle';
  pendingStart = null;
  btnMark.classList.remove('active');
  btnMark.textContent = '▶ Mark rep';
  status.textContent  = 'Click "Mark rep", then click the start of a rep on the chart.';
  Plotly.relayout('chart', { shapes: markerShapes() });
}

document.getElementById('chart').on('plotly_click', function(data) {
  if (state === 'idle') return;
  var xSec = data.points[0].x;
  var xMs  = xSec * 1000 + t0;

  if (state === 'waiting_end') {
    pendingStart = xMs;
    state        = 'waiting_end2';
    status.textContent = 'Now click the END of that rep.';
    var shapes = markerShapes();
    shapes.push({
      type: 'line', xref: 'x', yref: 'paper',
      x0: xSec, x1: xSec, y0: 0, y1: 1,
      line: { color: '#fbbf24', width: 2, dash: 'dot' },
    });
    Plotly.relayout('chart', { shapes: shapes });
    return;
  }

  if (state === 'waiting_end2') {
    var startMs = pendingStart;
    var endMs   = xMs;
    if (endMs < startMs) { var tmp = startMs; startMs = endMs; endMs = tmp; }
    markers.push({ startMs: Math.round(startMs), endMs: Math.round(endMs) });
    markers.sort(function(a, b) { return a.startMs - b.startMs; });
    cancelPending();
    renderTable();
    Plotly.relayout('chart', { shapes: markerShapes() });
    status.textContent = 'Marker added — ' + markers.length + ' / ' + EXPECTED_REPS + ' reps marked.';
  }
});

// ── Marker table ────────────────────────────────────────────────────────────

function renderTable() {
  document.getElementById('marker-count').textContent = markers.length;
  var rows = markers.map(function(m, i) {
    return '<tr>'
      + '<td>' + (i + 1) + '</td>'
      + '<td>' + m.startMs + '</td>'
      + '<td>' + m.endMs + '</td>'
      + '<td>' + (m.endMs - m.startMs) + '</td>'
      + '<td><button class="del-btn" onclick="deleteMarker(' + i + ')">✕</button></td>'
      + '</tr>';
  });
  document.getElementById('marker-tbody').innerHTML = rows.join('');
}

function deleteMarker(i) {
  markers.splice(i, 1);
  renderTable();
  Plotly.relayout('chart', { shapes: markerShapes() });
}

document.getElementById('btn-undo').addEventListener('click', function() {
  if (!markers.length) return;
  markers.pop();
  renderTable();
  Plotly.relayout('chart', { shapes: markerShapes() });
});

document.getElementById('btn-clear').addEventListener('click', function() {
  if (!markers.length) return;
  if (!confirm('Clear all markers?')) return;
  markers = [];
  renderTable();
  Plotly.relayout('chart', { shapes: markerShapes() });
});

// ── Download ────────────────────────────────────────────────────────────────

function download(filename, obj) {
  var a    = document.createElement('a');
  a.href   = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(obj, null, 2));
  a.download = filename;
  a.click();
}

document.getElementById('btn-dl-markers').addEventListener('click', function() {
  var base = FILENAME.replace(/\\.json$/, '');
  download(base + '_repMarkers.json', markers);
});

document.getElementById('btn-dl-full').addEventListener('click', function() {
  var updated = Object.assign({}, RAW_DATA, { repMarkers: markers });
  download(FILENAME, updated);
});

// ── Init ────────────────────────────────────────────────────────────────────
renderTable();
if (markers.length) {
  Plotly.relayout('chart', { shapes: markerShapes() });
  status.textContent = markers.length + ' existing markers loaded.';
}
</script>
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


def generate_html(path: Path) -> dict:
    """
    Generate an HTML marker editor for one recording.
    Returns a summary dict for the index page.
    """
    with open(path) as f:
        data = json.load(f)

    samples = data.get("samples", [])
    n_reps  = int(data.get("reps", 0))

    if len(samples) < 20:
        print(f"  SKIP (too short — {len(samples)} samples): {path.name}")
        return {"name": path.name, "status": "too_short", "n_reps": n_reps, "n_markers": 0}

    try:
        signal_1d, timestamps = preprocess_to_1d(samples)
    except Exception as exc:
        print(f"  ERROR ({exc}): {path.name}")
        return {"name": path.name, "status": "error", "n_reps": n_reps, "n_markers": 0}

    existing_markers = data.get("repMarkers", [])

    # Downsample to at most 4000 points for reasonable HTML file size while
    # keeping enough resolution to click accurately on rep boundaries.
    MAX_POINTS = 4000
    if len(signal_1d) > MAX_POINTS:
        idx       = np.round(np.linspace(0, len(signal_1d) - 1, MAX_POINTS)).astype(int)
        signal_1d = signal_1d[idx]
        timestamps = timestamps[idx]

    ts_list  = [round(float(t), 1) for t in timestamps]
    sig_list = [round(float(v), 6) for v in signal_1d]

    title = path.name
    meta  = _meta_str(data)

    html = TEMPLATE
    html = html.replace("__TITLE__",           json.dumps(title)[1:-1])   # unquoted for use in <title>
    html = html.replace("__META__",            meta)
    html = html.replace("__EXPECTED_REPS__",   str(n_reps))
    html = html.replace("__TIMESTAMPS__",      json.dumps(ts_list))
    html = html.replace("__SIGNAL__",          json.dumps(sig_list))
    html = html.replace("__FILENAME__",        json.dumps(path.name))
    html = html.replace("__RAW_DATA__",        json.dumps(data))
    html = html.replace("__EXISTING_MARKERS__",json.dumps(existing_markers))

    out_path = MARKERS_DIR / (path.stem + ".html")
    out_path.write_text(html, encoding="utf-8")
    print(f"  {path.name}: {n_reps} reps, {len(existing_markers)} existing markers → {out_path.name}")

    return {
        "name":      path.name,
        "html":      out_path.name,
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
            link  = s["name"]
        else:
            nm = s["n_markers"]
            nr = s["n_reps"]
            if nm == 0:
                badge = '<span class="badge badge-warn">no markers</span>'
            elif nm >= nr:
                badge = f'<span class="badge badge-ok">{nm} markers ✓</span>'
            else:
                badge = f'<span class="badge badge-warn">{nm} / {nr} markers</span>'
            link = f'<a href="{s["html"]}">{s["name"]}</a>'

        rows.append(
            f'<tr><td>{link}</td>'
            f'<td style="color:#9ca3af;font-size:12px">{s.get("meta","")}</td>'
            f'<td>{s["n_reps"]}</td>'
            f'<td>{badge}</td></tr>'
        )

    html = f"""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Rep Marker Index</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: system-ui, sans-serif; background: #0f0f0f; color: #e0e0e0; padding: 24px; max-width: 960px; margin: 0 auto; }}
  h1 {{ font-size: 18px; font-weight: 700; margin-bottom: 4px; }}
  p  {{ font-size: 13px; color: #6b7280; margin-bottom: 16px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
  th {{ text-align: left; padding: 7px 10px; background: #1a1f2b; color: #6b7280; border-bottom: 1px solid #1f2937; }}
  td {{ padding: 6px 10px; border-bottom: 1px solid #1a1a1a; }}
  tr:hover td {{ background: #111827; }}
  a  {{ color: #4b7bec; text-decoration: none; }}
  a:hover {{ text-decoration: underline; }}
  .badge {{ display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 11px; font-weight: 600; }}
  .badge-ok   {{ background: #14532d; color: #86efac; }}
  .badge-warn {{ background: #451a03; color: #fdba74; }}
</style>
</head>
<body>
<h1>Rep Marker Index</h1>
<p>Click a recording to open its marker editor. Download the full updated JSON and replace the original file in recordings/.</p>
<table>
  <thead><tr><th>Recording</th><th>Info</th><th>Reps</th><th>Markers</th></tr></thead>
  <tbody>{''.join(rows)}</tbody>
</table>
</body>
</html>
"""
    (MARKERS_DIR / "index.html").write_text(html, encoding="utf-8")
    print(f"\n  Index → {MARKERS_DIR / 'index.html'}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if len(sys.argv) > 1:
        paths = [RECORDINGS_DIR / a for a in sys.argv[1:]]
    else:
        paths = sorted(RECORDINGS_DIR.glob("*.json"))

    print(f"\n── Generating marker HTML pages ({len(paths)} recordings) ──────────")
    summaries = []
    for path in paths:
        if not path.exists():
            print(f"  NOT FOUND: {path}")
            continue
        summaries.append(generate_html(path))

    generate_index(summaries)
    print(f"\nDone. Open output/markers/index.html in a browser.\n")


if __name__ == "__main__":
    main()
