import { brand, ink, MUTED, surface } from '@/components/website/websiteColors';
import type { ChannelKey, ChartData, RepMarker } from '@/utils/repMarkerData';

import { ACCENT_YELLOW, CHART_COLORS } from './chartChannels';

// ── Canvas chart drawing ─────────────────────────────────────────────────────

export const PADDING = { bottom: 32, left: 12, right: 12, top: 8 };

export function drawChart(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: ChartData,
  channelKeys: ChannelKey[],
  markers: RepMarker[],
  pendingStartMs: number | null,
  cursorMs: number,
  visibleChannels: Record<ChannelKey, boolean>
) {
  const { domainMaxMs, domainMinMs, series, startedAtMs, timeMs } = data;
  const pL = PADDING.left;
  const pR = PADDING.right;
  const pT = PADDING.top;
  const pB = PADDING.bottom;
  const chartW = width - pL - pR;
  const chartH = height - pT - pB;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = surface();
  ctx.fillRect(0, 0, width, height);

  const span = domainMaxMs - domainMinMs;
  if (!timeMs.length || span <= 0) {
    ctx.fillStyle = MUTED;
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data', width / 2, height / 2);
    return;
  }

  // Y range from visible channels only (shared axis, like the Python chart).
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const key of channelKeys) {
    if (!visibleChannels[key]) {
      continue;
    }
    for (const v of series[key]) {
      if (v < yMin) {
        yMin = v;
      }
      if (v > yMax) {
        yMax = v;
      }
    }
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    yMin = -1;
    yMax = 1;
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const yRange = yMax - yMin;

  const xForMs = (ms: number) => {
    const x = pL + ((ms - domainMinMs) / span) * chartW;
    return Math.max(pL, Math.min(pL + chartW, x));
  };
  const yForVal = (v: number) => pT + chartH - ((v - yMin) / yRange) * chartH;

  // Grid lines
  ctx.strokeStyle = ink(0.05);
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = pT + (chartH * i) / 5;
    ctx.beginPath();
    ctx.moveTo(pL, y);
    ctx.lineTo(pL + chartW, y);
    ctx.stroke();
  }

  // Time axis labels (relative seconds)
  ctx.fillStyle = MUTED;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i <= 6; i++) {
    const ms = domainMinMs + (span * i) / 6;
    ctx.fillText(`${(ms / 1000).toFixed(1)}s`, xForMs(ms), height - 4);
  }

  // Committed marker regions (absolute ms → relative for drawing)
  for (const m of markers) {
    const x1 = xForMs(m.startMs - startedAtMs);
    const x2 = xForMs(m.endMs - startedAtMs);
    ctx.fillStyle = brand(0.15);
    ctx.fillRect(x1, pT, x2 - x1, chartH);
    ctx.strokeStyle = brand(0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, pT);
    ctx.lineTo(x1, pT + chartH);
    ctx.moveTo(x2, pT);
    ctx.lineTo(x2, pT + chartH);
    ctx.stroke();
  }

  // Channel traces
  for (const key of channelKeys) {
    const arr = series[key];
    if (!visibleChannels[key] || !arr.length) {
      continue;
    }
    ctx.strokeStyle = CHART_COLORS[key];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < arr.length; i++) {
      const x = xForMs(timeMs[i]);
      const y = yForVal(arr[i]);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  // Pending start line (dashed yellow) — relative ms
  if (pendingStartMs !== null) {
    const x = xForMs(pendingStartMs);
    ctx.strokeStyle = ACCENT_YELLOW;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, pT);
    ctx.lineTo(x, pT + chartH);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Cursor line (current video time, relative ms)
  const x = xForMs(cursorMs);
  ctx.strokeStyle = ink(0.85);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, pT);
  ctx.lineTo(x, pT + chartH);
  ctx.stroke();
}
