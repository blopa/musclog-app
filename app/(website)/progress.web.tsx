'use client';

import Head from 'expo-router/head';
import {
  Activity,
  CalendarRange,
  ChevronRight,
  Database,
  Dumbbell,
  LineChart as LineChartIcon,
  LoaderCircle,
  Scale,
  Sparkles,
  Upload,
} from 'lucide-react-native';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FloatingShapes, GridPattern } from '@/components/website/WebsiteBackgrounds';
import {
  CALORIES_FOR_CARBS,
  CALORIES_FOR_FAT,
  CALORIES_FOR_FIBER,
  CALORIES_FOR_PROTEIN,
} from '@/constants/nutrition';
import { database } from '@/database/database-instance';
import { restoreDatabase } from '@/database/importDb';
import type {
  AdherencePoint,
  CorrelationPoint,
  DailyNutrition,
  MoodPoint,
  ProgressData,
  TimeAggregation,
} from '@/database/services/ProgressService';
import { useProgressData } from '@/hooks/useProgressData';
import { useSettings } from '@/hooks/useSettings';
import { formatLocalCalendarMonthDayNumericIntl } from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';

const BRAND_GREEN = '#22C55E';
const BRAND_GREEN_BRIGHT = '#00FFA3';
const CYAN = '#22D3EE';
const INDIGO = '#818CF8';
const ROSE = '#FB7185';
const AMBER = '#F59E0B';
const CARD_BG = 'rgba(255,255,255,0.04)';
const CARD_BORDER = 'rgba(255,255,255,0.10)';
const SOFT_TEXT = '#9CA3AF';
const BODY_TEXT = '#D1D5DB';

type XYPoint = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildLinePath(points: XYPoint[], width: number, height: number, padding = 12) {
  if (points.length === 0) {
    return '';
  }

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  return points
    .map((point, index) => {
      const x = padding + ((point.x - minX) / xRange) * innerWidth;
      const y = height - padding - ((point.y - minY) / yRange) * innerHeight;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function buildAreaPath(points: XYPoint[], width: number, height: number, padding = 12) {
  if (points.length === 0) {
    return '';
  }

  const line = buildLinePath(points, width, height, padding);
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const innerWidth = width - padding * 2;
  const xRange = maxX - minX || 1;
  const firstX = padding + ((points[0].x - minX) / xRange) * innerWidth;
  const lastX = padding + ((points[points.length - 1].x - minX) / xRange) * innerWidth;
  const baseY = height - padding;

  return `${line} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
}

function formatCompactNumber(locale: string, value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits,
  }).format(value);
}

function formatNumber(locale: string, value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
  }).format(value);
}

function formatDateLabel(locale: string, value: number) {
  return formatLocalCalendarMonthDayNumericIntl(value, locale);
}

function getSummaryCounts(data: ProgressData | null) {
  if (!data) {
    return { workouts: 0, weighIns: 0, nutritionDays: 0, moodEntries: 0 };
  }

  return {
    workouts: data.workoutVolumeHistory.length,
    weighIns: data.weightHistory.length,
    nutritionDays: data.nutritionHistory.length,
    moodEntries: data.moodHistory.length,
  };
}

function PresetPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-colors"
      style={{
        backgroundColor: active ? BRAND_GREEN : 'rgba(255,255,255,0.04)',
        borderColor: active ? BRAND_GREEN : 'rgba(255,255,255,0.1)',
        color: active ? '#03130C' : '#E5E7EB',
      }}
    >
      {label}
    </button>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section
      className="rounded-[28px] border p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] md:p-7"
      style={{ background: CARD_BG, borderColor: CARD_BORDER }}
    >
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight text-white md:text-2xl">{title}</h2>
          {subtitle ? (
            <p className="mt-1 max-w-3xl text-sm leading-relaxed" style={{ color: SOFT_TEXT }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-3xl border p-5"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.025) 100%)',
        borderColor: CARD_BORDER,
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          {icon}
        </div>
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: SOFT_TEXT }}
        >
          {label}
        </span>
      </div>
      <div className="text-3xl font-black tracking-tight text-white">{value}</div>
      {hint ? (
        <p className="mt-2 text-sm leading-relaxed" style={{ color: SOFT_TEXT }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function MiniLineChart({
  points,
  color,
  fillColor,
  labels,
  valueSuffix = '',
  locale,
}: {
  points: XYPoint[];
  color: string;
  fillColor: string;
  labels: { title: string; minLabel: string; maxLabel: string };
  valueSuffix?: string;
  locale: string;
}) {
  const width = 520;
  const height = 190;

  if (points.length < 2) {
    return (
      <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <p className="text-sm" style={{ color: SOFT_TEXT }}>
          {labels.title}
        </p>
        <div className="mt-8 text-sm" style={{ color: SOFT_TEXT }}>
          No data
        </div>
      </div>
    );
  }

  const values = points.map((point) => point.y);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{labels.title}</p>
        <p className="text-xs" style={{ color: SOFT_TEXT }}>
          {formatNumber(locale, minValue, 1)}
          {valueSuffix} → {formatNumber(locale, maxValue, 1)}
          {valueSuffix}
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full overflow-visible">
        <defs>
          <linearGradient id={`${labels.title}-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={fillColor} stopOpacity="0.48" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <path d={buildAreaPath(points, width, height)} fill={`url(#${labels.title}-fill)`} />
        <path
          d={buildLinePath(points, width, height)}
          fill="none"
          stroke={color}
          strokeWidth="3.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-3 flex items-center justify-between text-xs" style={{ color: SOFT_TEXT }}>
        <span>{labels.minLabel}</span>
        <span>{labels.maxLabel}</span>
      </div>
    </div>
  );
}

function VerticalBarChart({
  items,
  color,
  locale,
  formatter,
}: {
  items: { label: string; value: number }[];
  color: string;
  locale: string;
  formatter?: (value: number) => string;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const height = clamp((item.value / maxValue) * 100, 8, 100);
        return (
          <div
            key={item.label}
            className="rounded-2xl border p-4"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="text-sm font-semibold text-white">{item.label}</div>
              <div className="text-sm" style={{ color: SOFT_TEXT }}>
                {formatter ? formatter(item.value) : formatCompactNumber(locale, item.value)}
              </div>
            </div>
            <div className="flex h-28 items-end rounded-2xl bg-white/[0.03] px-3 py-2">
              <div
                className="w-full rounded-xl transition-all"
                style={{
                  height: `${height}%`,
                  background: `linear-gradient(180deg, ${color} 0%, ${color}88 100%)`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HorizontalBars({
  items,
  color,
  suffix,
  locale,
}: {
  items: { label: string; value: number }[];
  color: string;
  suffix?: string;
  locale: string;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-white">{item.label}</span>
            <span style={{ color: SOFT_TEXT }}>
              {formatNumber(locale, item.value, 0)}
              {suffix}
            </span>
          </div>
          <div className="h-3 rounded-full bg-white/[0.05]">
            <div
              className="h-3 rounded-full"
              style={{
                width: `${Math.max((item.value / maxValue) * 100, 4)}%`,
                background: `linear-gradient(90deg, ${color} 0%, ${color}aa 100%)`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ScatterCard({
  points,
  xLabel,
  yLabel,
  color,
}: {
  points: { x: number; y: number }[];
  xLabel: string;
  yLabel: string;
  color: string;
}) {
  const width = 500;
  const height = 260;
  const padding = 32;

  if (points.length === 0) {
    return (
      <div className="rounded-2xl border p-5" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <p className="text-sm" style={{ color: SOFT_TEXT }}>
          No data
        </p>
      </div>
    );
  }

  const xMin = Math.min(...points.map((point) => point.x));
  const xMax = Math.max(...points.map((point) => point.x));
  const yMin = Math.min(...points.map((point) => point.y));
  const yMax = Math.max(...points.map((point) => point.y));
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="rgba(255,255,255,0.16)"
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="rgba(255,255,255,0.16)"
        />
        {points.map((point, index) => {
          const cx = padding + ((point.x - xMin) / xRange) * (width - padding * 2);
          const cy = height - padding - ((point.y - yMin) / yRange) * (height - padding * 2);
          return <circle key={index} cx={cx} cy={cy} r="5" fill={color} fillOpacity="0.9" />;
        })}
      </svg>
      <div
        className="mt-4 flex items-center justify-between gap-4 text-xs"
        style={{ color: SOFT_TEXT }}
      >
        <span>{xLabel}</span>
        <span>{yLabel}</span>
      </div>
    </div>
  );
}

function MacroComposition({ items, locale }: { items: DailyNutrition[]; locale: string }) {
  const bars = items.slice(-7);
  const maxTotal = Math.max(...bars.map((item) => item.calories), 1);

  return (
    <div className="space-y-4">
      {bars.map((item) => {
        const protein = item.protein * CALORIES_FOR_PROTEIN;
        const carbs = Math.max(0, item.carbs - item.fiber) * CALORIES_FOR_CARBS;
        const fat = item.fat * CALORIES_FOR_FAT;
        const fiber = item.fiber * CALORIES_FOR_FIBER;
        const total = protein + carbs + fat + fiber || 1;
        return (
          <div key={item.date}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-white">{formatDateLabel(locale, item.date)}</span>
              <span style={{ color: SOFT_TEXT }}>
                {formatCompactNumber(locale, item.calories)} kcal
              </span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                style={{
                  width: `${(protein / total) * 100}%`,
                  backgroundColor: BRAND_GREEN_BRIGHT,
                }}
              />
              <div style={{ width: `${(carbs / total) * 100}%`, backgroundColor: BRAND_GREEN }} />
              <div style={{ width: `${(fat / total) * 100}%`, backgroundColor: CYAN }} />
              <div style={{ width: `${(fiber / total) * 100}%`, backgroundColor: AMBER }} />
            </div>
            <div className="mt-1 h-1 rounded-full bg-white/[0.04]">
              <div
                className="h-1 rounded-full"
                style={{
                  width: `${Math.max((item.calories / maxTotal) * 100, 4)}%`,
                  background:
                    'linear-gradient(90deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.38) 100%)',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({
  t,
  locale,
  onImport,
  onPhraseChange,
  decryptionPhrase,
  isImporting,
  error,
  fileName,
}: {
  t: ReturnType<typeof useTranslation>['t'];
  locale: string;
  onImport: () => void;
  onPhraseChange: (value: string) => void;
  decryptionPhrase: string;
  isImporting: boolean;
  error: string | null;
  fileName: string | null;
}) {
  return (
    <main className="relative overflow-hidden pb-24 pt-24 md:pt-28">
      <GridPattern className="text-primary/35" />
      <FloatingShapes />
      <div
        className="absolute left-1/4 top-36 h-72 w-72 rounded-full blur-[120px]"
        style={{ backgroundColor: 'rgba(0,255,163,0.10)' }}
      />
      <div
        className="absolute bottom-16 right-1/4 h-64 w-64 rounded-full blur-[100px]"
        style={{ backgroundColor: 'rgba(34,211,238,0.08)' }}
      />

      <div className="container relative z-10 mx-auto max-w-6xl px-4">
        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div
              className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.22em]"
              style={{
                borderColor: 'rgba(34,197,94,0.22)',
                color: BRAND_GREEN_BRIGHT,
                backgroundColor: 'rgba(34,197,94,0.10)',
              }}
            >
              <Sparkles className="h-4 w-4" />
              {t('website.progress.hero.eyebrow')}
            </div>

            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white md:text-6xl">
              {t('website.progress.hero.title')}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed" style={{ color: BODY_TEXT }}>
              {t('website.progress.hero.description')}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: <Scale className="h-5 w-5" />,
                  title: t('website.progress.hero.points.weight.title'),
                  description: t('website.progress.hero.points.weight.description'),
                },
                {
                  icon: <LineChartIcon className="h-5 w-5" />,
                  title: t('website.progress.hero.points.nutrition.title'),
                  description: t('website.progress.hero.points.nutrition.description'),
                },
                {
                  icon: <Dumbbell className="h-5 w-5" />,
                  title: t('website.progress.hero.points.training.title'),
                  description: t('website.progress.hero.points.training.description'),
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border p-5"
                  style={{ borderColor: CARD_BORDER, backgroundColor: 'rgba(255,255,255,0.03)' }}
                >
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-[#00FFA3]">
                    {item.icon}
                  </div>
                  <div className="text-base font-bold text-white">{item.title}</div>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: SOFT_TEXT }}>
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-[32px] border p-6 shadow-[0_28px_90px_rgba(0,0,0,0.28)] md:p-8"
            style={{
              borderColor: 'rgba(255,255,255,0.12)',
              background: 'linear-gradient(180deg, rgba(7,17,14,0.92) 0%, rgba(5,11,10,0.92) 100%)',
            }}
          >
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <div
                  className="text-sm font-semibold uppercase tracking-[0.22em]"
                  style={{ color: BRAND_GREEN_BRIGHT }}
                >
                  {t('website.progress.importCard.badge')}
                </div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                  {t('website.progress.importCard.title')}
                </h2>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/[0.05] text-[#00FFA3]">
                <Upload className="h-7 w-7" />
              </div>
            </div>

            <p className="text-sm leading-relaxed" style={{ color: BODY_TEXT }}>
              {t('website.progress.importCard.description')}
            </p>

            <label className="mt-6 block">
              <span
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ color: SOFT_TEXT }}
              >
                {t('website.progress.importCard.passphraseLabel')}
              </span>
              <input
                type="password"
                value={decryptionPhrase}
                onChange={(event) => onPhraseChange(event.target.value)}
                placeholder={t('website.progress.importCard.passphrasePlaceholder')}
                className="w-full rounded-2xl border px-4 py-3 text-sm text-white outline-none transition-colors"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderColor: 'rgba(255,255,255,0.10)',
                }}
              />
            </label>

            <button
              type="button"
              onClick={onImport}
              disabled={isImporting}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-bold transition-transform disabled:cursor-wait disabled:opacity-70"
              style={{ backgroundColor: BRAND_GREEN, color: '#03130C' }}
            >
              {isImporting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {isImporting
                ? t('website.progress.importCard.importing')
                : t('website.progress.importCard.cta')}
            </button>

            <div className="mt-4 text-xs" style={{ color: SOFT_TEXT }}>
              {fileName
                ? t('website.progress.importCard.selectedFile', { fileName })
                : t('website.progress.importCard.hint')}
            </div>

            {error ? (
              <div
                className="mt-4 rounded-2xl border px-4 py-3 text-sm"
                style={{
                  borderColor: 'rgba(251,113,133,0.30)',
                  backgroundColor: 'rgba(251,113,133,0.08)',
                  color: '#FECDD3',
                }}
              >
                {error}
              </div>
            ) : null}

            <div
              className="mt-8 rounded-3xl border p-5"
              style={{
                borderColor: 'rgba(255,255,255,0.08)',
                backgroundColor: 'rgba(255,255,255,0.025)',
              }}
            >
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Database className="h-4 w-4 text-[#00FFA3]" />
                {t('website.progress.importCard.localOnlyTitle')}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: SOFT_TEXT }}>
                {t('website.progress.importCard.localOnlyDescription')}
              </p>
              <div className="mt-4 text-xs" style={{ color: SOFT_TEXT }}>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date())}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function ProgressWebsitePage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { units } = useSettings();
  const [hasImportedData, setHasImportedData] = useState<boolean | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [decryptionPhrase, setDecryptionPhrase] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [advancedAggregation, setAdvancedAggregation] = useState<TimeAggregation>('weekly');

  const {
    data,
    allAggregationData,
    isLoading,
    preset,
    changePreset,
    appliedCustomRange,
    applyCustomRange,
    useWeeklyAverages,
    setUseWeeklyAverages,
    refresh,
  } = useProgressData();

  useEffect(() => {
    let cancelled = false;

    const checkForImportedData = async () => {
      try {
        const [userMetricsCount, nutritionCount, workoutCount] = await Promise.all([
          database.get('user_metrics').query().fetchCount(),
          database.get('nutrition_logs').query().fetchCount(),
          database.get('workout_logs').query().fetchCount(),
        ]);

        if (!cancelled) {
          setHasImportedData(userMetricsCount + nutritionCount + workoutCount > 0);
        }
      } catch (error) {
        handleError(error, 'website.progress.checkForImportedData');
        if (!cancelled) {
          setHasImportedData(false);
        }
      }
    };

    void checkForImportedData();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedFileName(file.name);
    setIsImporting(true);
    setImportError(null);

    try {
      const dump = await file.text();
      await restoreDatabase(dump, decryptionPhrase.trim() || undefined);
      await refresh();
      setHasImportedData(true);
      window.location.reload();
    } catch (error) {
      handleError(error, 'website.progress.import');
      setImportError(
        error instanceof Error ? error.message : t('website.progress.importCard.genericError')
      );
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const aggregationData =
    allAggregationData[advancedAggregation] ?? allAggregationData.daily ?? data;
  const summaryCounts = getSummaryCounts(data);
  const weightLabel = units === 'imperial' ? 'lb' : 'kg';
  const measurementLabel = units === 'imperial' ? 'in' : 'cm';

  const presetItems = [
    { id: '7d', label: '7D' },
    { id: '30d', label: '30D' },
    { id: '90d', label: '90D' },
    { id: '6m', label: '6M' },
    { id: '1y', label: '1Y' },
    { id: 'all', label: 'All' },
  ] as const;

  const weightPoints = useMemo(
    () => (data?.weightHistory ?? []).map((point) => ({ x: point.date, y: point.value })),
    [data?.weightHistory]
  );
  const fatPoints = useMemo(
    () => (data?.fatHistory ?? []).map((point) => ({ x: point.date, y: point.value })),
    [data?.fatHistory]
  );
  const ffmiPoints = useMemo(
    () => (data?.ffmiHistory ?? []).map((point) => ({ x: point.date, y: point.value })),
    [data?.ffmiHistory]
  );
  const moodPoints = useMemo(
    () => (aggregationData?.moodHistory ?? []).map((point) => ({ x: point.date, y: point.mood })),
    [aggregationData?.moodHistory]
  );
  const waterReminderPoints = useMemo(
    () =>
      (aggregationData?.waterIntakeHistory ?? []).map((point: AdherencePoint) => ({
        x: point.date,
        y: point.adherence * 100,
      })),
    [aggregationData?.waterIntakeHistory]
  );
  const supplementReminderSeries = useMemo(
    () =>
      (aggregationData?.supplementIntakeSeries ?? []).map((series) => ({
        supplementId: series.supplementId,
        supplementName: series.supplementName,
        points: series.history.map((point) => ({
          x: point.date,
          y: point.adherence * 100,
        })),
      })),
    [aggregationData?.supplementIntakeSeries]
  );

  const nutritionItems = useMemo(
    () =>
      (data?.nutritionHistory ?? []).slice(-8).map((item) => ({
        label: formatDateLabel(locale, item.date),
        value: item.calories,
      })),
    [data?.nutritionHistory, locale]
  );

  const workoutBars = useMemo(
    () =>
      (data?.workoutVolumeHistory ?? []).slice(-8).map((item) => ({
        label: formatDateLabel(locale, item.date),
        value: item.volume,
      })),
    [data?.workoutVolumeHistory, locale]
  );

  const muscleGroupItems = useMemo(
    () =>
      (data?.muscleGroupSets ?? []).slice(0, 6).map((item) => ({
        label: t(`exercises.muscleGroups.${item.muscleGroup}`, item.muscleGroup),
        value: item.sets,
      })),
    [data?.muscleGroupSets, t]
  );

  const measurementGroups = useMemo(
    () =>
      Object.entries(data?.measurementsHistory ?? {})
        .slice(0, 4)
        .map(([key, history]) => ({
          key,
          title: t(`progress.measurement.${key}`),
          points: history.map((point) => ({ x: point.date, y: point.value })),
        })),
    [data?.measurementsHistory, t]
  );

  const correlationScatter = useMemo(
    () =>
      (aggregationData?.correlationHistory ?? []).map((point: CorrelationPoint) => ({
        x: point.dailyCalories,
        y: point.weeklyVolume,
      })),
    [aggregationData?.correlationHistory]
  );

  const proteinScatter = useMemo(
    () =>
      (aggregationData?.bodyCompProteinHistory ?? []).map((point) => ({
        x: point.protein,
        y: point.weightChange,
      })),
    [aggregationData?.bodyCompProteinHistory]
  );

  const advancedToggle = (
    <div className="flex flex-wrap gap-2">
      {(['daily', 'weekly', 'monthly'] as TimeAggregation[]).map((item) => (
        <PresetPill
          key={item}
          active={advancedAggregation === item}
          label={t(`common.time.${item}`)}
          onClick={() => setAdvancedAggregation(item)}
        />
      ))}
    </div>
  );
  const hasReminderData =
    waterReminderPoints.length > 0 ||
    supplementReminderSeries.some((series) => series.points.length > 0);

  if (hasImportedData === null) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4 pt-24">
        <div
          className="inline-flex items-center gap-3 rounded-full border px-5 py-3 text-sm text-white"
          style={{ borderColor: CARD_BORDER, backgroundColor: 'rgba(255,255,255,0.04)' }}
        >
          <LoaderCircle className="h-4 w-4 animate-spin text-[#00FFA3]" />
          {t('website.progress.loading')}
        </div>
      </main>
    );
  }

  if (!hasImportedData) {
    return (
      <>
        <Head>
          <title>{t('website.progress.metaTitle')}</title>
        </Head>
        <input
          id={fileInputId}
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleFileSelected}
        />
        <EmptyState
          t={t}
          locale={locale}
          onImport={handleImportClick}
          onPhraseChange={setDecryptionPhrase}
          decryptionPhrase={decryptionPhrase}
          isImporting={isImporting}
          error={importError}
          fileName={selectedFileName}
        />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{t('website.progress.metaTitle')}</title>
      </Head>

      <input
        id={fileInputId}
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleFileSelected}
      />

      <main className="relative overflow-hidden pb-24 pt-24 md:pt-28">
        <GridPattern className="text-primary/35" />
        <FloatingShapes />
        <div
          className="absolute left-1/4 top-28 h-72 w-72 rounded-full blur-[120px]"
          style={{ backgroundColor: 'rgba(0,255,163,0.08)' }}
        />
        <div
          className="absolute bottom-24 right-1/4 h-72 w-72 rounded-full blur-[120px]"
          style={{ backgroundColor: 'rgba(34,211,238,0.08)' }}
        />

        <div className="container relative z-10 mx-auto max-w-7xl space-y-8 px-4">
          <section
            className="rounded-[32px] border p-6 md:p-8"
            style={{
              borderColor: CARD_BORDER,
              background: 'linear-gradient(180deg, rgba(8,18,15,0.88) 0%, rgba(5,10,9,0.9) 100%)',
            }}
          >
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
              <div>
                <div
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.22em]"
                  style={{
                    borderColor: 'rgba(34,197,94,0.22)',
                    color: BRAND_GREEN_BRIGHT,
                    backgroundColor: 'rgba(34,197,94,0.10)',
                  }}
                >
                  <Database className="h-4 w-4" />
                  {t('website.progress.dashboard.eyebrow')}
                </div>
                <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-white md:text-6xl">
                  {t('website.progress.dashboard.title')}
                </h1>
                <p className="mt-4 max-w-3xl text-lg leading-relaxed" style={{ color: BODY_TEXT }}>
                  {t('website.progress.dashboard.description')}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleImportClick}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-bold"
                  style={{ backgroundColor: BRAND_GREEN, color: '#03130C' }}
                >
                  {isImporting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {t('website.progress.dashboard.replaceData')}
                </button>
                <div
                  className="rounded-2xl border px-5 py-4 text-sm"
                  style={{ borderColor: 'rgba(255,255,255,0.08)', color: SOFT_TEXT }}
                >
                  {selectedFileName
                    ? t('website.progress.importCard.selectedFile', { fileName: selectedFileName })
                    : t('website.progress.dashboard.localStorageHint')}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                {presetItems.map((item) => (
                  <PresetPill
                    key={item.id}
                    active={preset === item.id}
                    label={item.label}
                    onClick={() => changePreset(item.id)}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label
                  className="flex items-center gap-3 rounded-full border px-4 py-2 text-sm text-white"
                  style={{
                    borderColor: 'rgba(255,255,255,0.08)',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={useWeeklyAverages}
                    onChange={(event) => setUseWeeklyAverages(event.target.checked)}
                    className="h-4 w-4 accent-[#22C55E]"
                  />
                  {t('progress.weeklyAverages')}
                </label>

                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={(appliedCustomRange?.startDate ?? new Date()).toISOString().slice(0, 10)}
                    onChange={(event) => {
                      const nextStart = new Date(event.target.value);
                      const end = appliedCustomRange?.endDate ?? new Date();
                      applyCustomRange(nextStart, end);
                    }}
                    className="rounded-full border px-4 py-2 text-sm text-white outline-none"
                    style={{
                      borderColor: 'rgba(255,255,255,0.08)',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      colorScheme: 'dark',
                    }}
                  />
                  <ChevronRight className="h-4 w-4" color={SOFT_TEXT} />
                  <input
                    type="date"
                    value={(appliedCustomRange?.endDate ?? new Date()).toISOString().slice(0, 10)}
                    onChange={(event) => {
                      const nextEnd = new Date(event.target.value);
                      const start = appliedCustomRange?.startDate ?? nextEnd;
                      applyCustomRange(start, nextEnd);
                    }}
                    className="rounded-full border px-4 py-2 text-sm text-white outline-none"
                    style={{
                      borderColor: 'rgba(255,255,255,0.08)',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      colorScheme: 'dark',
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          {isLoading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div
                className="inline-flex items-center gap-3 rounded-full border px-5 py-3 text-sm text-white"
                style={{ borderColor: CARD_BORDER, backgroundColor: 'rgba(255,255,255,0.04)' }}
              >
                <LoaderCircle className="h-4 w-4 animate-spin text-[#00FFA3]" />
                {t('website.progress.loading')}
              </div>
            </div>
          ) : (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label={t('progress.weight')}
                  value={
                    data?.insights?.avgWeight
                      ? `${formatNumber(locale, data.insights.avgWeight, 1)} ${weightLabel}`
                      : '—'
                  }
                  hint={t('website.progress.stats.weightHint')}
                  accent={BRAND_GREEN}
                  icon={<Scale className="h-5 w-5" />}
                />
                <StatCard
                  label={t('progress.averageIntakeTitle')}
                  value={
                    data?.insights?.averageIntake
                      ? `${formatNumber(locale, data.insights.averageIntake.calories, 0)} kcal`
                      : '—'
                  }
                  hint={t('website.progress.stats.caloriesHint', {
                    count: data?.insights?.averageIntake?.dayCount ?? 0,
                  })}
                  accent={CYAN}
                  icon={<Activity className="h-5 w-5" />}
                />
                <StatCard
                  label={t('progress.workoutVolume')}
                  value={formatNumber(locale, summaryCounts.workouts, 0)}
                  hint={t('website.progress.stats.workoutsHint')}
                  accent={INDIGO}
                  icon={<Dumbbell className="h-5 w-5" />}
                />
                <StatCard
                  label={t('progress.empiricalTdee')}
                  value={
                    data?.insights?.tdee
                      ? `${formatNumber(locale, data.insights.tdee, 0)} kcal`
                      : '—'
                  }
                  hint={t('website.progress.stats.tdeeHint')}
                  accent={ROSE}
                  icon={<CalendarRange className="h-5 w-5" />}
                />
              </section>

              <SectionCard
                title={t('website.progress.sections.bodyComposition.title')}
                subtitle={t('website.progress.sections.bodyComposition.description')}
              >
                <div className="grid gap-4 xl:grid-cols-3">
                  <MiniLineChart
                    points={weightPoints}
                    color={BRAND_GREEN}
                    fillColor={BRAND_GREEN}
                    labels={{
                      title: t('progress.weight'),
                      minLabel: weightPoints[0] ? formatDateLabel(locale, weightPoints[0].x) : '',
                      maxLabel: weightPoints.at(-1)
                        ? formatDateLabel(locale, weightPoints.at(-1)!.x)
                        : '',
                    }}
                    valueSuffix={` ${weightLabel}`}
                    locale={locale}
                  />
                  <MiniLineChart
                    points={fatPoints}
                    color={ROSE}
                    fillColor={ROSE}
                    labels={{
                      title: t('progress.bodyFat'),
                      minLabel: fatPoints[0] ? formatDateLabel(locale, fatPoints[0].x) : '',
                      maxLabel: fatPoints.at(-1)
                        ? formatDateLabel(locale, fatPoints.at(-1)!.x)
                        : '',
                    }}
                    valueSuffix="%"
                    locale={locale}
                  />
                  <MiniLineChart
                    points={ffmiPoints}
                    color={CYAN}
                    fillColor={CYAN}
                    labels={{
                      title: t('progress.ffmi'),
                      minLabel: ffmiPoints[0] ? formatDateLabel(locale, ffmiPoints[0].x) : '',
                      maxLabel: ffmiPoints.at(-1)
                        ? formatDateLabel(locale, ffmiPoints.at(-1)!.x)
                        : '',
                    }}
                    locale={locale}
                  />
                </div>
              </SectionCard>

              <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
                <SectionCard
                  title={t('website.progress.sections.nutrition.title')}
                  subtitle={t('website.progress.sections.nutrition.description')}
                >
                  <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                    <VerticalBarChart
                      items={nutritionItems}
                      color={BRAND_GREEN}
                      locale={locale}
                      formatter={(value) => `${formatCompactNumber(locale, value)} kcal`}
                    />
                    <div
                      className="rounded-2xl border p-5"
                      style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                    >
                      <div className="mb-4 text-sm font-semibold text-white">
                        {t('website.progress.sections.nutrition.macroSplit')}
                      </div>
                      <MacroComposition items={data?.nutritionHistory ?? []} locale={locale} />
                      <div
                        className="mt-5 flex flex-wrap gap-4 text-xs"
                        style={{ color: SOFT_TEXT }}
                      >
                        <span>
                          {t('nutrition.protein')}: {BRAND_GREEN_BRIGHT}
                        </span>
                        <span>
                          {t('nutrition.carbs')}: {BRAND_GREEN}
                        </span>
                        <span>
                          {t('nutrition.fat')}: {CYAN}
                        </span>
                        <span>
                          {t('nutrition.fiber')}: {AMBER}
                        </span>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title={t('website.progress.sections.training.title')}
                  subtitle={t('website.progress.sections.training.description')}
                >
                  <div className="space-y-6">
                    <div
                      className="rounded-2xl border p-5"
                      style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                    >
                      <div className="mb-4 text-sm font-semibold text-white">
                        {t('progress.workoutVolume')}
                      </div>
                      <VerticalBarChart items={workoutBars} color={INDIGO} locale={locale} />
                    </div>
                    {muscleGroupItems.length > 0 ? (
                      <div
                        className="rounded-2xl border p-5"
                        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                      >
                        <div className="mb-4 text-sm font-semibold text-white">
                          {t('progress.setsPerMuscleGroup')}
                        </div>
                        <HorizontalBars
                          items={muscleGroupItems}
                          color={BRAND_GREEN}
                          locale={locale}
                        />
                      </div>
                    ) : null}
                  </div>
                </SectionCard>
              </div>

              <SectionCard
                title={t('website.progress.sections.correlations.title')}
                subtitle={t('website.progress.sections.correlations.description')}
                right={advancedToggle}
              >
                <div className="grid gap-6 xl:grid-cols-2">
                  <div>
                    <div className="mb-3 text-sm font-semibold text-white">
                      {t('progress.correlationView.volumeCalories')}
                    </div>
                    <ScatterCard
                      points={correlationScatter}
                      xLabel={t('progress.dailyCalories')}
                      yLabel={t('progress.weeklyVolume')}
                      color={BRAND_GREEN}
                    />
                  </div>
                  <div>
                    <div className="mb-3 text-sm font-semibold text-white">
                      {t('progress.correlationView.proteinBodyComp')}
                    </div>
                    <ScatterCard
                      points={proteinScatter}
                      xLabel={t('progress.proteinIntake')}
                      yLabel={t('progress.weeklyWeightChange')}
                      color={CYAN}
                    />
                  </div>
                </div>
              </SectionCard>

              <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
                <SectionCard
                  title={t('website.progress.sections.mood.title')}
                  subtitle={t('website.progress.sections.mood.description')}
                  right={advancedToggle}
                >
                  <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <MiniLineChart
                      points={moodPoints}
                      color={INDIGO}
                      fillColor={INDIGO}
                      labels={{
                        title: t('progress.correlationView.moodHistory'),
                        minLabel: moodPoints[0] ? formatDateLabel(locale, moodPoints[0].x) : '',
                        maxLabel: moodPoints.at(-1)
                          ? formatDateLabel(locale, moodPoints.at(-1)!.x)
                          : '',
                      }}
                      locale={locale}
                    />
                    <div
                      className="rounded-2xl border p-5"
                      style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                    >
                      <div className="mb-4 text-sm font-semibold text-white">
                        {t('website.progress.sections.mood.summaryTitle')}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white/[0.03] p-4">
                          <div
                            className="text-xs uppercase tracking-[0.18em]"
                            style={{ color: SOFT_TEXT }}
                          >
                            {t('website.progress.sections.mood.totalEntries')}
                          </div>
                          <div className="mt-2 text-2xl font-black text-white">
                            {formatNumber(locale, summaryCounts.moodEntries, 0)}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white/[0.03] p-4">
                          <div
                            className="text-xs uppercase tracking-[0.18em]"
                            style={{ color: SOFT_TEXT }}
                          >
                            {t('website.progress.sections.mood.averageScore')}
                          </div>
                          <div className="mt-2 text-2xl font-black text-white">
                            {aggregationData?.moodHistory?.length
                              ? formatNumber(
                                  locale,
                                  aggregationData.moodHistory.reduce(
                                    (sum: number, point: MoodPoint) => sum + point.mood,
                                    0
                                  ) / aggregationData.moodHistory.length,
                                  1
                                )
                              : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title={t('website.progress.sections.measurements.title')}
                  subtitle={t('website.progress.sections.measurements.description')}
                >
                  {measurementGroups.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {measurementGroups.map((group) => (
                        <MiniLineChart
                          key={group.key}
                          points={group.points}
                          color={BRAND_GREEN}
                          fillColor={BRAND_GREEN}
                          labels={{
                            title: group.title,
                            minLabel: group.points[0]
                              ? formatDateLabel(locale, group.points[0].x)
                              : '',
                            maxLabel: group.points.at(-1)
                              ? formatDateLabel(locale, group.points.at(-1)!.x)
                              : '',
                          }}
                          valueSuffix={` ${measurementLabel}`}
                          locale={locale}
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      className="rounded-2xl border p-5 text-sm"
                      style={{ borderColor: 'rgba(255,255,255,0.08)', color: SOFT_TEXT }}
                    >
                      {t('website.progress.sections.measurements.empty')}
                    </div>
                  )}
                </SectionCard>
              </div>

              {hasReminderData ? (
                <SectionCard
                  title={t('website.progress.sections.reminders.title')}
                  subtitle={t('website.progress.sections.reminders.description')}
                  right={advancedToggle}
                >
                  <div className="space-y-6">
                    {waterReminderPoints.length > 0 ? (
                      <MiniLineChart
                        points={waterReminderPoints}
                        color={CYAN}
                        fillColor={CYAN}
                        labels={{
                          title: t('progress.correlationView.waterIntake'),
                          minLabel: waterReminderPoints[0]
                            ? formatDateLabel(locale, waterReminderPoints[0].x)
                            : '',
                          maxLabel: waterReminderPoints.at(-1)
                            ? formatDateLabel(locale, waterReminderPoints.at(-1)!.x)
                            : '',
                        }}
                        valueSuffix="%"
                        locale={locale}
                      />
                    ) : null}

                    {supplementReminderSeries.length > 0 ? (
                      <div>
                        <div className="mb-3 text-sm font-semibold text-white">
                          {t('website.progress.sections.reminders.supplementsTitle')}
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          {supplementReminderSeries.map((series) => (
                            <MiniLineChart
                              key={series.supplementId}
                              points={series.points}
                              color={BRAND_GREEN}
                              fillColor={BRAND_GREEN}
                              labels={{
                                title: series.supplementName,
                                minLabel: series.points[0]
                                  ? formatDateLabel(locale, series.points[0].x)
                                  : '',
                                maxLabel: series.points.at(-1)
                                  ? formatDateLabel(locale, series.points.at(-1)!.x)
                                  : '',
                              }}
                              valueSuffix="%"
                              locale={locale}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </SectionCard>
              ) : null}
            </>
          )}
        </div>
      </main>
    </>
  );
}
