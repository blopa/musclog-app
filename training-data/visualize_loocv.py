#!/usr/bin/env python3
"""
LOOCV HTML Visualizer for the Segment-and-Score rep-counting pipeline.

For each training recording that has a 'reps' label:
  1. Train a RandomForestClassifier on ALL OTHER recordings (leave-one-out)
  2. Run the full prediction pipeline on the held-out recording
  3. Emit a standalone HTML report showing:
       - Recording metadata and prediction accuracy
       - Preprocessed 1D signal with segment regions colour-coded:
           green  = true positive  (pseudo-labeled rep + predicted rep)
           orange = false negative (pseudo-labeled rep, not predicted)
           red    = false positive (predicted rep, pseudo-labeled noise)
           grey   = true negative  (both noise — no colour)
       - Stacked Phase A / Phase B duration bar chart per predicted rep
       - Phase A / Phase B speed line chart per predicted rep
       - Per-rep summary table with averages

Usage:
    cd training-data
    python visualize_loocv.py

Output: training-data/output/html/<recording_name>.html
        training-data/output/html/index.html  (summary page)

Requires: the same dependencies as train.py (sklearn, scipy, numpy, pandas)
"""

import json
import sys
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestClassifier

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from train import (
    SEGMENT_FEATURE_COLS,
    build_segment_dataset,
    extract_segment_features,
    over_segment,
    preprocess_to_1d,
    pseudo_label_segments,
)
from predict import detect_phases

OUTPUT_HTML_DIR = ROOT / "output" / "html"

CHART_MIN_SIGNAL_POINTS = 50  # floor so 0-rep recordings still get a visible line


# ---------------------------------------------------------------------------
# LOOCV model training
# ---------------------------------------------------------------------------

def train_excluding(df, held_out_rec: str) -> RandomForestClassifier:
    train_df = df[df["recording_id"] != held_out_rec]
    clf = RandomForestClassifier(
        n_estimators=200, max_depth=6,
        class_weight="balanced", random_state=42,
    )
    clf.fit(train_df[SEGMENT_FEATURE_COLS].values, train_df["is_rep"].values)
    return clf


# ---------------------------------------------------------------------------
# HTML generation
# ---------------------------------------------------------------------------

_CSS = """
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0f172a; color: #e2e8f0; padding: 2rem; min-height: 100vh;
}
h1 { font-size: 1.4rem; font-weight: 700; color: #f8fafc; margin-bottom: 0.2rem; }
h2 { font-size: 0.9rem; color: #64748b; margin-bottom: 1rem; }
h3 { font-size: 0.75rem; font-weight: 600; color: #64748b; margin-bottom: 0.75rem;
     text-transform: uppercase; letter-spacing: 0.07em; }
.meta { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.badge {
  padding: 0.2rem 0.65rem; border-radius: 9999px; font-size: 0.72rem;
  font-weight: 500; background: #1e293b; color: #94a3b8; border: 1px solid #334155;
}
.stats { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.75rem; }
.stat {
  background: #1e293b; border-radius: 0.65rem; padding: 0.85rem 1.25rem;
  border: 1px solid #334155; min-width: 100px;
}
.stat-label { font-size: 0.7rem; color: #64748b; margin-bottom: 0.2rem; }
.stat-value { font-size: 1.6rem; font-weight: 700; }
.card {
  background: #1e293b; border-radius: 0.75rem; padding: 1.25rem;
  border: 1px solid #334155; margin-bottom: 1.25rem;
}
.chart-wrap { position: relative; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem; }
table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
th {
  text-align: left; padding: 0.45rem 0.65rem; font-size: 0.7rem; color: #64748b;
  border-bottom: 1px solid #334155; text-transform: uppercase; letter-spacing: 0.06em;
}
td { padding: 0.45rem 0.65rem; border-bottom: 1px solid #1e293b; color: #cbd5e1; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #0f172a; }
.avg-row td { color: #64748b; font-style: italic; border-top: 1px solid #334155; }
.legend { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.65rem; font-size: 0.72rem; }
.legend-item { display: flex; align-items: center; gap: 0.35rem; color: #94a3b8; }
.legend-dot { width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0; }
@media (max-width: 700px) { .two-col { grid-template-columns: 1fr; } }
"""

_CHART_JS_PLUGIN = """
// Custom Chart.js plugin — draws background segment regions + turning-point lines
// before the dataset is rendered.
const segmentBgPlugin = {
  id: 'segmentBg',
  beforeDraw(chart) {
    if (!chart.config._segData) return;
    const { segments, turnings } = chart.config._segData;
    const ctx   = chart.ctx;
    const xAxis = chart.scales.x;
    const yAxis = chart.scales.y;
    for (const seg of segments) {
      const x1 = xAxis.getPixelForValue(seg.xs);
      const x2 = xAxis.getPixelForValue(seg.xe);
      ctx.fillStyle = seg.color;
      ctx.fillRect(x1, yAxis.top, x2 - x1, yAxis.height);
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(251,191,36,0.55)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 3]);
    for (const t of turnings) {
      const cx = xAxis.getPixelForValue(t);
      ctx.beginPath();
      ctx.moveTo(cx, yAxis.top);
      ctx.lineTo(cx, yAxis.top + yAxis.height);
      ctx.stroke();
    }
    ctx.restore();
  },
};
Chart.register(segmentBgPlugin);
"""

_CHART_DEFAULTS = """
Chart.defaults.color           = '#64748b';
Chart.defaults.borderColor     = '#334155';
Chart.defaults.font.family     = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
Chart.defaults.font.size       = 11;
"""


def _color(pseudo_rep: int, predicted: bool) -> str:
    if pseudo_rep and predicted:
        return "rgba(34,197,94,0.22)"
    if pseudo_rep and not predicted:
        return "rgba(251,146,60,0.32)"
    if not pseudo_rep and predicted:
        return "rgba(239,68,68,0.32)"
    return "rgba(156,163,175,0.08)"


def build_compressed_chart_payload(
    signal_1d: np.ndarray,
    timestamps: np.ndarray,
    labeled_segs: list,
    predicted_pairs: list,
) -> dict:
    """
    Build the minimal payload needed to render the set chart in-app.

    Instead of storing all 9 raw channels at 100 Hz (~2 MB per set), only
    the preprocessed 1D signal is kept, downsampled to CHART_MAX_SIGNAL_POINTS.
    Segment annotations and per-rep phase points are already inherently compact
    (a few dozen numbers total).  This dict is what would be persisted in the
    app database alongside the rep count.
    """
    n         = len(signal_1d)
    rec_start = float(timestamps[0])

    # Downsampled signal — 10 pts per predicted rep, floored at CHART_MIN_SIGNAL_POINTS
    max_pts = max(len(predicted_pairs) * 10, CHART_MIN_SIGNAL_POINTS)
    step    = max(1, n // max_pts)
    xs      = ((timestamps[::step] - timestamps[0]) / 1000).round(3).tolist()
    ys      = signal_1d[::step].round(3).tolist()

    # Segment colour annotations ─────────────────────────────────────────────
    pred_set = {id(s) for s, _ in predicted_pairs}
    segments = [
        {
            "xs":    round((seg["start_ts"] - rec_start) / 1000, 3),
            "xe":    round((seg["end_ts"]   - rec_start) / 1000, 3),
            "color": _color(seg.get("is_rep", 0), id(seg) in pred_set),
        }
        for seg in labeled_segs
    ]

    # Turning-point markers ──────────────────────────────────────────────────
    turnings = [
        round((seg["turning_ts"] - rec_start) / 1000, 3)
        for seg, _ in predicted_pairs
    ]

    # Phase reconstruction — 3 key points per half-rep, null breaks the line
    phase_a_pts: list = []
    phase_b_pts: list = []
    for seg, _ in predicted_pairs:
        si, ti, ei = seg["start_idx"], seg["turning_idx"], seg["end_idx"]
        ts_si = round((float(timestamps[si]) - rec_start) / 1000, 3)
        ts_ti = round((float(timestamps[ti]) - rec_start) / 1000, 3)
        ts_ei = round((float(timestamps[ei]) - rec_start) / 1000, 3)
        y_si  = round(float(signal_1d[si]), 3)
        y_ti  = round(float(signal_1d[ti]), 3)
        y_ei  = round(float(signal_1d[ei]), 3)
        phase_a_pts.extend([{"x": ts_si, "y": y_si}, {"x": ts_ti, "y": y_ti}, {"x": ts_ti, "y": None}])
        phase_b_pts.extend([{"x": ts_ti, "y": y_ti}, {"x": ts_ei, "y": y_ei}, {"x": ts_ei, "y": None}])

    # Y-axis bounds ──────────────────────────────────────────────────────────
    y_min = round(float(signal_1d.min()), 3)
    y_max = round(float(signal_1d.max()), 3)

    return {
        "signal":   {"x": xs, "y": ys},
        "segments": segments,
        "turnings": turnings,
        "phaseA":   phase_a_pts,
        "phaseB":   phase_b_pts,
        "yBounds":  {"min": y_min, "max": y_max},
        # ── provenance (not rendered, just informational) ──────────────────
        "signalPoints": len(xs),
        "origSamples":  n,
    }


def generate_html(
    rec_name: str,
    data: dict,
    signal_1d: np.ndarray,
    timestamps: np.ndarray,
    labeled_segs: list,       # all candidate segments, each has 'is_rep' flag
    predicted_pairs: list,    # [(seg, confidence), …] — only predicted reps
    orig_file_kb: float = 0.0,
) -> str:
    gt = int(data.get("reps", 0))
    pred = len(predicted_pairs)
    err  = pred - gt

    muscle   = data.get("muscleGroup",   "unknown")
    equip    = data.get("equipmentType", "unknown")
    mechanic = data.get("mechanicType",  "unknown")
    set_num  = data.get("setNumber",     1)
    dur_s    = (float(timestamps[-1]) - float(timestamps[0])) / 1000.0

    # ── Compressed chart payload ─────────────────────────────────────────
    # What would be stored in the app DB — preprocessed 1D signal at
    # CHART_MAX_SIGNAL_POINTS pts plus compact annotations.
    payload       = build_compressed_chart_payload(signal_1d, timestamps, labeled_segs, predicted_pairs)
    payload_json  = json.dumps(payload, separators=(",", ":"))
    compressed_kb = len(payload_json.encode()) / 1024

    # Compressed signal (200 pts)
    xs_comp  = payload["signal"]["x"]
    ys_comp  = payload["signal"]["y"]
    seg_data = payload["segments"]
    turnings = payload["turnings"]
    phase_a_pts = payload["phaseA"]
    phase_b_pts = payload["phaseB"]
    y_min    = payload["yBounds"]["min"]
    y_max    = payload["yBounds"]["max"]

    # Full signal (≤1000 pts) — for visual comparison only
    n         = len(signal_1d)
    step_full = max(1, n // 1000)
    xs_full   = ((timestamps[::step_full] - timestamps[0]) / 1000).tolist()
    ys_full   = signal_1d[::step_full].tolist()
    full_pts_kb = len(json.dumps({"x": xs_full, "y": ys_full}, separators=(",", ":")).encode()) / 1024

    # Shared y-axis bounds (same scale on both charts)
    y_pad = round((y_max - y_min) * 0.08, 3)

    # ── Per-rep phase detail ─────────────────────────────────────────────
    reps_detail = []
    for i, (seg, conf) in enumerate(predicted_pairs, 1):
        phases = detect_phases(seg, signal_1d, timestamps)
        reps_detail.append({
            "i":     i,
            "dur":   round((seg["end_ts"] - seg["start_ts"]) / 1000, 3),
            "phA":   round(phases["phase_a_duration_ms"] / 1000, 3),
            "phB":   round(phases["phase_b_duration_ms"] / 1000, 3),
            "spdA":  round(phases["phase_a_speed_dps"], 1),
            "spdB":  round(phases["phase_b_speed_dps"], 1),
            "conf":  round(conf, 3),
        })

    # ── Averages ─────────────────────────────────────────────────────────
    if reps_detail:
        n_r = len(reps_detail)
        avg_dur  = sum(r["dur"]  for r in reps_detail) / n_r
        avg_phA  = sum(r["phA"]  for r in reps_detail) / n_r
        avg_phB  = sum(r["phB"]  for r in reps_detail) / n_r
        avg_spdA = sum(r["spdA"] for r in reps_detail) / n_r
        avg_spdB = sum(r["spdB"] for r in reps_detail) / n_r
        tut      = sum(r["dur"]  for r in reps_detail)
    else:
        avg_dur = avg_phA = avg_phB = avg_spdA = avg_spdB = tut = 0.0

    err_color  = "#22c55e" if err == 0 else "#ef4444"
    err_symbol = "✓" if err == 0 else f"{err:+d}"

    # ── Table rows ───────────────────────────────────────────────────────
    rows_html = "".join(
        f"<tr>"
        f"<td>{r['i']}</td>"
        f"<td>{r['dur']:.2f}s</td>"
        f"<td>{r['phA']:.2f}s</td>"
        f"<td>{r['phB']:.2f}s</td>"
        f"<td>{r['spdA']:.1f}°/s</td>"
        f"<td>{r['spdB']:.1f}°/s</td>"
        f"<td>{r['conf']:.3f}</td>"
        f"</tr>"
        for r in reps_detail
    )

    charts_block = ""
    if reps_detail:
        rep_labels = json.dumps([f"Rep {r['i']}" for r in reps_detail])
        phA_dur    = json.dumps([r["phA"]  for r in reps_detail])
        phB_dur    = json.dumps([r["phB"]  for r in reps_detail])
        phA_spd    = json.dumps([r["spdA"] for r in reps_detail])
        phB_spd    = json.dumps([r["spdB"] for r in reps_detail])
        charts_block = f"""
  <div class="two-col">
    <div class="card">
      <h3>Phase Duration per Rep</h3>
      <div class="chart-wrap" style="height:200px">
        <canvas id="durChart"></canvas>
      </div>
    </div>
    <div class="card">
      <h3>Phase Speed per Rep (°/s)</h3>
      <div class="chart-wrap" style="height:200px">
        <canvas id="spdChart"></canvas>
      </div>
    </div>
  </div>
  <script>
  (function() {{
    const LABELS = {rep_labels};
    const PH_A_DUR = {phA_dur};
    const PH_B_DUR = {phB_dur};
    const PH_A_SPD = {phA_spd};
    const PH_B_SPD = {phB_spd};
    const barOpts = {{
      responsive: true, maintainAspectRatio: false,
      plugins: {{
        legend: {{ position: 'top', labels: {{ boxWidth: 10, padding: 10 }} }},
        tooltip: {{ callbacks: {{ label: c => c.dataset.label + ': ' + c.raw.toFixed(2) + 's' }} }},
      }},
      scales: {{
        x: {{ stacked: true }},
        y: {{ stacked: true, ticks: {{ callback: v => v.toFixed(1) + 's' }} }},
      }},
    }};
    new Chart(document.getElementById('durChart'), {{
      type: 'bar',
      data: {{
        labels: LABELS,
        datasets: [
          {{ label: 'Phase A', data: PH_A_DUR, backgroundColor: 'rgba(56,189,248,0.8)',  borderRadius: 2 }},
          {{ label: 'Phase B', data: PH_B_DUR, backgroundColor: 'rgba(167,139,250,0.8)', borderRadius: 2 }},
        ],
      }},
      options: barOpts,
    }});
    new Chart(document.getElementById('spdChart'), {{
      type: 'line',
      data: {{
        labels: LABELS,
        datasets: [
          {{ label: 'Phase A', data: PH_A_SPD, borderColor: 'rgba(56,189,248,0.9)',  backgroundColor: 'rgba(56,189,248,0.1)',  pointRadius: 5, tension: 0.3 }},
          {{ label: 'Phase B', data: PH_B_SPD, borderColor: 'rgba(167,139,250,0.9)', backgroundColor: 'rgba(167,139,250,0.1)', pointRadius: 5, tension: 0.3 }},
        ],
      }},
      options: {{
        responsive: true, maintainAspectRatio: false,
        plugins: {{
          legend: {{ position: 'top', labels: {{ boxWidth: 10, padding: 10 }} }},
          tooltip: {{ callbacks: {{ label: c => c.dataset.label + ': ' + c.raw.toFixed(1) + '°/s' }} }},
        }},
        scales: {{
          x: {{}},
          y: {{ ticks: {{ callback: v => v + '°/s' }} }},
        }},
      }},
    }});
  }})();
  </script>"""

    table_block = ""
    if reps_detail:
        table_block = f"""
  <div class="card">
    <h3>Per-rep breakdown</h3>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Total</th><th>Phase A</th><th>Phase B</th>
          <th>Spd A</th><th>Spd B</th><th>Confidence</th>
        </tr>
      </thead>
      <tbody>
        {rows_html}
        <tr class="avg-row">
          <td>avg</td>
          <td>{avg_dur:.2f}s</td><td>{avg_phA:.2f}s</td><td>{avg_phB:.2f}s</td>
          <td>{avg_spdA:.1f}°/s</td><td>{avg_spdB:.1f}°/s</td><td>—</td>
        </tr>
      </tbody>
    </table>
  </div>"""

    # Serialise everything for JS
    signal_full_json = json.dumps({"x": xs_full, "y": ys_full})
    signal_comp_json = json.dumps({"x": xs_comp, "y": ys_comp})
    seg_json         = json.dumps(seg_data)
    turning_json     = json.dumps(turnings)
    recon_a_json     = json.dumps(phase_a_pts)
    recon_b_json     = json.dumps(phase_b_pts)
    y_axis_json      = json.dumps({"min": y_min - y_pad, "max": y_max + y_pad})

    tut_stat = ""
    if reps_detail:
        tut_stat = f"""
    <div class="stat">
      <div class="stat-label">Avg Rep</div>
      <div class="stat-value" style="color:#a78bfa;font-size:1.2rem">{avg_dur:.2f}s</div>
    </div>
    <div class="stat">
      <div class="stat-label">Total TUT</div>
      <div class="stat-value" style="color:#34d399;font-size:1.2rem">{tut:.1f}s</div>
    </div>"""

    recon_block = ""
    if predicted_pairs:
        recon_block = f"""
  <div class="card">
    <h3>Reconstructed signal — from predictions only</h3>
    <p style="font-size:0.75rem;color:#64748b;margin-bottom:0.75rem">
      Built purely from the classifier output: 3 key points per rep (start, turning, end)
      connected by straight lines. Phase A <span style="color:#38bdf8">■</span> and
      Phase B <span style="color:#a78bfa">■</span> are the two directed half-reps.
      Same y-axis scale as the raw signal above for direct comparison.
    </p>
    <div class="chart-wrap" style="height:180px">
      <canvas id="reconChart"></canvas>
    </div>
  </div>
  <script>
  (function() {{
    const PH_A = {recon_a_json};
    const PH_B = {recon_b_json};
    const Y    = {y_axis_json};
    new Chart(document.getElementById('reconChart'), {{
      type: 'scatter',
      data: {{
        datasets: [
          {{
            label: 'Phase A (start → turn)',
            data: PH_A,
            showLine: true, spanGaps: false,
            borderColor: '#38bdf8', borderWidth: 2.5,
            pointRadius: 3, pointBackgroundColor: '#38bdf8',
            tension: 0,
          }},
          {{
            label: 'Phase B (turn → end)',
            data: PH_B,
            showLine: true, spanGaps: false,
            borderColor: '#a78bfa', borderWidth: 2.5,
            pointRadius: 3, pointBackgroundColor: '#a78bfa',
            tension: 0,
          }},
        ],
      }},
      options: {{
        responsive: true, maintainAspectRatio: false,
        animation: false,
        plugins: {{
          legend: {{ position: 'top', labels: {{ boxWidth: 10, padding: 10, color: '#94a3b8' }} }},
          tooltip: {{
            callbacks: {{
              label: c => c.raw.y == null ? '' : (c.dataset.label + ': ' + c.raw.y.toFixed(2) + '° @ ' + c.raw.x.toFixed(2) + 's'),
            }},
          }},
        }},
        scales: {{
          x: {{ type: 'linear', ticks: {{ color: '#64748b', callback: v => v.toFixed(0) + 's' }} }},
          y: {{ min: Y.min, max: Y.max, title: {{ display: true, text: 'signal (°)', color: '#64748b' }}, ticks: {{ color: '#64748b' }} }},
        }},
      }},
    }});
  }})();
  </script>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{rec_name} — LOOCV</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>{_CSS}</style>
</head>
<body>
  <h1>{rec_name}</h1>
  <h2>Leave-One-Out Cross-Validation Report</h2>

  <div class="meta">
    <span class="badge">💪 {muscle}</span>
    <span class="badge">🏋️ {equip}</span>
    <span class="badge">⚙️ {mechanic}</span>
    <span class="badge">Set {set_num}</span>
    <span class="badge">{n} samples · {dur_s:.1f}s</span>
    <span class="badge">{len(labeled_segs)} candidates</span>
    <span class="badge" title="Compressed payload used for chart rendering (preprocessed 1D signal at {payload['signalPoints']} pts + annotations). Full raw file: {orig_file_kb:.1f} KB." style="color:#34d399;border-color:#34d399">
      chart data: {compressed_kb:.1f} KB{f" ({100*compressed_kb/orig_file_kb:.2f}% of {orig_file_kb:.0f} KB raw)" if orig_file_kb else ""}
    </span>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-label">Ground Truth</div>
      <div class="stat-value" style="color:#94a3b8">{gt}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Predicted</div>
      <div class="stat-value" style="color:#38bdf8">{pred}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Error</div>
      <div class="stat-value" style="color:{err_color}">{err_symbol}</div>
    </div>
    {tut_stat}
  </div>

  <p style="font-size:0.75rem;color:#64748b;margin-bottom:0.75rem">
    Best axis selected by spectral concentration score, bandpass-filtered 0.1–3 Hz.
    Coloured regions show candidate segments; dashed yellow lines mark turning points of predicted reps.
  </p>
  <div class="two-col" style="margin-bottom:0.5rem">
    <div class="card" style="margin-bottom:0">
      <h3>Full signal — {len(xs_full)} pts · {full_pts_kb:.1f} KB</h3>
      <div class="chart-wrap" style="height:180px">
        <canvas id="sigChartFull"></canvas>
      </div>
    </div>
    <div class="card" style="margin-bottom:0;border-color:#34d399">
      <h3 style="color:#34d399">Compressed — {len(xs_comp)} pts · {compressed_kb:.1f} KB
        <span style="font-weight:400;color:#64748b">
          ({100*compressed_kb/orig_file_kb:.2f}% of {orig_file_kb:.0f} KB raw file)
        </span>
      </h3>
      <div class="chart-wrap" style="height:180px">
        <canvas id="sigChartComp"></canvas>
      </div>
    </div>
  </div>
  <div class="legend" style="margin-bottom:1.25rem">
    <div class="legend-item">
      <div class="legend-dot" style="background:rgba(34,197,94,0.5)"></div>True positive
    </div>
    <div class="legend-item">
      <div class="legend-dot" style="background:rgba(251,146,60,0.6)"></div>False negative (missed)
    </div>
    <div class="legend-item">
      <div class="legend-dot" style="background:rgba(239,68,68,0.6)"></div>False positive (phantom)
    </div>
    <div class="legend-item">
      <div class="legend-dot" style="background:rgba(156,163,175,0.3)"></div>Noise candidate
    </div>
    <div class="legend-item">
      <div class="legend-dot" style="background:rgba(251,191,36,0.55);height:2px;border-radius:0"></div>Turning point
    </div>
  </div>
  <script>
  {_CHART_JS_PLUGIN}
  {_CHART_DEFAULTS}
  (function() {{
    const SIG_FULL = {signal_full_json};
    const SIG_COMP = {signal_comp_json};
    const SEGS     = {seg_json};
    const TURNS    = {turning_json};
    const Y        = {y_axis_json};
    const scatterOpts = (canvasId, sig) => {{
      const pts = sig.x.map((x, i) => ({{ x, y: sig.y[i] }}));
      new Chart(document.getElementById(canvasId), {{
        type: 'scatter',
        _segData: {{ segments: SEGS, turnings: TURNS }},
        data: {{
          datasets: [{{
            data: pts,
            showLine:    true,
            borderColor: '#38bdf8',
            borderWidth: 1.5,
            pointRadius: 0,
            tension:     0,
          }}],
        }},
        options: {{
          responsive: true, maintainAspectRatio: false,
          animation: false,
          plugins: {{ legend: {{ display: false }}, tooltip: {{ enabled: false }} }},
          scales: {{
            x: {{ type: 'linear', ticks: {{ color: '#64748b', callback: v => v.toFixed(0) + 's' }} }},
            y: {{ min: Y.min, max: Y.max, title: {{ display: true, text: 'signal (°)', color: '#64748b' }}, ticks: {{ color: '#64748b' }} }},
          }},
        }},
      }});
    }};
    scatterOpts('sigChartFull', SIG_FULL);
    scatterOpts('sigChartComp', SIG_COMP);
  }})();
  </script>

  {recon_block}
  {charts_block}
  {table_block}
</body>
</html>"""


# ---------------------------------------------------------------------------
# Index page
# ---------------------------------------------------------------------------

def generate_index(results: list) -> str:
    rows = []
    for r in sorted(results, key=lambda x: abs(x["err"]), reverse=True):
        err_color = "#22c55e" if r["err"] == 0 else "#ef4444"
        err_str   = "✓" if r["err"] == 0 else f"{r['err']:+d}"
        rows.append(
            f'<tr>'
            f'<td><a href="{r["html"]}" style="color:#38bdf8;text-decoration:none">{r["name"]}</a></td>'
            f'<td>{r["muscle"]}</td>'
            f'<td style="text-align:center">{r["gt"]}</td>'
            f'<td style="text-align:center">{r["pred"]}</td>'
            f'<td style="text-align:center;color:{err_color};font-weight:600">{err_str}</td>'
            f'</tr>'
        )

    exact  = sum(1 for r in results if r["err"] == 0)
    total  = len(results)
    mae    = sum(abs(r["err"]) for r in results) / total if total else 0
    pct    = 100 * exact // total if total else 0

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LOOCV Summary</title>
  <style>
    body {{ font-family: system-ui, sans-serif; background:#0f172a; color:#e2e8f0; padding:2rem; }}
    h1 {{ font-size:1.3rem; font-weight:700; color:#f8fafc; margin-bottom:0.25rem; }}
    p  {{ color:#64748b; font-size:0.85rem; margin-bottom:1.5rem; }}
    .stats {{ display:flex; gap:1rem; margin-bottom:1.5rem; }}
    .stat {{ background:#1e293b; border:1px solid #334155; border-radius:0.65rem;
             padding:0.85rem 1.25rem; }}
    .stat-label {{ font-size:0.7rem; color:#64748b; margin-bottom:0.2rem; }}
    .stat-value {{ font-size:1.4rem; font-weight:700; }}
    table {{ border-collapse:collapse; width:100%; font-size:0.85rem; }}
    th {{ text-align:left; padding:0.45rem 0.75rem; font-size:0.7rem; color:#64748b;
          border-bottom:1px solid #334155; text-transform:uppercase; letter-spacing:0.06em; }}
    td {{ padding:0.45rem 0.75rem; border-bottom:1px solid #1e293b; color:#cbd5e1; }}
    tr:last-child td {{ border-bottom:none; }}
    tr:hover td {{ background:#1e293b; }}
  </style>
</head>
<body>
  <h1>LOOCV Summary</h1>
  <p>Each row trained on all other recordings, tested on this one. Click to view the full report.</p>
  <div class="stats">
    <div class="stat">
      <div class="stat-label">MAE</div>
      <div class="stat-value" style="color:#38bdf8">{mae:.2f}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Exact match</div>
      <div class="stat-value" style="color:#22c55e">{exact}/{total} ({pct}%)</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Recording</th><th>Muscle</th>
        <th style="text-align:center">True</th>
        <th style="text-align:center">Pred</th>
        <th style="text-align:center">Err</th>
      </tr>
    </thead>
    <tbody>{"".join(rows)}</tbody>
  </table>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    OUTPUT_HTML_DIR.mkdir(parents=True, exist_ok=True)

    print("\n── Building segment dataset ────────────────────────────────────")
    df = build_segment_dataset()

    if len(df) == 0:
        sys.exit("No segments. Check that recordings have a 'reps' field.")

    recordings = sorted(df["recording_id"].unique())
    print(f"\n  {len(recordings)} recordings · {len(df)} total segments")
    print(f"\n── Generating LOOCV reports ────────────────────────────────────")

    results = []
    for rec_name in recordings:
        print(f"  {rec_name} … ", end="", flush=True)

        rec_path = ROOT / "recordings" / rec_name
        orig_file_kb = rec_path.stat().st_size / 1024
        with open(rec_path) as f:
            data = json.load(f)

        samples = data.get("samples", [])
        if len(samples) < 20:
            print("SKIP (too short)")
            continue

        signal_1d, timestamps = preprocess_to_1d(samples)
        all_segs = over_segment(signal_1d, timestamps)
        if not all_segs:
            print("SKIP (no segments)")
            continue

        for seg in all_segs:
            chunk          = signal_1d[seg["start_idx"]: seg["end_idx"] + 1]
            seg["amplitude"] = float(chunk.max() - chunk.min())
            dur            = float(timestamps[seg["end_idx"]] - timestamps[seg["start_idx"]])
            avg_dt         = (dur / 1000.0) / max(1, len(chunk) - 1)
            seg["energy"]  = float(np.sum(chunk ** 2) * avg_dt)

        n_reps = int(data.get("reps", 0))
        labeled = pseudo_label_segments(list(all_segs), n_reps)
        if labeled is None:
            print("SKIP (under-segmented)")
            continue

        # Train LOOCV model
        clf = train_excluding(df, rec_name)

        metadata = {
            "muscleGroup":   data.get("muscleGroup"),
            "equipmentType": data.get("equipmentType"),
            "mechanicType":  data.get("mechanicType"),
            "setNumber":     data.get("setNumber"),
        }
        features = []
        for idx, seg in enumerate(labeled):
            feats = extract_segment_features(idx, seg, signal_1d, timestamps, labeled, metadata)
            features.append([feats.get(col, 0.0) for col in SEGMENT_FEATURE_COLS])

        probs = clf.predict_proba(np.array(features))[:, 1]
        predicted_pairs = [(seg, float(p)) for seg, p in zip(labeled, probs) if p > 0.5]
        predicted_pairs.sort(key=lambda x: x[0]["start_ts"])

        pred_count = len(predicted_pairs)
        err = pred_count - n_reps
        marker = "" if err == 0 else f"  ← {err:+d}"
        print(f"true={n_reps}  pred={pred_count}{marker}")

        html = generate_html(
            rec_name, data, signal_1d, timestamps, labeled, predicted_pairs,
            orig_file_kb=orig_file_kb,
        )
        html_filename = rec_name.replace(".json", ".html")
        (OUTPUT_HTML_DIR / html_filename).write_text(html, encoding="utf-8")

        results.append({
            "name":   rec_name,
            "html":   html_filename,
            "muscle": data.get("muscleGroup", "unknown"),
            "gt":     n_reps,
            "pred":   pred_count,
            "err":    err,
        })

    # Index page
    (OUTPUT_HTML_DIR / "index.html").write_text(generate_index(results), encoding="utf-8")

    exact = sum(1 for r in results if r["err"] == 0)
    total = len(results)
    mae   = sum(abs(r["err"]) for r in results) / total if total else 0

    print(f"\n── Summary ─────────────────────────────────────────────────────")
    print(f"  Reports saved → output/html/")
    print(f"  MAE: {mae:.2f}  ·  Exact match: {exact}/{total} ({100*exact//total if total else 0}%)")
    print(f"  Open: output/html/index.html\n")


if __name__ == "__main__":
    main()
