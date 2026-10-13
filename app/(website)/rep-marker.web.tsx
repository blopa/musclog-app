'use client';

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

import {
  ACCEL_CHANNELS,
  ACCEL_DEFAULT,
  ACCENT_RED,
  ACCENT_YELLOW,
  ORIENTATION_CHANNELS,
  ORIENTATION_DEFAULT,
} from '@/components/website/repMarker/chartChannels';
import { ChartPanel } from '@/components/website/repMarker/ChartPanel';
import { DropZone } from '@/components/website/repMarker/DropZone';
import { GridPattern } from '@/components/website/WebsiteBackgrounds';
import {
  BODY_TEXT,
  BODY_TEXT_SOFT,
  brand,
  BRAND_GREEN,
  BRAND_GREEN_BRIGHT,
  brandBright,
  CARD_BG,
  CARD_BORDER,
  hue,
  INPUT_BG,
  INPUT_BORDER,
  MUTED,
  scrim,
} from '@/components/website/websiteColors';
import {
  buildChartData,
  type ChartData,
  fmtMs,
  type RecordingJson,
  type RepMarker,
} from '@/utils/repMarkerData';

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

  const videoRef = useRef<HTMLVideoElement>(null);
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
      <main className="relative min-h-screen overflow-hidden pb-20 pt-28">
        <GridPattern className="opacity-30" />
        <div
          className="absolute left-1/4 top-32 h-72 w-72 rounded-full blur-[100px]"
          style={{ backgroundColor: brandBright(0.06) }}
        />

        <div className="container relative z-10 mx-auto max-w-7xl px-4">
          {/* Title */}
          <div className="mb-8 text-center">
            <h1 className="mb-3 text-4xl font-black tracking-tight text-text-primary md:text-5xl">
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
              {/* Top panels: video + two complementary charts */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Video player */}
                <div
                  className="self-start overflow-hidden rounded-2xl border"
                  // The letterbox behind the video stays dark in every palette.
                  style={{ backgroundColor: scrim(1), borderColor: CARD_BORDER }}
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

                {/* Charts: A = device orientation, B = raw acceleration. Both are
                    drift-free, so reps show as clear oscillations; integrated
                    position lives in chart B but is hidden by default. */}
                <div className="flex flex-col gap-4">
                  <ChartPanel
                    title={t('chartOrientationTitle')}
                    subtitle={t('chartOrientationSubtitle')}
                    seekHint={t('seekHint')}
                    chartData={chartData}
                    channelKeys={ORIENTATION_CHANNELS}
                    defaultVisible={ORIENTATION_DEFAULT}
                    markers={markers}
                    pendingStartMs={pendingStartMs}
                    videoRef={videoRef}
                  />
                  <ChartPanel
                    title={t('chartAccelerationTitle')}
                    subtitle={t('chartAccelerationSubtitle')}
                    seekHint={t('seekHint')}
                    chartData={chartData}
                    channelKeys={ACCEL_CHANNELS}
                    defaultVisible={ACCEL_DEFAULT}
                    markers={markers}
                    pendingStartMs={pendingStartMs}
                    videoRef={videoRef}
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
                      markState === 'waitingEnd' ? hue('amber', 0.2) : brandBright(0.15),
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
                    backgroundColor: markState === 'waitingEnd' ? brand(0.2) : INPUT_BG,
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
                      backgroundColor: markerCount > 0 ? hue('error', 0.12) : INPUT_BG,
                      border: `1px solid ${markerCount > 0 ? hue('error', 0.4) : INPUT_BORDER}`,
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
                  <span className="text-xs font-bold tracking-wider text-text-primary">
                    {t('markerCount', { count: markerCount })}
                  </span>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={markerCount === 0}
                    className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors"
                    style={{
                      backgroundColor: markerCount > 0 ? brandBright(0.15) : INPUT_BG,
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
                          className="transition-colors hover:bg-ink/[0.02]"
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
                                e.currentTarget.style.borderColor = hue('error', 0.3);
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
