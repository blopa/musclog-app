import { computePosition, type DeadReckoningSample } from '@/utils/deadReckoning';

/** The plottable series of a recording. */
export type ChannelKey =
  'angleX' | 'angleY' | 'angleZ' | 'accelX' | 'accelY' | 'accelZ' | 'accelMag' | 'px' | 'py' | 'pz';

// ── Types ──────────────────────────────────────────────────────────────────

export interface RepMarker {
  /** Absolute wall-clock milliseconds, matching the Python tool's output. */
  startMs: number;
  endMs: number;
}

export interface RecordingJson {
  samples: DeadReckoningSample[];
  startedAt?: string;
  repMarkers?: RepMarker[];
  [key: string]: unknown;
}

export interface ChartData {
  /** Time relative to `startedAtMs` (ms); may start slightly negative (pre-roll). */
  timeMs: number[];
  /** All plottable series, keyed by channel. */
  series: Record<ChannelKey, number[]>;
  domainMinMs: number;
  domainMaxMs: number;
  /** Absolute wall-clock anchor (video currentTime 0 == this instant). */
  startedAtMs: number;
}

// ── Data processing ─────────────────────────────────────────────────────────

const MAX_CHART_POINTS = 3000;

export function buildChartData(raw: RecordingJson): ChartData {
  // Sort once so the raw samples line up index-for-index with the dead-reckoning
  // output (computePosition sorts internally and returns timestamp-sorted arrays).
  const sorted = raw.samples.slice().sort((a, b) => a.timestamp - b.timestamp);
  const dr = computePosition(sorted);
  const total = dr.timestampsMs.length;
  const startedAtMs = raw.startedAt ? Date.parse(raw.startedAt) : (dr.timestampsMs[0] ?? 0);

  const timeMs: number[] = [];
  const series: Record<ChannelKey, number[]> = {
    accelMag: [],
    accelX: [],
    accelY: [],
    accelZ: [],
    angleX: [],
    angleY: [],
    angleZ: [],
    px: [],
    py: [],
    pz: [],
  };

  const step = Math.max(1, Math.floor(total / MAX_CHART_POINTS));
  for (let i = 0; i < total; i += step) {
    const s = sorted[i];
    timeMs.push(dr.timestampsMs[i] - startedAtMs);
    series.px.push(dr.px[i]);
    series.py.push(dr.py[i]);
    series.pz.push(dr.pz[i]);
    series.accelMag.push(dr.accelMagG[i]);
    series.accelX.push(s.accel.x);
    series.accelY.push(s.accel.y);
    series.accelZ.push(s.accel.z);
    series.angleX.push(s.angle?.x ?? 0);
    series.angleY.push(s.angle?.y ?? 0);
    series.angleZ.push(s.angle?.z ?? 0);
  }

  return {
    domainMaxMs: timeMs[timeMs.length - 1] ?? 0,
    domainMinMs: timeMs[0] ?? 0,
    series,
    startedAtMs,
    timeMs,
  };
}

// ── Time formatting (relative ms → m:ss.s) ───────────────────────────────────

export function fmtMs(ms: number): string {
  const sign = ms < 0 ? '-' : '';
  const totalSec = Math.abs(ms) / 1000;
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toFixed(1).padStart(4, '0');
  return `${sign}${m}:${s}`;
}
