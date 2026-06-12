'use client';

import Head from 'expo-router/head';
import { Dumbbell, Info, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SectionBackground } from '@/components/website/WebsiteBackgrounds';
import exercisesData from '@/data/exercisesData.json';
import i18n, { EXERCISES_JSON } from '@/lang/lang';

const BRAND_GREEN = '#22C55E';
const BRAND_GREEN_BRIGHT = '#00FFA3';
const BODY_TEXT = '#D1D5DB';
const BODY_TEXT_SOFT = '#9CA3AF';

function withExpoBaseUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const base = process.env.EXPO_BASE_URL;
  if (base == null || base === '') {
    return path;
  }

  const basePath = String(base).replace(/^\/+|\/+$/g, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized === `/${basePath}` || normalized.startsWith(`/${basePath}/`)) {
    return normalized;
  }

  return `/${basePath}${normalized}`;
}

const EXERCISE_IMAGE = (index: number) => withExpoBaseUrl(`/images/exercises/exercise${index}.png`);

type LocaleExerciseEntry = { exerciseIndex: number; name: string; description: string };

const LOCALE_NAMES: Record<string, Record<number, LocaleExerciseEntry>> = Object.fromEntries(
  Object.entries(EXERCISES_JSON).map(([locale, entries]) => [
    locale,
    Object.fromEntries((entries as LocaleExerciseEntry[]).map((e) => [e.exerciseIndex, e])),
  ])
);

const EN_US_NAMES = LOCALE_NAMES['en-US'] ?? {};

function getLocalizedName(exerciseIndex: number, locale: string, fallback: string): string {
  const map = LOCALE_NAMES[locale] ?? EN_US_NAMES;
  return map?.[exerciseIndex]?.name ?? EN_US_NAMES?.[exerciseIndex]?.name ?? fallback;
}

function getLocalizedDescription(exerciseIndex: number, locale: string): string {
  const map = LOCALE_NAMES[locale] ?? EN_US_NAMES;
  return map?.[exerciseIndex]?.description ?? EN_US_NAMES?.[exerciseIndex]?.description ?? '';
}

const MUSCLE_GROUPS = [
  'chest',
  'back',
  'legs',
  'arms',
  'shoulders',
  'glutes',
  'core',
  'abdomen',
  'full_body',
] as const;

const MECHANIC_TYPES = ['compound', 'isolation', 'cardio', 'plyometric'] as const;

const MUSCLE_GROUP_COLORS: Record<string, { active: string; bg: string; text: string }> = {
  chest: { active: '#F87171', bg: 'rgba(239,68,68,0.14)', text: '#F87171' },
  back: { active: '#C084FC', bg: 'rgba(168,85,247,0.14)', text: '#C084FC' },
  legs: { active: '#4ADE80', bg: 'rgba(34,197,94,0.14)', text: '#4ADE80' },
  arms: { active: '#FB923C', bg: 'rgba(249,115,22,0.14)', text: '#FB923C' },
  shoulders: { active: '#38BDF8', bg: 'rgba(56,189,248,0.14)', text: '#38BDF8' },
  glutes: { active: '#F472B6', bg: 'rgba(236,72,153,0.14)', text: '#F472B6' },
  core: { active: '#FBBF24', bg: 'rgba(245,158,11,0.14)', text: '#FBBF24' },
  abdomen: { active: '#34D399', bg: 'rgba(16,185,129,0.14)', text: '#34D399' },
  full_body: { active: '#00FFA3', bg: 'rgba(0,255,163,0.14)', text: '#00FFA3' },
};

const MECHANIC_COLORS: Record<string, { bg: string; text: string }> = {
  compound: { bg: 'rgba(99,102,241,0.14)', text: '#A5B4FC' },
  isolation: { bg: 'rgba(245,158,11,0.14)', text: '#FCD34D' },
  cardio: { bg: 'rgba(239,68,68,0.14)', text: '#FCA5A5' },
  plyometric: { bg: 'rgba(236,72,153,0.14)', text: '#F9A8D4' },
};

interface Exercise {
  exerciseIndex: number;
  muscleGroup: string;
  equipmentType: string;
  mechanicType: string;
  targetMuscles: string[];
  loadMultiplier: number;
  __exerciseName: string;
}

interface ExerciseCardProps {
  exercise: Exercise;
  localizedName: string;
  muscleGroupLabel: string;
  equipmentLabel: string;
  mechanicLabel: string;
  targetMuscleLabels: string[];
  description: string;
}

function ExerciseCard({
  exercise,
  localizedName,
  muscleGroupLabel,
  equipmentLabel,
  mechanicLabel,
  targetMuscleLabels,
  description,
}: ExerciseCardProps) {
  const [imgError, setImgError] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const muscleColor = MUSCLE_GROUP_COLORS[exercise.muscleGroup] ?? {
    bg: 'rgba(255,255,255,0.08)',
    text: '#D1D5DB',
    active: '#D1D5DB',
  };
  const mechColor = MECHANIC_COLORS[exercise.mechanicType] ?? {
    bg: 'rgba(255,255,255,0.08)',
    text: '#D1D5DB',
  };

  return (
    <div
      className="group flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
      style={{
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Image */}
      <div className="relative overflow-hidden bg-black/25" style={{ aspectRatio: '1/1' }}>
        {!imgError ? (
          <img
            src={EXERCISE_IMAGE(exercise.exerciseIndex)}
            alt={localizedName}
            loading="lazy"
            className="group-hover:scale-105 h-full w-full object-contain p-4 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Dumbbell className="h-10 w-10 opacity-15" color="#9CA3AF" />
          </div>
        )}

        {/* Muscle group badge */}
        <div
          className="absolute left-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{
            backgroundColor: 'rgba(0,0,0,0.70)',
            color: muscleColor.text,
            border: `1px solid ${muscleColor.active}`,
            backdropFilter: 'blur(6px)',
          }}
        >
          {muscleGroupLabel}
        </div>

        {/* Info button */}
        {description ? (
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full transition-opacity hover:opacity-100"
            style={{
              backgroundColor: 'rgba(0,0,0,0.60)',
              border: '1px solid rgba(255,255,255,0.18)',
              backdropFilter: 'blur(6px)',
              opacity: 0.7,
            }}
            aria-label="Exercise info"
          >
            <Info className="h-3.5 w-3.5" color="#D1D5DB" />
          </button>
        ) : null}

        {/* Description overlay */}
        {showInfo && description ? (
          <div
            className="absolute inset-0 z-10 flex flex-col p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
          >
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full transition-opacity hover:opacity-100"
              style={{
                backgroundColor: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.18)',
                opacity: 0.8,
              }}
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" color="#D1D5DB" />
            </button>
            <p className="mt-4 overflow-auto text-xs leading-relaxed" style={{ color: BODY_TEXT }}>
              {description}
            </p>
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-bold leading-snug text-white">{localizedName}</h3>

        {/* Target muscles */}
        <div className="flex flex-wrap gap-1">
          {targetMuscleLabels.slice(0, 3).map((label, i) => (
            <span
              key={i}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: BODY_TEXT_SOFT,
              }}
            >
              {label}
            </span>
          ))}
          {targetMuscleLabels.length > 3 ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: BODY_TEXT_SOFT,
              }}
            >
              +{targetMuscleLabels.length - 3}
            </span>
          ) : null}
        </div>

        {/* Footer: equipment + mechanic */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: '#6B7280',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {equipmentLabel}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: mechColor.bg, color: mechColor.text }}
          >
            {mechanicLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ExercisesPage() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.exercises' });
  const { t: navT } = useTranslation(undefined, { keyPrefix: 'website.navigation' });
  const { t: tEx } = useTranslation();

  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en-us';

  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [mechanic, setMechanic] = useState('');

  const exercises = exercisesData as Exercise[];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return exercises.filter((ex) => {
      const name = getLocalizedName(ex.exerciseIndex, locale, ex.__exerciseName);
      const matchesSearch = !q || name.toLowerCase().includes(q);
      const matchesMuscle = !muscleGroup || ex.muscleGroup === muscleGroup;
      const matchesMechanic = !mechanic || ex.mechanicType === mechanic;
      return matchesSearch && matchesMuscle && matchesMechanic;
    });
  }, [exercises, search, muscleGroup, mechanic, locale]);

  const hasFilters = Boolean(search || muscleGroup || mechanic);

  function clearFilters() {
    setSearch('');
    setMuscleGroup('');
    setMechanic('');
  }

  function getMuscleGroupLabel(mg: string): string {
    return tEx(`exercises.muscleGroups.${mg}`, { defaultValue: mg.replace(/_/g, ' ') });
  }

  function getEquipmentLabel(eq: string): string {
    return tEx(`exercises.equipmentTypes.${eq}`, {
      defaultValue: eq.charAt(0).toUpperCase() + eq.slice(1).replace(/_/g, ' '),
    });
  }

  function getMechanicLabel(m: string): string {
    return tEx(`exercises.mechanicTypes.${m}`, {
      defaultValue: m.charAt(0).toUpperCase() + m.slice(1),
    });
  }

  function getTargetMuscleLabels(muscles: string[]): string[] {
    return muscles.map((m) =>
      tEx(`exercises.muscleGroups.${m}`, { defaultValue: m.replace(/_/g, ' ') })
    );
  }

  const pageStats = [
    { value: `${exercises.length}+`, label: t('stat.exercises') },
    { value: '9', label: t('stat.muscleGroups') },
    { value: '11', label: t('stat.equipment') },
  ];

  return (
    <>
      <Head>
        <title>{`${navT('exercises')} — Musclog`}</title>
      </Head>
      <main>
        {/* Page header */}
        <section className="relative overflow-hidden pb-12 pt-24 md:pb-16 md:pt-32">
          <SectionBackground variant="grid" />
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
            style={{
              background:
                'radial-gradient(circle, rgba(0,255,163,0.10) 0%, rgba(34,197,94,0.07) 36%, rgba(0,0,0,0) 72%)',
            }}
            aria-hidden="true"
          />
          <div className="container relative z-10 mx-auto px-4 text-center">
            <p
              className="mb-3 text-xs font-bold uppercase tracking-[0.32em]"
              style={{ color: BRAND_GREEN_BRIGHT }}
            >
              {t('eyebrow')}
            </p>
            <h1 className="mb-4 text-balance text-4xl font-extrabold text-white md:text-5xl">
              {t('pageTitle')}
            </h1>
            <p className="mx-auto max-w-xl text-balance text-lg" style={{ color: BODY_TEXT }}>
              {t('pageDescription')}
            </p>
            <p
              className="mx-auto mt-3 max-w-lg text-balance text-sm"
              style={{ color: BODY_TEXT_SOFT }}
            >
              {t('customNote')}
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-8">
              {pageStats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl font-extrabold" style={{ color: BRAND_GREEN_BRIGHT }}>
                    {stat.value}
                  </div>
                  <div className="mt-0.5 text-xs font-medium" style={{ color: BODY_TEXT_SOFT }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sticky filter bar */}
        <section
          className="sticky top-16 z-40 border-b backdrop-blur-md"
          style={{
            backgroundColor: 'rgba(4,10,9,0.94)',
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <div className="container mx-auto space-y-3 px-4 py-3">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                color="#6B7280"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-xl py-2.5 pl-9 pr-9 text-sm text-white outline-none transition-all placeholder:text-gray-500"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.10)',
                }}
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  aria-label={t('clearFilters')}
                >
                  <X className="h-3.5 w-3.5" color="#6B7280" />
                </button>
              ) : null}
            </div>

            {/* Filter chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* All */}
              <button
                type="button"
                onClick={() => setMuscleGroup('')}
                className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
                style={
                  !muscleGroup
                    ? { backgroundColor: BRAND_GREEN, color: '#000' }
                    : {
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        color: BODY_TEXT_SOFT,
                        border: '1px solid rgba(255,255,255,0.08)',
                      }
                }
              >
                {t('filterAll')}
              </button>

              {/* Muscle group chips */}
              {MUSCLE_GROUPS.map((mg) => {
                const isActive = muscleGroup === mg;
                const colors = MUSCLE_GROUP_COLORS[mg];
                return (
                  <button
                    key={mg}
                    type="button"
                    onClick={() => setMuscleGroup(isActive ? '' : mg)}
                    className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
                    style={
                      isActive
                        ? {
                            backgroundColor: colors?.active ?? BRAND_GREEN,
                            color: '#000',
                          }
                        : {
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            color: BODY_TEXT_SOFT,
                            border: '1px solid rgba(255,255,255,0.08)',
                          }
                    }
                  >
                    {getMuscleGroupLabel(mg)}
                  </button>
                );
              })}

              <span
                className="h-4 w-px"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
                aria-hidden="true"
              />

              {/* Mechanic chips */}
              {MECHANIC_TYPES.map((m) => {
                const isActive = mechanic === m;
                const colors = MECHANIC_COLORS[m];
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMechanic(isActive ? '' : m)}
                    className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
                    style={
                      isActive
                        ? {
                            backgroundColor: colors?.text ?? BRAND_GREEN,
                            color: '#000',
                          }
                        : {
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            color: BODY_TEXT_SOFT,
                            border: '1px solid rgba(255,255,255,0.08)',
                          }
                    }
                  >
                    {getMechanicLabel(m)}
                  </button>
                );
              })}

              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-1 rounded-full px-3 py-1 text-xs font-semibold transition-all"
                  style={{
                    color: '#F87171',
                    backgroundColor: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.18)',
                  }}
                >
                  {t('clearFilters')}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {/* Exercise grid */}
        <section className="relative overflow-hidden py-10">
          <div className="container relative z-10 mx-auto px-4">
            {/* Result count */}
            <p className="mb-6 text-sm" style={{ color: BODY_TEXT_SOFT }}>
              {t('showing', { count: filtered.length })}
            </p>

            {filtered.length === 0 ? (
              <div className="py-24 text-center">
                <div
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                >
                  <Dumbbell className="h-8 w-8" color="#6B7280" />
                </div>
                <p className="text-lg font-semibold text-white">{t('noResults')}</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
                  style={{ backgroundColor: BRAND_GREEN, color: '#000' }}
                >
                  {t('clearFilters')}
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filtered.map((exercise) => {
                  const ex = exercise as Exercise;
                  return (
                    <ExerciseCard
                      key={ex.exerciseIndex}
                      exercise={ex}
                      localizedName={getLocalizedName(ex.exerciseIndex, locale, ex.__exerciseName)}
                      description={getLocalizedDescription(ex.exerciseIndex, locale)}
                      muscleGroupLabel={getMuscleGroupLabel(ex.muscleGroup)}
                      equipmentLabel={getEquipmentLabel(ex.equipmentType)}
                      mechanicLabel={getMechanicLabel(ex.mechanicType)}
                      targetMuscleLabels={getTargetMuscleLabels(ex.targetMuscles)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
