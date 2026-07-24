'use client';

import {
  Activity,
  Award,
  Check,
  Contrast,
  Download,
  HeartPulse,
  Minus,
  Salad,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { DotPattern } from '@/components/website/WebsiteBackgrounds';
import {
  BODY_TEXT_SOFT,
  BRAND_GREEN,
  BRAND_GREEN_BRIGHT,
  MUTED,
} from '@/components/website/websiteColors';
import { DownloadModal } from '@/components/website/WebsiteWrapper';

// ---------------------------------------------------------------------------
// Language-independent comparison data.
//
// App display names are proper nouns and are intentionally NOT translated.
// Feature-row labels and cell notes are translation KEYS resolved at render
// time from `website.alternatives.*` (see lang/locales/*/website.json).
// ---------------------------------------------------------------------------

const AMBER = '#F59E0B';

// Column order — shared by every table. `musclog` is always first and highlighted.
interface App {
  id: string;
  name: string;
  highlight?: boolean;
}

const APPS: App[] = [
  { id: 'musclog', name: 'Musclog', highlight: true },
  { id: 'myFitnessPal', name: 'MyFitnessPal' },
  { id: 'macroFactor', name: 'MacroFactor' },
  { id: 'mfWorkouts', name: 'MF Workouts' },
  { id: 'bevel', name: 'Bevel' },
  { id: 'cronometer', name: 'Cronometer' },
  { id: 'lifesum', name: 'Lifesum' },
  { id: 'hevy', name: 'Hevy' },
];

type Status = 'full' | 'partial' | 'none';

// A cell is either a bare status or `[status, noteKey]`. The note key resolves
// against `website.alternatives.notes.<key>`.
type Cell = Status | [Status, string];

interface Row {
  id: string; // resolves against the section's `rows.<id>` label
  cells: Cell[]; // aligned to APPS order (length 8)
  // `inverse` rows (e.g. "Ads in free version") flip polarity: a filled status
  // is a downside, so they render as Yes/Some/No text pills instead of icons.
  inverse?: boolean;
  emoji?: string; // decorative suffix on Musclog's cell (Game Boy row)
}

interface Section {
  id: string; // resolves against `sections.<id>`
  icon: typeof ShieldCheck;
  accent: string;
  rows: Row[];
}

const F: Status = 'full';
const P: Status = 'partial';
const N: Status = 'none';

const SECTIONS: Section[] = [
  {
    id: 'privacy',
    icon: ShieldCheck,
    accent: BRAND_GREEN_BRIGHT,
    rows: [
      {
        id: 'freeVersion',
        cells: [
          [F, 'fullApp'],
          [P, 'basic'],
          [N, 'trialOnly'],
          [N, 'trialOnly'],
          [F, 'trackingFree'],
          [F, 'strongBasic'],
          [P, 'limited'],
          [F, 'strongCore'],
        ],
      },
      { id: 'openSource', cells: [[F, 'gpl3'], N, N, N, N, N, N, N] },
      { id: 'noProprietaryAccount', cells: [F, N, N, N, [P, 'appleEcosystem'], N, N, N] },
      { id: 'localFirst', cells: [F, N, N, N, [P, 'appleHealthCentric'], N, N, N] },
      {
        id: 'fullyOffline',
        cells: [
          F,
          [P, 'offlineDiarySync'],
          [P, 'notLocalFirst'],
          [P, 'notLocalFirst'],
          [P, 'trackingDependent'],
          [P, 'cloudAccount'],
          [N, 'internetRequired'],
          [P, 'workoutCaching'],
        ],
      },
      {
        id: 'localEncryption',
        cells: [F, N, N, N, [P, 'applePlatform'], [P, 'serverEncryption'], N, N],
      },
      { id: 'rawDbAccess', cells: [F, N, N, N, N, N, N, N] },
      { id: 'migrationBackups', cells: [F, N, N, N, N, N, N, N] },
      {
        id: 'completeBackup',
        cells: [
          [F, 'jsonDbExcel'],
          [P, 'premiumExport'],
          [P, 'exportGeneric'],
          [P, 'exportGeneric'],
          [P, 'healthExport'],
          [P, 'exportReports'],
          [P, 'fullExportViaSupport'],
          [P, 'workoutsMeasurements'],
        ],
      },
      {
        id: 'platforms',
        cells: [
          F,
          F,
          [P, 'mobile'],
          [P, 'mobile'],
          [P, 'appleOnly'],
          F,
          [P, 'fullAppMobileOnly'],
          F,
        ],
      },
      { id: 'adsInFree', inverse: true, cells: [N, F, N, N, N, F, P, N] },
    ],
  },
  {
    id: 'nutrition',
    icon: Salad,
    accent: '#38BDF8',
    rows: [
      { id: 'caloriesMacros', cells: [F, F, F, N, F, F, F, N] },
      {
        id: 'micronutrients',
        cells: [[F, 'micros40'], P, F, N, P, [F, 'upTo84'], P, N],
      },
      { id: 'barcode', cells: [F, [P, 'paid'], F, N, F, F, F, N] },
      { id: 'customFoods', cells: [F, F, F, N, F, F, F, N] },
      { id: 'savedMeals', cells: [F, F, F, N, F, F, F, N] },
      { id: 'aiPhoto', cells: [F, [P, 'paid'], F, N, F, [P, 'gold'], [P, 'premium'], N] },
      {
        id: 'naturalLanguage',
        cells: [F, [P, 'paidVoice'], F, N, F, [P, 'goldVoice'], [P, 'premium'], N],
      },
      { id: 'labelOcr', cells: [F, P, F, N, P, P, P, N] },
      {
        id: 'foodDbSelection',
        cells: [F, N, [P, 'curatedSources'], N, N, [P, 'verifiedDatabases'], N, N],
      },
      { id: 'netCarbs', cells: [F, [P, 'paid'], F, N, P, F, P, N] },
      { id: 'empiricalTdee', cells: [F, N, F, N, N, N, N, N] },
      { id: 'autoTarget', cells: [F, P, F, N, [P, 'aiGuidance'], P, P, N] },
      {
        id: 'weeklyCheckins',
        cells: [F, P, F, N, [F, 'ai'], P, [F, 'nutritionAdvice'], N],
      },
      { id: 'intuitiveEating', cells: [F, N, N, N, N, N, N, N] },
      {
        id: 'fastedDays',
        cells: [F, [P, 'fastingFeature'], P, N, P, [P, 'timer'], [P, 'plansTimer'], N],
      },
      {
        id: 'supplements',
        cells: [F, P, [P, 'logging'], N, [P, 'journal'], [F, 'logging'], P, N],
      },
      { id: 'qualityInsights', cells: [F, P, F, N, F, F, F, N] },
    ],
  },
  {
    id: 'workouts',
    icon: Activity,
    accent: '#A78BFA',
    rows: [
      {
        id: 'strengthLogging',
        cells: [F, [P, 'basicExercise'], N, F, F, [P, 'exerciseEntries'], [P, 'exerciseHabits'], F],
      },
      { id: 'setsRepsWeights', cells: [F, P, N, F, F, N, N, F] },
      { id: 'rpeRir', cells: [F, N, N, F, P, N, N, F] },
      { id: 'supersets', cells: [F, N, N, F, P, N, N, F] },
      { id: 'prDetection', cells: [F, N, N, F, P, N, N, F] },
      { id: 'restTimers', cells: [F, N, N, F, F, N, N, F] },
      { id: 'customExercises', cells: [F, N, N, F, F, N, N, F] },
      { id: 'templates', cells: [F, P, N, F, F, N, N, F] },
      { id: 'aiPlans', cells: [F, N, N, F, F, N, N, N] },
      { id: 'pasteParse', cells: [F, N, N, N, [P, 'aiCoach'], N, N, N] },
      { id: 'editHistorical', cells: [F, P, N, F, P, P, P, F] },
      { id: 'exerciseGoals', cells: [F, N, N, F, P, N, N, P] },
      { id: 'sharing', cells: [F, P, N, P, P, N, N, F] },
      {
        id: 'nutritionAndLifting',
        cells: [
          F,
          [P, 'basicExercise'],
          N,
          [N, 'separateApp'],
          F,
          [P, 'basicExercise'],
          [P, 'basicExercise'],
          N,
        ],
      },
      { id: 'offlineRecovery', cells: [F, P, N, P, P, N, N, P] },
    ],
  },
  {
    id: 'wholeHealth',
    icon: HeartPulse,
    accent: '#F472B6',
    rows: [
      { id: 'bodyMeasurements', cells: [F, F, F, F, F, F, F, F] },
      { id: 'bodyFatBmiFfmi', cells: [F, P, P, P, F, P, P, N] },
      { id: 'correlationCharts', cells: [F, N, P, P, F, [F, 'gold'], P, P] },
      { id: 'menstrualCycle', cells: [F, N, [P, 'periodLogging'], N, F, N, N, N] },
      { id: 'phaseAware', cells: [F, N, N, N, F, N, N, N] },
      { id: 'moodRecovery', cells: [F, N, N, N, F, [P, 'biometrics'], P, N] },
      { id: 'sleepReadiness', cells: [P, N, N, N, [F, 'bestHere'], N, N, N] },
      { id: 'healthConnect', cells: [F, F, F, P, N, F, F, F] },
      { id: 'healthKit', cells: [F, F, F, P, F, F, F, F] },
      { id: 'historicalImport', cells: [F, P, F, P, F, F, P, P] },
      {
        id: 'bleManagement',
        cells: [
          F,
          N,
          N,
          N,
          [P, 'wearables'],
          [P, 'integrations'],
          [P, 'wearables'],
          [P, 'watches'],
        ],
      },
      { id: 'imuRepCounting', cells: [F, N, N, N, N, N, N, N] },
      {
        id: 'aiCoachConfig',
        cells: [
          F,
          P,
          [P, 'algorithmic'],
          [P, 'workoutCoach'],
          [F, 'pro'],
          [P, 'gold'],
          [P, 'nutrition'],
          N,
        ],
      },
      { id: 'aiContext', cells: [F, P, N, N, F, P, P, N] },
      { id: 'customPrompts', cells: [F, N, N, N, [P, 'personalitiesFiles'], N, N, N] },
      { id: 'byoApiKey', cells: [F, N, N, N, N, N, N, N] },
      { id: 'localModels', cells: [F, N, N, N, N, N, N, N] },
      { id: 'gameboy', emoji: '😎', cells: [F, N, N, N, N, N, N, N] },
    ],
  },
];

// Category-winner table: label key -> winning app name (proper noun) + accent.
const WINNERS: { id: string; app: string; musclog?: boolean; emoji?: string }[] = [
  { id: 'overallCoverage', app: 'Musclog', musclog: true },
  { id: 'privacyOwnership', app: 'Musclog', musclog: true },
  { id: 'freeOpenSource', app: 'Musclog', musclog: true },
  { id: 'nutritionLifting', app: 'Musclog', musclog: true },
  { id: 'configurableAi', app: 'Musclog', musclog: true },
  { id: 'foodEcosystem', app: 'MyFitnessPal' },
  { id: 'dietCoaching', app: 'MacroFactor' },
  { id: 'micronutrient', app: 'Cronometer' },
  { id: 'wearableRecovery', app: 'Bevel' },
  { id: 'socialLifting', app: 'Hevy' },
  { id: 'mealPlan', app: 'Lifesum' },
  { id: 'liftingProgramme', app: 'MacroFactor Workouts' },
  { id: 'gameboy', app: 'Musclog', musclog: true, emoji: '😎' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusOf(cell: Cell): Status {
  return Array.isArray(cell) ? cell[0] : cell;
}

function noteOf(cell: Cell): string | undefined {
  return Array.isArray(cell) ? cell[1] : undefined;
}

function StatusIcon({ status }: { status: Status }) {
  if (status === 'full') {
    return <Check size={16} color={BRAND_GREEN_BRIGHT} strokeWidth={2.5} />;
  }
  if (status === 'partial') {
    return <Contrast size={15} color={AMBER} />;
  }
  return <Minus size={15} color={MUTED} />;
}

// ---------------------------------------------------------------------------
// Comparison table
// ---------------------------------------------------------------------------

const FEATURE_COL_WIDTH = 220;
const APP_COL_WIDTH = 104;

function InverseCell({ status, t }: { status: Status; t: (k: string) => string }) {
  // Reversed polarity: "full" = has ads (bad), "none" = no ads (good).
  const map = {
    full: { key: 'notes.yes', color: AMBER, bg: 'rgba(245,158,11,0.12)' },
    partial: { key: 'notes.some', color: AMBER, bg: 'rgba(245,158,11,0.10)' },
    none: { key: 'notes.no', color: BRAND_GREEN_BRIGHT, bg: 'rgba(0,255,163,0.10)' },
  }[status];

  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ color: map.color, backgroundColor: map.bg }}
    >
      {t(map.key)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Alternatives() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.alternatives' });

  return (
    <main className="relative overflow-hidden pb-24 pt-24">
      <DotPattern className="text-primary/20" />
      <div className="from-background/60 to-background/60 absolute inset-0 bg-gradient-to-b via-transparent" />

      {/* Ambient glows */}
      <div
        className="absolute left-1/4 top-32 h-96 w-96 rounded-full blur-[120px]"
        style={{ backgroundColor: 'rgba(0,255,163,0.06)' }}
        aria-hidden="true"
      />
      <div
        className="absolute bottom-32 right-1/4 h-80 w-80 rounded-full blur-[100px]"
        style={{ backgroundColor: 'rgba(56,189,248,0.06)' }}
        aria-hidden="true"
      />

      <div className="container relative z-10 mx-auto max-w-5xl px-4">
        {/* Hero */}
        <div className="mb-10 text-center">
          <div
            className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
            style={{
              backgroundColor: 'rgba(0,255,163,0.06)',
              borderColor: 'rgba(0,255,163,0.25)',
              color: BRAND_GREEN_BRIGHT,
            }}
          >
            <Sparkles size={12} color={BRAND_GREEN_BRIGHT} />
            {t('badge')}
          </div>
          <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">
            {t('titlePrefix')}{' '}
            <span style={{ color: BRAND_GREEN_BRIGHT }}>{t('titleHighlight')}</span>
          </h1>
          <p
            className="mx-auto max-w-2xl text-sm leading-relaxed md:text-base"
            style={{ color: BODY_TEXT_SOFT }}
          >
            {t('description')}
          </p>
        </div>

        {/* Legend */}
        <div
          className="mx-auto mb-4 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-2xl border px-5 py-3"
          style={{
            backgroundColor: 'rgba(255,255,255,0.02)',
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            {t('legend.title')}
          </span>
          <span
            className="inline-flex items-center gap-1.5 text-xs"
            style={{ color: BODY_TEXT_SOFT }}
          >
            <Check size={14} color={BRAND_GREEN_BRIGHT} strokeWidth={2.5} />
            {t('legend.full')}
          </span>
          <span
            className="inline-flex items-center gap-1.5 text-xs"
            style={{ color: BODY_TEXT_SOFT }}
          >
            <Contrast size={13} color={AMBER} />
            {t('legend.partial')}
          </span>
          <span
            className="inline-flex items-center gap-1.5 text-xs"
            style={{ color: BODY_TEXT_SOFT }}
          >
            <Minus size={13} color={MUTED} />
            {t('legend.none')}
          </span>
        </div>

        <p
          className="mx-auto mb-12 max-w-2xl text-center text-xs leading-relaxed"
          style={{ color: MUTED }}
        >
          {t('asOf')}
        </p>

        {/* Sections */}
        <div className="space-y-16">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const rows = section.rows.map((row) => ({
              ...row,
              label: t(`sections.${section.id}.rows.${row.id}`),
            }));
            return (
              <section key={section.id}>
                <div className="mb-5 flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                    style={{
                      backgroundColor: `${section.accent}14`,
                      borderColor: `${section.accent}40`,
                    }}
                  >
                    <Icon size={20} color={section.accent} />
                  </div>
                  <h2 className="text-xl font-bold text-white md:text-2xl">
                    {t(`sections.${section.id}.title`)}
                  </h2>
                </div>

                <SectionTable rows={rows} t={t} />

                <p className="mt-4 text-xs leading-relaxed" style={{ color: MUTED }}>
                  {t(`sections.${section.id}.footnote`)}
                </p>
              </section>
            );
          })}
        </div>

        {/* Category winners */}
        <section className="mt-20">
          <div className="mb-5 flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
              style={{
                backgroundColor: 'rgba(245,158,11,0.10)',
                borderColor: 'rgba(245,158,11,0.35)',
              }}
            >
              <Trophy size={20} color={AMBER} />
            </div>
            <h2 className="text-xl font-bold text-white md:text-2xl">{t('winners.title')}</h2>
          </div>

          <div
            className="overflow-hidden rounded-2xl border"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                  <th
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: MUTED }}
                  >
                    {t('winners.categoryHeader')}
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: MUTED }}
                  >
                    {t('winners.winnerHeader')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {WINNERS.map((w) => (
                  <tr
                    key={w.id}
                    className="border-t"
                    style={{
                      borderColor: 'rgba(255,255,255,0.05)',
                      backgroundColor: w.musclog ? 'rgba(0,255,163,0.04)' : 'transparent',
                    }}
                  >
                    <td className="px-5 py-3" style={{ color: '#E5E7EB' }}>
                      {t(`winners.rows.${w.id}`)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 font-semibold"
                        style={{ color: w.musclog ? BRAND_GREEN_BRIGHT : '#E5E7EB' }}
                      >
                        {w.musclog ? <Award size={14} color={BRAND_GREEN_BRIGHT} /> : null}
                        {w.app}
                        {w.emoji ? <span>{w.emoji}</span> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Conclusion */}
        <section className="mt-16">
          <div
            className="rounded-2xl border p-6 md:p-8"
            style={{ backgroundColor: 'rgba(0,255,163,0.04)', borderColor: 'rgba(0,255,163,0.2)' }}
          >
            <h2 className="mb-4 text-lg font-bold text-white md:text-xl">
              {t('conclusion.title')}
            </h2>
            <blockquote
              className="mb-5 border-l-2 pl-4 text-base font-medium italic leading-relaxed md:text-lg"
              style={{ borderColor: BRAND_GREEN_BRIGHT, color: '#F3F4F6' }}
            >
              {t('conclusion.quote')}
            </blockquote>
            <p className="mb-4 text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
              {t('conclusion.body')}
            </p>
            <div
              className="mb-4 rounded-xl border px-4 py-3 text-center text-sm font-semibold"
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderColor: 'rgba(255,255,255,0.1)',
                color: BODY_TEXT_SOFT,
              }}
            >
              {t('conclusion.stack')}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
              {t('conclusion.bodyAfter')}
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 text-center">
          <h2 className="mb-3 text-2xl font-bold text-white md:text-3xl">{t('cta.title')}</h2>
          <p className="mx-auto mb-6 max-w-md text-sm" style={{ color: BODY_TEXT_SOFT }}>
            {t('cta.description')}
          </p>
          <DownloadModal
            variant="default"
            className="mx-auto text-base font-bold transition-transform hover:scale-[1.01]"
            style={{ backgroundColor: BRAND_GREEN, color: '#000000' }}
          >
            <Download className="h-5 w-5" />
            {t('cta.button')}
          </DownloadModal>
        </section>

        {/* Disclaimer */}
        <p
          className="mx-auto mt-14 max-w-2xl text-center text-xs leading-relaxed"
          style={{ color: MUTED }}
        >
          {t('disclaimer')}
        </p>
      </div>
    </main>
  );
}

function SectionTable({
  rows,
  t,
}: {
  rows: (Row & { label: string })[];
  t: (k: string) => string;
}) {
  const musclogTint = 'rgba(0,255,163,0.05)';

  return (
    <div
      className="overflow-x-auto rounded-2xl border"
      style={{ borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <table
        className="w-full border-collapse text-left"
        style={{ minWidth: FEATURE_COL_WIDTH + APPS.length * APP_COL_WIDTH }}
      >
        <thead>
          <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
            <th
              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
              style={{ width: FEATURE_COL_WIDTH, minWidth: FEATURE_COL_WIDTH, color: MUTED }}
            >
              {t('featureColumn')}
            </th>
            {APPS.map((app) => (
              <th
                key={app.id}
                className="px-2 py-3 text-center text-xs font-bold"
                style={{
                  width: APP_COL_WIDTH,
                  minWidth: APP_COL_WIDTH,
                  color: app.highlight ? BRAND_GREEN_BRIGHT : '#E5E7EB',
                  backgroundColor: app.highlight ? musclogTint : 'transparent',
                }}
              >
                {app.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <th
                scope="row"
                className="px-4 py-3 text-left text-sm font-medium"
                style={{ width: FEATURE_COL_WIDTH, minWidth: FEATURE_COL_WIDTH, color: '#E5E7EB' }}
              >
                {row.label}
              </th>
              {row.cells.map((cell, i) => {
                const app = APPS[i];
                const status = statusOf(cell);
                const noteKey = noteOf(cell);
                return (
                  <td
                    key={app.id}
                    className="px-2 py-3 text-center align-middle"
                    style={{
                      width: APP_COL_WIDTH,
                      minWidth: APP_COL_WIDTH,
                      backgroundColor: app.highlight ? musclogTint : 'transparent',
                    }}
                  >
                    <div className="flex flex-col items-center justify-center gap-1">
                      {row.inverse ? (
                        <InverseCell status={status} t={t} />
                      ) : (
                        <StatusIcon status={status} />
                      )}
                      {noteKey ? (
                        <span
                          className="text-[10px] leading-tight"
                          style={{ color: status === 'none' ? MUTED : BODY_TEXT_SOFT }}
                        >
                          {t(`notes.${noteKey}`)}
                        </span>
                      ) : null}
                      {row.emoji && app.highlight ? (
                        <span className="text-sm leading-none">{row.emoji}</span>
                      ) : null}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
