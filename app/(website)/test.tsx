import savitzkyGolay from 'ml-savitzky-golay';
import type { ChangeEvent, DragEvent } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { MultipleLinesChart } from '@/components/charts/MultipleLinesChart';
import { DotPattern } from '@/components/website/WebsiteBackgrounds';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { isProduction } from '@/utils/app';
import { analyzeRecordedReps } from '@/utils/repAnalysis';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Sample {
  timestamp: number;
  accel: Vector3D;
  gyro: Vector3D;
  angle: Vector3D;
}

export interface Analysis {
  repCount: number;
  sampleCount: number;
  durationMs: number;
}

export interface DebugData {
  version: number;
  startedAt: string;
  stoppedAt: string;
  sampleCount: number;
  analysis: Analysis;
  samples: Sample[];
}

type ChartRow = {
  x: number;
  accX: number;
  accY: number;
  accZ: number;
};

type AxisKey = 'accX' | 'accY' | 'accZ';

type LoadedFileState = {
  fileName: string;
  samples: Sample[];
  startedAt?: string;
  stoppedAt?: string;
  analysis: Analysis;
};

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isVector3D(value: unknown): value is Vector3D {
  return (
    value != null &&
    typeof value === 'object' &&
    isNumber((value as Vector3D).x) &&
    isNumber((value as Vector3D).y) &&
    isNumber((value as Vector3D).z)
  );
}

function isSample(value: unknown): value is Sample {
  return (
    value != null &&
    typeof value === 'object' &&
    isNumber((value as Sample).timestamp) &&
    isVector3D((value as Sample).accel) &&
    isVector3D((value as Sample).gyro) &&
    isVector3D((value as Sample).angle)
  );
}

function parseDebugData(raw: unknown): LoadedFileState | null {
  if (Array.isArray(raw)) {
    const samples = raw.filter(isSample);
    return samples.length > 0
      ? { fileName: 'samples.json', samples, analysis: analyzeRecordedReps(samples) }
      : null;
  }

  if (raw == null || typeof raw !== 'object') {
    return null;
  }

  const maybeSamples = Array.isArray((raw as { samples?: unknown }).samples)
    ? (raw as { samples: unknown[] }).samples.filter(isSample)
    : [];

  if (maybeSamples.length === 0) {
    return null;
  }

  return {
    fileName: 'debug_data.json',
    samples: maybeSamples,
    startedAt:
      typeof (raw as DebugData).startedAt === 'string' ? (raw as DebugData).startedAt : undefined,
    stoppedAt:
      typeof (raw as DebugData).stoppedAt === 'string' ? (raw as DebugData).stoppedAt : undefined,
    analysis: analyzeRecordedReps(maybeSamples),
  };
}

function createChartRows(samples: Sample[]): ChartRow[] {
  if (samples.length === 0) {
    return [];
  }

  const startTimestamp = samples[0].timestamp;
  return samples.map((sample) => ({
    x: (sample.timestamp - startTimestamp) / 1000,
    accX: sample.accel.x,
    accY: sample.accel.y,
    accZ: sample.accel.z,
  }));
}

function getExtents(rows: ChartRow[], visibleAxes: AxisKey[]) {
  const values = rows.flatMap((row) => visibleAxes.map((axis) => row[axis]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(0.12, (max - min) * 0.12 || 0.12);
  return {
    min: min - padding,
    max: max + padding,
  };
}

function buildYAxisLabels(min: number, max: number, formatValue: (value: number) => string) {
  const span = max - min || 1;
  return [
    { label: formatValue(max), yDomainValue: max },
    { label: formatValue(min + span * 0.75), yDomainValue: min + span * 0.75 },
    { label: formatValue(min + span * 0.5), yDomainValue: min + span * 0.5 },
    { label: formatValue(min + span * 0.25), yDomainValue: min + span * 0.25 },
    { label: formatValue(min), yDomainValue: min },
  ];
}

const SMOOTHING_PRESETS = [
  { level: 0, label: 'Raw', windowSize: null },
  { level: 1, label: 'Light', windowSize: 5 },
  { level: 2, label: 'Medium', windowSize: 9 },
  { level: 3, label: 'Strong', windowSize: 15 },
  { level: 4, label: 'Very strong', windowSize: 21 },
] as const;

type SmoothingLevel = (typeof SMOOTHING_PRESETS)[number]['level'];

function getSmoothingPreset(level: SmoothingLevel) {
  return SMOOTHING_PRESETS.find((preset) => preset.level === level) ?? SMOOTHING_PRESETS[0];
}

function chooseSavitzkyGolayWindowSize(
  length: number,
  desiredWindowSize: number | null
): number | null {
  if (length < 5 || desiredWindowSize == null) {
    return null;
  }

  const capped = Math.min(desiredWindowSize, length);
  const oddPreferred = capped % 2 === 1 ? capped : capped - 1;
  return Math.max(5, oddPreferred);
}

function smoothSeries(values: number[], desiredWindowSize: number | null): number[] {
  const windowSize = chooseSavitzkyGolayWindowSize(values.length, desiredWindowSize);
  if (windowSize == null) {
    return values;
  }

  return savitzkyGolay(values, 1, {
    windowSize,
    derivative: 0,
    polynomial: 3,
    pad: 'pre',
    padValue: 'replicate',
  });
}

function smoothChartRows(rows: ChartRow[], desiredWindowSize: number | null): ChartRow[] {
  if (rows.length === 0) {
    return [];
  }

  const smoothX = smoothSeries(
    rows.map((row) => row.accX),
    desiredWindowSize
  );
  const smoothY = smoothSeries(
    rows.map((row) => row.accY),
    desiredWindowSize
  );
  const smoothZ = smoothSeries(
    rows.map((row) => row.accZ),
    desiredWindowSize
  );

  return rows.map((row, index) => ({
    x: row.x,
    accX: smoothX[index] ?? row.accX,
    accY: smoothY[index] ?? row.accY,
    accZ: smoothZ[index] ?? row.accZ,
  }));
}

const AXIS_CONFIG: { key: AxisKey; label: string; color: string }[] = [
  { key: 'accX', label: 'AccX', color: '#94a3b8' },
  { key: 'accY', label: 'AccY', color: '#facc15' },
  { key: 'accZ', label: 'AccZ', color: '#f59e0b' },
];

export default function Test() {
  const { formatRoundedDecimal, formatInteger, locale } = useFormatAppNumber();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [smoothingLevel, setSmoothingLevel] = useState<SmoothingLevel>(2);
  const [visibleAxes, setVisibleAxes] = useState<Record<AxisKey, boolean>>({
    accX: true,
    accY: true,
    accZ: true,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileState, setFileState] = useState<LoadedFileState | null>(null);

  const rawRows = useMemo(() => createChartRows(fileState?.samples ?? []), [fileState?.samples]);
  const displayRows = useMemo(() => {
    const preset = getSmoothingPreset(smoothingLevel);
    return preset.windowSize != null ? smoothChartRows(rawRows, preset.windowSize) : rawRows;
  }, [rawRows, smoothingLevel]);
  const activeAxes = useMemo(
    () => AXIS_CONFIG.filter((axis) => visibleAxes[axis.key]).map((axis) => axis.key),
    [visibleAxes]
  );
  const extents = useMemo(
    () => (activeAxes.length > 0 ? getExtents(displayRows, activeAxes) : null),
    [activeAxes, displayRows]
  );
  const yAxisLabels = useMemo(
    () =>
      extents == null
        ? []
        : buildYAxisLabels(extents.min, extents.max, (value) => formatRoundedDecimal(value, 1)),
    [extents, formatRoundedDecimal]
  );
  const lastRow = displayRows[displayRows.length - 1] ?? null;
  const currentPreset = getSmoothingPreset(smoothingLevel);
  const currentSmoothingLabel = currentPreset.label;

  const series = useMemo(
    () =>
      AXIS_CONFIG.filter((axis) => visibleAxes[axis.key]).map((axis) => ({
        key: axis.key,
        label: axis.label,
        color: axis.color,
        value: lastRow ? formatRoundedDecimal(lastRow[axis.key], 2) : undefined,
      })),
    [formatRoundedDecimal, lastRow, visibleAxes]
  );

  const handleParsedFile = useCallback((fileName: string, text: string) => {
    try {
      const parsed = JSON.parse(text) as unknown;
      const debugData = parseDebugData(parsed);

      if (debugData == null) {
        setFileState(null);
        setErrorMessage('That file did not contain a valid `samples` array.');
        return;
      }

      setFileState({
        ...debugData,
        fileName,
      });
      setErrorMessage(null);
    } catch (err) {
      setFileState(null);
      setErrorMessage(err instanceof Error ? err.message : 'Could not parse the JSON file.');
    }
  }, []);

  const handleFile = useCallback(
    (file: File | null) => {
      if (file == null) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        handleParsedFile(file.name, String(reader.result ?? ''));
      };
      reader.onerror = () => {
        setErrorMessage('Unable to read that file.');
      };
      reader.readAsText(file);
    },
    [handleParsedFile]
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      handleFile(event.target.files?.[0] ?? null);
      event.target.value = '';
    },
    [handleFile]
  );

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      handleFile(event.dataTransfer.files?.[0] ?? null);
    },
    [handleFile]
  );

  if (isProduction()) {
    return null;
  }

  const sampleCount = fileState?.samples.length ?? 0;
  const durationSeconds =
    fileState?.samples.length != null && fileState.samples.length > 1
      ? (fileState.samples[fileState.samples.length - 1].timestamp -
          fileState.samples[0].timestamp) /
        1000
      : 0;

  const startedAt = fileState?.startedAt != null ? new Date(fileState.startedAt) : null;
  const stoppedAt = fileState?.stoppedAt != null ? new Date(fileState.stoppedAt) : null;
  const fileLabel = fileState?.fileName ?? 'No file loaded yet';
  const visibleAxisCount = activeAxes.length;

  let chartBody: React.ReactNode;
  if (displayRows.length > 1 && visibleAxisCount > 0 && extents != null) {
    chartBody = (
      <div className="rounded-[1.75rem] border border-white/10 bg-[#050b08] p-3 md:p-4">
        <MultipleLinesChart
          title={undefined}
          subtitle={undefined}
          data={displayRows}
          series={series}
          height={360}
          xDomain={[displayRows[0].x, displayRows[displayRows.length - 1].x]}
          yDomain={[extents.min, extents.max]}
          yAxisLabels={yAxisLabels}
          showGridLines
          gridLineColor="rgba(255,255,255,0.12)"
          lineWidth={3}
          marginTop={0}
          marginBottom={0}
          interactive={false}
          className="w-full"
        />
      </div>
    );
  } else if (displayRows.length > 1) {
    chartBody = (
      <div className="flex min-h-[360px] items-center justify-center rounded-[1.75rem] border border-white/10 bg-[#050b08] px-6 text-center text-sm text-white/45">
        Turn on at least one axis to render the chart.
      </div>
    );
  } else {
    chartBody = (
      <div className="flex min-h-[360px] items-center justify-center rounded-[1.75rem] border border-white/10 bg-[#050b08] px-6 text-center text-sm text-white/45">
        Load a JSON file with at least two samples to render the chart.
      </div>
    );
  }

  return (
    <>
      <main className="relative min-h-screen overflow-hidden bg-[#06110b] px-4 py-8 text-white">
        <DotPattern className="text-emerald-400/10" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.22),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.08),transparent_30%)]" />

        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-6">
          <section className="rounded-[2rem] border border-emerald-500/15 bg-gradient-to-b from-[#0d2418] to-[#08140f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-8">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300/80">
                Debug viewer
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
                Upload a local JSON file and inspect the acceleration chart
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60 md:text-base">
                Drop in a file with a `samples` array from the sensor debug export, and the page
                will render the three acceleration axes as a chart similar to the mobile test
                screen.
              </p>
            </div>

            <div
              className={[
                'group rounded-[1.75rem] border border-dashed p-5 transition-colors md:p-6',
                isDragging ? 'border-emerald-300 bg-emerald-400/10' : 'border-white/10 bg-black/20',
              ].join(' ')}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleInputChange}
              />

              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-white">Load debug JSON</p>
                  <p className="max-w-2xl text-sm leading-6 text-white/55">
                    Click to browse, or drag a local file here. The uploader accepts either the full
                    `DebugData` object or a plain array of samples.
                  </p>
                  <p className="text-xs text-white/45">Locale aware labels: {locale}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setSmoothingLevel((current) => (current === 0 ? 2 : 0))}
                    className={[
                      'inline-flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-bold transition-colors',
                      smoothingLevel > 0
                        ? 'border-emerald-300 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/20'
                        : 'border-white/15 bg-white/5 text-white hover:bg-white/10',
                    ].join(' ')}
                    title="Savitzky-Golay smoothing keeps the shape of peaks better than a simple moving average."
                  >
                    {smoothingLevel > 0 ? 'Show raw data' : 'Smooth peaks'}
                  </button>
                  <button
                    type="button"
                    onClick={openPicker}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-black transition-transform hover:-translate-y-0.5 hover:bg-emerald-300"
                  >
                    Choose JSON file
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Smoothing strength</p>
                    <p className="text-xs text-white/45">
                      {currentSmoothingLabel === 'Raw'
                        ? 'No smoothing applied'
                        : `Savitzky-Golay window: ${getSmoothingPreset(smoothingLevel).windowSize}`}
                    </p>
                  </div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-200/70">
                    {currentSmoothingLabel}
                  </p>
                </div>

                <input
                  type="range"
                  min={0}
                  max={4}
                  step={1}
                  value={smoothingLevel}
                  onChange={(event) =>
                    setSmoothingLevel(Number(event.target.value) as SmoothingLevel)
                  }
                  className="mt-4 w-full accent-emerald-400"
                  aria-label="Smoothing strength"
                />

                <div className="mt-3 grid grid-cols-5 gap-2 text-[11px] uppercase tracking-[0.16em] text-white/35">
                  {SMOOTHING_PRESETS.map((preset) => (
                    <button
                      key={preset.level}
                      type="button"
                      onClick={() => setSmoothingLevel(preset.level)}
                      className={[
                        'rounded-lg px-2 py-2 text-center transition-colors',
                        smoothingLevel === preset.level
                          ? 'bg-emerald-400/15 text-emerald-100'
                          : 'bg-black/20 hover:bg-white/10',
                      ].join(' ')}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">File</p>
                  <p className="mt-2 break-all text-sm font-semibold text-white">{fileLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Samples</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {formatInteger(sampleCount)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Duration</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {formatRoundedDecimal(sampleCount > 1 ? durationSeconds : 0, 1)} s
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Visible axes</p>
                    <p className="text-xs text-white/45">
                      {visibleAxisCount === 0
                        ? 'Turn at least one axis on to render the chart.'
                        : `${visibleAxisCount} axis${visibleAxisCount === 1 ? '' : 'es'} visible`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {AXIS_CONFIG.map((axis) => {
                      const isVisible = visibleAxes[axis.key];
                      return (
                        <button
                          key={axis.key}
                          type="button"
                          onClick={() =>
                            setVisibleAxes((current) => ({
                              ...current,
                              [axis.key]: !current[axis.key],
                            }))
                          }
                          className={[
                            'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
                            isVisible
                              ? 'border-white/15 bg-black/20 text-white'
                              : 'border-white/10 bg-transparent text-white/40 hover:bg-white/5',
                          ].join(' ')}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: axis.color, opacity: isVisible ? 1 : 0.35 }}
                          />
                          {axis.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {errorMessage != null ? (
                <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {errorMessage}
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-500/15 bg-[#07120e]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:p-6">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-black text-white">Raw acceleration</h2>
                <p className="mt-1 text-sm text-white/55">
                  The chart below plots `AccX`, `AccY`, and `AccZ` over the sample timeline.
                  {smoothingLevel > 0 ? ' Savitzky-Golay smoothing is enabled.' : ''}
                </p>
              </div>
              {startedAt != null && stoppedAt != null ? (
                <p className="text-xs text-white/45">
                  {startedAt.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'medium' })} -
                  {stoppedAt.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'medium' })}
                </p>
              ) : null}
            </div>

            {chartBody}

            {fileState?.analysis != null ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Rep count</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {formatInteger(fileState.analysis.repCount)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                    Analysis samples
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {formatInteger(fileState.analysis.sampleCount)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                    Analysis duration
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {formatRoundedDecimal(fileState.analysis.durationMs / 1000, 1)} s
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
}
