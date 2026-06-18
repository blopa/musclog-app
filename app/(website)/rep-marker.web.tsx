'use client';

import Head from 'expo-router/head';
import {
  Download,
  FileJson,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Upload,
  Video,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GridPattern } from '@/components/website/WebsiteBackgrounds';
import { computePosition, type DeadReckoningSample } from '@/utils/deadReckoning';

// ── Color palette ──────────────────────────────────────────────────────────

const BRAND_GREEN = '#22C55E';
const BRAND_GREEN_BRIGHT = '#00FFA3';
const BODY_TEXT = '#D1D5DB';
const BODY_TEXT_SOFT = '#9CA3AF';
const MUTED = '#6B7280';
const CARD_BG = 'rgba(255,255,255,0.03)';
const CARD_BORDER = 'rgba(255,255,255,0.10)';
const INPUT_BG = 'rgba(255,255,255,0.06)';
const INPUT_BORDER = 'rgba(255,255,255,0.12)';
const ACCENT_YELLOW = '#F59E0B';
const ACCENT_RED = '#EF4444';

// Channels match the Python tool: dead-reckoned world-frame position (default
// visible) plus raw accel magnitude (drift-free reference, hidden by default).
type ChannelKey = 'px' | 'py' | 'pz' | 'accelMag';

const CHART_COLORS: Record<ChannelKey, string> = {
  accelMag: '#FFFFFF',
  px: '#F97316',
  py: '#FBBF24',
  pz: '#A3E635',
};

const CHART_LABELS: Record<ChannelKey, string> = {
  accelMag: 'accel |a|',
  px: 'pos.x',
  py: 'pos.y',
  pz: 'pos.z',
};

const DEFAULT_VISIBLE: Record<ChannelKey, boolean> = {
  accelMag: false,
  px: true,
  py: true,
  pz: true,
};

// ── Types ──────────────────────────────────────────────────────────────────

interface RepMarker {
  /** Absolute wall-clock milliseconds, matching the Python tool's output. */
  startMs: number;
  endMs: number;
}

interface RecordingJson {
  samples: DeadReckoningSample[];
  startedAt?: string;
  repMarkers?: RepMarker[];
  [key: string]: unknown;
}

interface ChartData {
  /** Time relative to `startedAtMs` (ms); may start slightly negative (pre-roll). */
  timeMs: number[];
  px: number[];
  py: number[];
  pz: number[];
  accelMag: number[];
  domainMinMs: number;
  domainMaxMs: number;
  /** Absolute wall-clock anchor (video currentTime 0 == this instant). */
  startedAtMs: number;
}

// ── Data processing ─────────────────────────────────────────────────────────

const MAX_CHART_POINTS = 3000;

function buildChartData(raw: RecordingJson): ChartData {
  const dr = computePosition(raw.samples);
  const total = dr.timestampsMs.length;
  const startedAtMs = raw.startedAt ? Date.parse(raw.startedAt) : (dr.timestampsMs[0] ?? 0);

  const timeMs: number[] = [];
  const px: number[] = [];
  const py: number[] = [];
  const pz: number[] = [];
  const accelMag: number[] = [];

  const step = Math.max(1, Math.floor(total / MAX_CHART_POINTS));
  for (let i = 0; i < total; i += step) {
    timeMs.push(dr.timestampsMs[i] - startedAtMs);
    px.push(dr.px[i]);
    py.push(dr.py[i]);
    pz.push(dr.pz[i]);
    accelMag.push(dr.accelMagG[i]);
  }

  return {
    accelMag,
    domainMaxMs: timeMs[timeMs.length - 1] ?? 0,
    domainMinMs: timeMs[0] ?? 0,
    px,
    py,
    pz,
    startedAtMs,
    timeMs,
  };
}

// ── Canvas chart drawing ─────────────────────────────────────────────────────

const PADDING = { bottom: 32, left: 12, right: 12, top: 8 };

function drawChart(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: ChartData,
  markers: RepMarker[],
  pendingStartMs: number | null,
  cursorMs: number,
  visibleChannels: Record<ChannelKey, boolean>
) {
  const { accelMag, domainMaxMs, domainMinMs, px, py, pz, startedAtMs, timeMs } = data;
  const pL = PADDING.left;
  const pR = PADDING.right;
  const pT = PADDING.top;
  const pB = PADDING.bottom;
  const chartW = width - pL - pR;
  const chartH = height - pT - pB;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, height);

  const span = domainMaxMs - domainMinMs;
  if (!timeMs.length || span <= 0) {
    ctx.fillStyle = MUTED;
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data', width / 2, height / 2);
    return;
  }

  const channels: { key: ChannelKey; data: number[] }[] = [
    { data: px, key: 'px' },
    { data: py, key: 'py' },
    { data: pz, key: 'pz' },
    { data: accelMag, key: 'accelMag' },
  ];

  // Y range from visible channels only (shared axis, like the Python chart).
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const ch of channels) {
    if (!visibleChannels[ch.key]) {
      continue;
    }
    for (const v of ch.data) {
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
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
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
    ctx.fillStyle = 'rgba(34,197,94,0.15)';
    ctx.fillRect(x1, pT, x2 - x1, chartH);
    ctx.strokeStyle = 'rgba(34,197,94,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, pT);
    ctx.lineTo(x1, pT + chartH);
    ctx.moveTo(x2, pT);
    ctx.lineTo(x2, pT + chartH);
    ctx.stroke();
  }

  // Channel traces
  for (const ch of channels) {
    if (!visibleChannels[ch.key] || !ch.data.length) {
      continue;
    }
    ctx.strokeStyle = CHART_COLORS[ch.key];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < ch.data.length; i++) {
      const x = xForMs(timeMs[i]);
      const y = yForVal(ch.data[i]);
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
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, pT);
  ctx.lineTo(x, pT + chartH);
  ctx.stroke();
}

// ── Time formatting (relative ms → m:ss.s) ───────────────────────────────────

function fmtMs(ms: number): string {
  const sign = ms < 0 ? '-' : '';
  const totalSec = Math.abs(ms) / 1000;
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toFixed(1).padStart(4, '0');
  return `${sign}${m}:${s}`;
}

// ── Drop zone component ─────────────────────────────────────────────────────

function DropZone({
  accept,
  icon,
  label,
  hint,
  loadedLabel,
  isLoaded,
  error,
  onFile,
}: {
  accept: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  loadedLabel: string;
  isLoaded: boolean;
  error?: string;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      onFile(file);
    }
  };

  const borderColor = (() => {
    if (error) {
      return ACCENT_RED;
    }
    if (isLoaded) {
      return BRAND_GREEN;
    }
    return dragging ? BRAND_GREEN_BRIGHT : INPUT_BORDER;
  })();

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-colors"
      style={{
        backgroundColor: dragging ? 'rgba(0,255,163,0.06)' : CARD_BG,
        borderColor,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            onFile(f);
          }
        }}
      />
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl"
        style={{
          backgroundColor: isLoaded ? 'rgba(34,197,94,0.15)' : INPUT_BG,
          border: `1px solid ${isLoaded ? 'rgba(34,197,94,0.4)' : INPUT_BORDER}`,
        }}
      >
        {icon}
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold" style={{ color: isLoaded ? BRAND_GREEN : BODY_TEXT }}>
          {isLoaded ? loadedLabel : label}
        </p>
        {!isLoaded ? (
          <p className="mt-1 text-xs" style={{ color: MUTED }}>
            {hint}
          </p>
        ) : null}
        {error ? (
          <p className="mt-1 text-xs" style={{ color: ACCENT_RED }}>
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function RepMarkerPage() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.repMarker' });

  const [phase, setPhase] = useState<'upload' | 'editor'>('upload');

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState('');
  const [jsonData, setJsonData] = useState<RecordingJson | null>(null);
  const [jsonName, setJsonName] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [chartData, setChartData] = useState<ChartData | null>(null);

  const [markers, setMarkers] = useState<RepMarker[]>([]);
  const [pendingStartMs, setPendingStartMs] = useState<number | null>(null);
  const [markState, setMarkState] = useState<'idle' | 'waitingEnd'>('idle');

  const [visibleChannels, setVisibleChannels] =
    useState<Record<ChannelKey, boolean>>(DEFAULT_VISIBLE);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startedAtMs = chartData?.startedAtMs ?? 0;

  // ── File handlers ──────────────────────────────────────────────────────

  const handleVideoFile = (file: File) => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoName(file.name);
    if (jsonData) {
      setPhase('editor');
    }
  };

  const handleJsonFile = (file: File) => {
    setJsonError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as RecordingJson;
        if (!parsed.samples || !Array.isArray(parsed.samples)) {
          setJsonError(t('invalidJson'));
          return;
        }
        const cd = buildChartData(parsed);
        setJsonData(parsed);
        setJsonName(file.name);
        setChartData(cd);
        // Existing markers are stored as absolute wall-clock ms (Python format).
        setMarkers(
          parsed.repMarkers?.length
            ? [...parsed.repMarkers].sort((a, b) => a.startMs - b.startMs)
            : []
        );
        if (videoUrl) {
          setPhase('editor');
        }
      } catch {
        setJsonError(t('invalidJson'));
      }
    };
    reader.readAsText(file);
  };

  // ── Marking actions ────────────────────────────────────────────────────

  const triggerMarkStart = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setPendingStartMs(video.currentTime * 1000);
    setMarkState('waitingEnd');
  }, []);

  const triggerMarkEnd = useCallback(() => {
    const video = videoRef.current;
    if (!video || markState !== 'waitingEnd' || pendingStartMs === null) {
      return;
    }
    const endRel = video.currentTime * 1000;
    const startRel = pendingStartMs;
    const lo = Math.min(startRel, endRel);
    const hi = Math.max(startRel, endRel);
    setMarkers((prev) =>
      [...prev, { endMs: startedAtMs + hi, startMs: startedAtMs + lo }].sort(
        (a, b) => a.startMs - b.startMs
      )
    );
    setPendingStartMs(null);
    setMarkState('idle');
  }, [markState, pendingStartMs, startedAtMs]);

  const handleUndo = () => setMarkers((prev) => prev.slice(0, -1));

  const handleClearAll = () => {
    setMarkers([]);
    setPendingStartMs(null);
    setMarkState('idle');
  };

  // ── Canvas click → seek video ──────────────────────────────────────────

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !chartData) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const fraction =
      (e.clientX - rect.left - PADDING.left) / (rect.width - PADDING.left - PADDING.right);
    const span = chartData.domainMaxMs - chartData.domainMinMs;
    const relMs = chartData.domainMinMs + Math.max(0, Math.min(1, fraction)) * span;
    video.currentTime = Math.max(0, relMs / 1000);
  };

  // ── Canvas draw loop ───────────────────────────────────────────────────

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !chartData) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    const cursorMs = (videoRef.current?.currentTime ?? 0) * 1000;
    drawChart(
      ctx,
      canvas.width / window.devicePixelRatio,
      canvas.height / window.devicePixelRatio,
      chartData,
      markers,
      pendingStartMs,
      cursorMs,
      visibleChannels
    );
  }, [chartData, markers, pendingStartMs, visibleChannels]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // rAF loop drives the cursor during playback.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const startLoop = () => {
      const loop = () => {
        redraw();
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    };
    const stopLoop = () => {
      cancelAnimationFrame(rafRef.current);
      redraw();
    };
    video.addEventListener('play', startLoop);
    video.addEventListener('pause', stopLoop);
    video.addEventListener('ended', stopLoop);
    video.addEventListener('seeked', redraw);
    return () => {
      video.removeEventListener('play', startLoop);
      video.removeEventListener('pause', stopLoop);
      video.removeEventListener('ended', stopLoop);
      video.removeEventListener('seeked', redraw);
      cancelAnimationFrame(rafRef.current);
    };
  }, [redraw]);

  // Keep canvas backing store sized to its CSS box.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const observer = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      redraw();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'editor') {
      return;
    }
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        triggerMarkStart();
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        triggerMarkEnd();
      } else if (e.key === ' ') {
        e.preventDefault();
        const v = videoRef.current;
        if (v) {
          if (v.paused) {
            void v.play();
          } else {
            v.pause();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, triggerMarkStart, triggerMarkEnd]);

  // ── Download JSON (full original + repMarkers in absolute ms) ───────────

  const handleDownload = () => {
    if (!jsonData) {
      return;
    }
    const output: RecordingJson = {
      ...jsonData,
      repMarkers: [...markers].sort((a, b) => a.startMs - b.startMs),
    };
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = jsonName.replace(/\.json$/i, '_marked.json');
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ─────────────────────────────────────────────────────────────

  const markerCount = markers.length;

  return (
    <>
      <Head>
        <title>{t('title')} | Musclog</title>
      </Head>
      <main className="relative min-h-screen overflow-hidden pb-20 pt-28">
        <GridPattern className="opacity-30" />
        <div
          className="absolute left-1/4 top-32 h-72 w-72 rounded-full blur-[100px]"
          style={{ backgroundColor: 'rgba(0,255,163,0.06)' }}
        />

        <div className="container relative z-10 mx-auto max-w-7xl px-4">
          {/* Title */}
          <div className="mb-8 text-center">
            <h1 className="mb-3 text-4xl font-black tracking-tight text-white md:text-5xl">
              {t('title')}
            </h1>
            <p
              className="mx-auto max-w-lg text-sm leading-relaxed"
              style={{ color: BODY_TEXT_SOFT }}
            >
              {t('description')}
            </p>
          </div>

          {/* ── Upload phase ─────────────────────────────────────────────────── */}
          {phase === 'upload' ? (
            <div className="mx-auto max-w-2xl">
              <div className="grid gap-4 sm:grid-cols-2">
                <DropZone
                  accept="video/*"
                  icon={<Video size={22} color={videoUrl ? BRAND_GREEN : BODY_TEXT_SOFT} />}
                  label={t('uploadVideo')}
                  hint={t('dragDropVideo')}
                  loadedLabel={t('videoLoaded')}
                  isLoaded={!!videoUrl}
                  onFile={handleVideoFile}
                />
                <DropZone
                  accept="application/json,.json"
                  icon={<FileJson size={22} color={jsonData ? BRAND_GREEN : BODY_TEXT_SOFT} />}
                  label={t('uploadJson')}
                  hint={t('dragDropJson')}
                  loadedLabel={t('jsonLoaded')}
                  isLoaded={!!jsonData}
                  error={jsonError}
                  onFile={handleJsonFile}
                />
              </div>
            </div>
          ) : null}

          {/* ── Editor phase ─────────────────────────────────────────────────── */}
          {phase === 'editor' && chartData ? (
            <div className="flex flex-col gap-4">
              {/* Top panels: video + chart */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Video player */}
                <div
                  className="overflow-hidden rounded-2xl border"
                  style={{ backgroundColor: '#000', borderColor: CARD_BORDER }}
                >
                  <video
                    ref={videoRef}
                    src={videoUrl ?? undefined}
                    controls
                    className="w-full"
                    style={{ display: 'block', maxHeight: 360 }}
                  />
                  <div className="px-4 py-2">
                    <p className="truncate text-xs" style={{ color: MUTED }}>
                      {videoName}
                    </p>
                  </div>
                </div>

                {/* Chart */}
                <div
                  className="flex flex-col rounded-2xl border p-3"
                  style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
                >
                  {/* Channel legend */}
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    {(Object.keys(CHART_COLORS) as ChannelKey[]).map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setVisibleChannels((prev) => ({ ...prev, [ch]: !prev[ch] }))}
                        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold transition-opacity"
                        style={{
                          color: visibleChannels[ch] ? CHART_COLORS[ch] : MUTED,
                          opacity: visibleChannels[ch] ? 1 : 0.4,
                        }}
                      >
                        <span
                          className="inline-block h-2 w-4 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[ch] }}
                        />
                        {CHART_LABELS[ch]}
                      </button>
                    ))}
                    <span className="ml-auto text-xs" style={{ color: MUTED }}>
                      {t('seekHint')}
                    </span>
                  </div>

                  {/* Canvas */}
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className="w-full flex-1 cursor-crosshair rounded-xl"
                    style={{ height: 280 }}
                  />
                </div>
              </div>

              {/* Controls bar */}
              <div
                className="flex flex-wrap items-center gap-2 rounded-2xl border px-5 py-4"
                style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
              >
                <button
                  type="button"
                  onClick={triggerMarkStart}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors"
                  style={{
                    backgroundColor:
                      markState === 'waitingEnd' ? 'rgba(245,158,11,0.2)' : 'rgba(0,255,163,0.15)',
                    border: `1px solid ${markState === 'waitingEnd' ? ACCENT_YELLOW : BRAND_GREEN_BRIGHT}`,
                    color: markState === 'waitingEnd' ? ACCENT_YELLOW : BRAND_GREEN_BRIGHT,
                  }}
                >
                  <Play size={14} color="currentColor" />
                  {t('markStart')} <span style={{ color: MUTED }}>(S)</span>
                </button>

                <button
                  type="button"
                  onClick={triggerMarkEnd}
                  disabled={markState !== 'waitingEnd'}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors"
                  style={{
                    backgroundColor: markState === 'waitingEnd' ? 'rgba(34,197,94,0.2)' : INPUT_BG,
                    border: `1px solid ${markState === 'waitingEnd' ? BRAND_GREEN : INPUT_BORDER}`,
                    color: markState === 'waitingEnd' ? BRAND_GREEN : MUTED,
                    cursor: markState !== 'waitingEnd' ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Pause size={14} color="currentColor" />
                  {t('markEnd')} <span style={{ color: MUTED }}>(E)</span>
                </button>

                {markState === 'waitingEnd' ? (
                  <span className="text-xs font-semibold" style={{ color: ACCENT_YELLOW }}>
                    {t('waitingEnd')}
                  </span>
                ) : null}

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={markerCount === 0}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: INPUT_BG,
                      border: `1px solid ${INPUT_BORDER}`,
                      color: markerCount === 0 ? MUTED : BODY_TEXT,
                      cursor: markerCount === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <RotateCcw size={12} color="currentColor" />
                    {t('undo')}
                  </button>

                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={markerCount === 0}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: markerCount > 0 ? 'rgba(239,68,68,0.12)' : INPUT_BG,
                      border: `1px solid ${markerCount > 0 ? 'rgba(239,68,68,0.4)' : INPUT_BORDER}`,
                      color: markerCount > 0 ? ACCENT_RED : MUTED,
                      cursor: markerCount === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Trash2 size={12} color="currentColor" />
                    {t('clearAll')}
                  </button>
                </div>
              </div>

              {/* Keyboard hint */}
              <p className="text-center text-xs" style={{ color: MUTED }}>
                {t('keyboardHint')}
              </p>

              {/* Markers table */}
              <div
                className="overflow-hidden rounded-2xl border"
                style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
              >
                <div
                  className="flex items-center justify-between px-5 py-3"
                  style={{ borderBottom: `1px solid ${CARD_BORDER}` }}
                >
                  <span className="text-xs font-bold tracking-wider text-white">
                    {t('markerCount', { count: markerCount })}
                  </span>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={markerCount === 0}
                    className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors"
                    style={{
                      backgroundColor: markerCount > 0 ? 'rgba(0,255,163,0.15)' : INPUT_BG,
                      border: `1px solid ${markerCount > 0 ? BRAND_GREEN_BRIGHT : INPUT_BORDER}`,
                      color: markerCount > 0 ? BRAND_GREEN_BRIGHT : MUTED,
                      cursor: markerCount === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Download size={14} color="currentColor" />
                    {t('downloadJson')}
                  </button>
                </div>

                {markerCount === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm" style={{ color: MUTED }}>
                      {t('noMarkers')}
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
                        {[t('repNumber'), t('startTime'), t('endTime'), t('duration'), ''].map(
                          (h, i) => (
                            <th
                              key={i}
                              className="px-4 py-2 text-left text-xs font-semibold tracking-wider"
                              style={{ color: MUTED }}
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {markers.map((m, i) => (
                        <tr
                          key={i}
                          style={{ borderBottom: `1px solid ${CARD_BORDER}` }}
                          className="transition-colors hover:bg-white/[0.02]"
                        >
                          <td className="px-4 py-3 font-bold" style={{ color: BRAND_GREEN }}>
                            #{i + 1}
                          </td>
                          <td className="px-4 py-3 font-mono" style={{ color: BODY_TEXT }}>
                            {fmtMs(m.startMs - startedAtMs)}
                          </td>
                          <td className="px-4 py-3 font-mono" style={{ color: BODY_TEXT }}>
                            {fmtMs(m.endMs - startedAtMs)}
                          </td>
                          <td className="px-4 py-3 font-mono" style={{ color: BODY_TEXT_SOFT }}>
                            {((m.endMs - m.startMs) / 1000).toFixed(1)}s
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                setMarkers((prev) => prev.filter((_, idx) => idx !== i))
                              }
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors"
                              style={{ border: '1px solid transparent', color: MUTED }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = ACCENT_RED;
                                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = MUTED;
                                e.currentTarget.style.borderColor = 'transparent';
                              }}
                            >
                              <Trash2 size={12} color="currentColor" />
                              {t('delete')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Re-upload links */}
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setPhase('upload');
                    setVideoUrl(null);
                    setVideoName('');
                  }}
                  className="flex items-center gap-1.5 text-xs transition-colors"
                  style={{ color: MUTED }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = BODY_TEXT)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = MUTED)}
                >
                  <Upload size={11} color="currentColor" />
                  {t('uploadVideo')}
                </button>
                <span style={{ color: CARD_BORDER }}>·</span>
                <button
                  type="button"
                  onClick={() => {
                    setJsonData(null);
                    setJsonName('');
                    setChartData(null);
                    setMarkers([]);
                    setPhase('upload');
                  }}
                  className="flex items-center gap-1.5 text-xs transition-colors"
                  style={{ color: MUTED }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = BODY_TEXT)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = MUTED)}
                >
                  <Upload size={11} color="currentColor" />
                  {t('uploadJson')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
