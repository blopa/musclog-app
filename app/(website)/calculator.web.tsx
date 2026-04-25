'use client';

import Head from 'expo-router/head';
import { BarChart3, ChevronDown, Zap } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FloatingShapes, GridPattern } from '@/components/website/WebsiteBackgrounds';
import { CALORIES_FOR_CARBS, CALORIES_FOR_FAT, CALORIES_FOR_PROTEIN } from '@/constants/nutrition';
import type { FitnessGoal, Gender, LiftingExperience, WeightGoal } from '@/database/models';
import {
  bmiFromWeightAndHeightM,
  calculateNutritionPlan,
  ffmiFromWeightHeightAndBodyFat,
  isValidBodyFat,
} from '@/utils/nutritionCalculator';

const BRAND_GREEN = '#22C55E';
const BRAND_GREEN_BRIGHT = '#00FFA3';
const BODY_TEXT_SOFT = '#9CA3AF';
const MUTED = '#6B7280';
const CARD_BG = 'rgba(255,255,255,0.03)';
const CARD_BORDER = 'rgba(255,255,255,0.10)';
const INPUT_BG = 'rgba(255,255,255,0.06)';
const INPUT_BORDER = 'rgba(255,255,255,0.12)';

interface WebSelectOption<T extends string | number> {
  label: string;
  value: T;
}

interface FormState {
  age: number;
  gender: Gender;
  weightKg: number;
  heightCm: number;
  bodyFatPercent: number | undefined;
  liftingExperience: LiftingExperience;
  activityLevel: 1 | 2 | 3 | 4 | 5;
  weightGoal: WeightGoal;
  fitnessGoal: FitnessGoal;
}

const DEFAULT_FORM: FormState = {
  age: 24,
  gender: 'male',
  weightKg: 85,
  heightCm: 188,
  bodyFatPercent: 12,
  liftingExperience: 'intermediate',
  activityLevel: 3,
  weightGoal: 'maintain',
  fitnessGoal: 'general',
};

const GOAL_LABEL_KEYS: Record<FitnessGoal, string> = {
  endurance: 'form.endurance',
  general: 'form.general',
  hypertrophy: 'form.hypertrophy',
  strength: 'form.strength',
  weight_loss: 'form.weightLoss',
};

const MACRO_COLORS = {
  carbs: BRAND_GREEN,
  fats: '#22D3EE',
  protein: BRAND_GREEN_BRIGHT,
};

function WebSelect<T extends string | number>({
  value,
  options,
  onChange,
  buttonClassName,
  buttonStyle,
}: {
  value: T;
  options: WebSelectOption<T>[];
  onChange: (value: T) => void;
  buttonClassName: string;
  buttonStyle: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`${buttonClassName} flex items-center justify-between gap-3 text-left`}
        style={buttonStyle}
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          color="#D1D5DB"
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-xl border p-1 shadow-2xl backdrop-blur-xl"
          style={{
            backgroundColor: 'rgba(8,18,14,0.96)',
            borderColor: 'rgba(0,255,163,0.22)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          }}
        >
          <div role="listbox" aria-activedescendant={String(value)} className="space-y-1">
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  id={String(option.value)}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="flex w-full items-center rounded-lg px-3 py-2.5 text-sm transition-colors"
                  style={{
                    backgroundColor: active ? 'rgba(34,197,94,0.22)' : 'transparent',
                    color: active ? '#F9FAFB' : '#D1D5DB',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Calculator() {
  const { i18n, t } = useTranslation(undefined, { keyPrefix: 'website.calculator' });
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const fmt = (n: number, dec = 0) =>
    n.toLocaleString(locale, { maximumFractionDigits: dec, minimumFractionDigits: 0 });

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const plan = useMemo(() => {
    if (!form.age || !form.weightKg || !form.heightCm) {
      return null;
    }
    return calculateNutritionPlan({
      activityLevel: form.activityLevel,
      age: form.age,
      bodyFatPercent: isValidBodyFat(form.bodyFatPercent) ? form.bodyFatPercent : undefined,
      fitnessGoal: form.fitnessGoal,
      gender: form.gender,
      heightCm: form.heightCm,
      liftingExperience: form.liftingExperience,
      weightGoal: form.weightGoal,
      weightKg: form.weightKg,
    });
  }, [form]);

  const bmr = plan?.bmr ?? 0;
  const tdee = plan?.tdee ?? 0;
  const target = plan?.targetCalories ?? 0;
  const bmi = form.heightCm > 0 ? bmiFromWeightAndHeightM(form.weightKg, form.heightCm / 100) : 0;
  const ffmi =
    isValidBodyFat(form.bodyFatPercent) && form.heightCm > 0
      ? ffmiFromWeightHeightAndBodyFat(form.weightKg, form.heightCm / 100, form.bodyFatPercent!)
      : null;

  const velocityKey =
    form.weightGoal === 'lose'
      ? 'results.velocityCut'
      : form.weightGoal === 'gain'
        ? 'results.velocityBulk'
        : 'results.velocityMaintain';

  const inputStyle = { backgroundColor: INPUT_BG, borderColor: INPUT_BORDER, color: 'white' };
  const inputClass =
    'w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-[#00FFA3]/40';
  const selectOptions = {
    activity: ([1, 2, 3, 4, 5] as const).map((level) => ({
      label: t(`form.activity${level}`),
      value: level,
    })),
    experience: (['beginner', 'intermediate', 'advanced'] as const).map((level) => ({
      label: t(`form.${level}`),
      value: level,
    })),
  };

  const toggleStyle = (active: boolean): React.CSSProperties =>
    active
      ? { backgroundColor: BRAND_GREEN, borderColor: BRAND_GREEN, color: '#000' }
      : { backgroundColor: INPUT_BG, borderColor: INPUT_BORDER, color: '#D1D5DB' };

  const goalFocusCards: [FitnessGoal, string, string][] = [
    ['hypertrophy', 'form.hypertrophy', 'form.hypertrophyDesc'],
    ['strength', 'form.strength', 'form.strengthDesc'],
    ['endurance', 'form.endurance', 'form.enduranceDesc'],
    ['weight_loss', 'form.weightLoss', 'form.weightLossDesc'],
    ['general', 'form.general', 'form.generalDesc'],
  ];

  return (
    <>
      <Head>
        <title>{t('pageTitle')}</title>
      </Head>
      <main className="relative overflow-hidden pb-20 pt-28">
        <GridPattern className="text-primary/50" />
        <FloatingShapes />
        <div
          className="absolute left-1/4 top-32 h-72 w-72 rounded-full blur-[100px]"
          style={{ backgroundColor: 'rgba(0,255,163,0.08)' }}
        />
        <div
          className="absolute bottom-32 right-1/4 h-64 w-64 rounded-full blur-[80px]"
          style={{ backgroundColor: 'rgba(6,182,212,0.08)' }}
        />
        <div className="from-background/30 to-background/30 absolute inset-0 bg-gradient-to-b via-transparent" />

        <div className="container relative z-10 mx-auto max-w-6xl px-4">
          {/* Title */}
          <div className="mb-10 text-center">
            <h1 className="mb-3 text-4xl font-black tracking-tight text-white md:text-6xl">
              {t('titleStart')}{' '}
              <span className="italic" style={{ color: BRAND_GREEN_BRIGHT }}>
                {t('titleHighlight')}
              </span>
            </h1>
            <p
              className="mx-auto max-w-lg text-sm leading-relaxed"
              style={{ color: BODY_TEXT_SOFT }}
            >
              {t('subtitle')}
            </p>
          </div>

          {/* Main grid */}
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* ── Form ─────────────────────────────────────────────────── */}
            <div
              className="rounded-2xl border p-6 md:p-8"
              style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
            >
              {/* Form header */}
              <div className="mb-6 flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-md border"
                  style={{
                    backgroundColor: 'rgba(0,255,163,0.12)',
                    borderColor: 'rgba(0,255,163,0.3)',
                  }}
                >
                  <BarChart3 className="h-4 w-4" color={BRAND_GREEN_BRIGHT} />
                </div>
                <span className="text-xs font-bold tracking-widest text-white">
                  {t('form.title')}
                </span>
              </div>

              {/* AGE + GENDER */}
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-semibold tracking-widest"
                    style={{ color: BODY_TEXT_SOFT }}
                  >
                    {t('form.age')}
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={form.age || ''}
                    onChange={(e) =>
                      set({ age: parseInt((e.target as HTMLInputElement).value) || 0 })
                    }
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-semibold tracking-widest"
                    style={{ color: BODY_TEXT_SOFT }}
                  >
                    {t('form.gender')}
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['male', 'female', 'other'] as Gender[]).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => set({ gender: g })}
                        className="rounded-lg border py-2 text-xs font-semibold transition-colors"
                        style={toggleStyle(form.gender === g)}
                      >
                        {t(`form.${g}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* WEIGHT + HEIGHT */}
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-semibold tracking-widest"
                    style={{ color: BODY_TEXT_SOFT }}
                  >
                    {t('form.weight')}
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="300"
                    step="0.5"
                    value={form.weightKg || ''}
                    onChange={(e) =>
                      set({ weightKg: parseFloat((e.target as HTMLInputElement).value) || 0 })
                    }
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-semibold tracking-widest"
                    style={{ color: BODY_TEXT_SOFT }}
                  >
                    {t('form.height')}
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="250"
                    value={form.heightCm || ''}
                    onChange={(e) =>
                      set({ heightCm: parseInt((e.target as HTMLInputElement).value) || 0 })
                    }
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* BODY FAT + EXPERIENCE */}
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-semibold tracking-widest"
                    style={{ color: BODY_TEXT_SOFT }}
                  >
                    {t('form.bodyFat')}
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="60"
                    step="0.5"
                    placeholder="–"
                    value={form.bodyFatPercent ?? ''}
                    onChange={(e) => {
                      const v = parseFloat((e.target as HTMLInputElement).value);
                      set({ bodyFatPercent: isNaN(v) ? undefined : v });
                    }}
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-semibold tracking-widest"
                    style={{ color: BODY_TEXT_SOFT }}
                  >
                    {t('form.experience')}
                  </label>
                  <WebSelect
                    value={form.liftingExperience}
                    onChange={(liftingExperience) => set({ liftingExperience })}
                    options={selectOptions.experience}
                    buttonClassName={`${inputClass} cursor-pointer`}
                    buttonStyle={inputStyle}
                  />
                </div>
              </div>

              {/* ACTIVITY LEVEL */}
              <div className="mb-4 space-y-1.5">
                <label
                  className="text-xs font-semibold tracking-widest"
                  style={{ color: BODY_TEXT_SOFT }}
                >
                  {t('form.activityLevel')}
                </label>
                <WebSelect
                  value={form.activityLevel}
                  onChange={(activityLevel) => set({ activityLevel })}
                  options={selectOptions.activity}
                  buttonClassName={`${inputClass} cursor-pointer`}
                  buttonStyle={inputStyle}
                />
              </div>

              {/* WEIGHT GOAL */}
              <div className="mb-4 space-y-1.5">
                <label
                  className="text-xs font-semibold tracking-widest"
                  style={{ color: BODY_TEXT_SOFT }}
                >
                  {t('form.weightGoal')}
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      ['lose', 'cut'],
                      ['maintain', 'maintain'],
                      ['gain', 'bulk'],
                    ] as [WeightGoal, string][]
                  ).map(([goal, key]) => (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => set({ weightGoal: goal })}
                      className="rounded-lg border py-2.5 text-sm font-semibold transition-colors"
                      style={toggleStyle(form.weightGoal === goal)}
                    >
                      {t(`form.${key}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* TRAINING FOCUS */}
              <div className="mb-6 space-y-1.5">
                <label
                  className="text-xs font-semibold tracking-widest"
                  style={{ color: BODY_TEXT_SOFT }}
                >
                  {t('form.trainingFocus')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {goalFocusCards.map(([goal, labelKey, descKey], idx) => {
                    const active = form.fitnessGoal === goal;
                    const isLast = idx === goalFocusCards.length - 1;
                    return (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => set({ fitnessGoal: goal })}
                        className={`rounded-xl border p-3 text-left transition-colors${isLast ? 'col-span-2' : ''}`}
                        style={{
                          backgroundColor: active ? 'rgba(0,255,163,0.08)' : INPUT_BG,
                          borderColor: active ? 'rgba(0,255,163,0.4)' : INPUT_BORDER,
                        }}
                      >
                        <p
                          className="text-xs font-bold tracking-wider"
                          style={{ color: active ? BRAND_GREEN_BRIGHT : '#fff' }}
                        >
                          {t(labelKey)}
                        </p>
                        <p className="mt-0.5 text-[10px]" style={{ color: MUTED }}>
                          {t(descKey)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Realtime badge */}
              <div
                className="flex items-center justify-center gap-2 rounded-xl py-3"
                style={{
                  background:
                    'linear-gradient(to right, rgba(79,70,229,0.7), rgba(16,185,129,0.7))',
                }}
              >
                <Zap className="h-4 w-4" color="#fff" />
                <span className="text-xs font-bold tracking-widest text-white">
                  {t('form.realtime')}
                </span>
              </div>
            </div>

            {/* ── Results ──────────────────────────────────────────────── */}
            <div className="flex flex-col gap-4">
              {/* BMR + TDEE */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-2xl border p-4"
                  style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
                >
                  <p
                    className="mb-1 text-[10px] font-bold tracking-widest"
                    style={{ color: BODY_TEXT_SOFT }}
                  >
                    {t('results.bmr')}
                  </p>
                  <p className="text-3xl font-black text-white">{fmt(bmr)}</p>
                  <p className="mt-2 text-[9px] uppercase leading-relaxed" style={{ color: MUTED }}>
                    {t('results.bmrDesc')}
                  </p>
                </div>
                <div
                  className="relative rounded-2xl border p-4"
                  style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
                >
                  <div
                    className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-widest"
                    style={{
                      backgroundColor: 'rgba(0,255,163,0.15)',
                      border: '1px solid rgba(0,255,163,0.3)',
                      color: BRAND_GREEN_BRIGHT,
                    }}
                  >
                    {t('results.target')}
                  </div>
                  <p
                    className="mb-1 text-[10px] font-bold tracking-widest"
                    style={{ color: BODY_TEXT_SOFT }}
                  >
                    {t('results.tdee')}
                  </p>
                  <p className="text-3xl font-black" style={{ color: BRAND_GREEN_BRIGHT }}>
                    {fmt(tdee)}
                  </p>
                  <p className="mt-2 text-[9px] uppercase leading-relaxed" style={{ color: MUTED }}>
                    {t('results.tdeeDesc')}
                  </p>
                </div>
              </div>

              {/* BMI + FFMI */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-2xl border p-4"
                  style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
                >
                  <p
                    className="mb-1 text-[10px] font-bold tracking-widest"
                    style={{ color: BODY_TEXT_SOFT }}
                  >
                    {t('results.bmi')}
                  </p>
                  <p className="text-3xl font-black text-white">{fmt(bmi, 1)}</p>
                  <p className="mt-2 text-[9px] uppercase leading-relaxed" style={{ color: MUTED }}>
                    {t('results.bmiDesc')}
                  </p>
                </div>
                <div
                  className="rounded-2xl border p-4"
                  style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
                >
                  <p
                    className="mb-1 text-[10px] font-bold tracking-widest"
                    style={{ color: BODY_TEXT_SOFT }}
                  >
                    {t('results.ffmi')}
                  </p>
                  <p className="text-3xl font-black text-white">
                    {ffmi !== null ? fmt(ffmi, 1) : '–'}
                  </p>
                  <p className="mt-2 text-[9px] uppercase leading-relaxed" style={{ color: MUTED }}>
                    {t('results.ffmiDesc')}
                  </p>
                </div>
              </div>

              {/* Macro Profile */}
              <div
                className="rounded-2xl border p-5"
                style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs font-bold tracking-widest text-white">
                    {t('results.macroProfile')}
                  </p>
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-widest"
                    style={{
                      backgroundColor: 'rgba(0,255,163,0.1)',
                      border: '1px solid rgba(0,255,163,0.2)',
                      color: BRAND_GREEN_BRIGHT,
                    }}
                  >
                    {t(GOAL_LABEL_KEYS[form.fitnessGoal]).toUpperCase()}
                  </span>
                </div>

                {(
                  [
                    [
                      'protein',
                      plan?.protein ?? 0,
                      plan?.proteinPct ?? 0,
                      MACRO_COLORS.protein,
                      CALORIES_FOR_PROTEIN,
                    ],
                    [
                      'fats',
                      plan?.fats ?? 0,
                      plan?.fatsPct ?? 0,
                      MACRO_COLORS.fats,
                      CALORIES_FOR_FAT,
                    ],
                    [
                      'carbs',
                      plan?.carbs ?? 0,
                      plan?.carbsPct ?? 0,
                      MACRO_COLORS.carbs,
                      CALORIES_FOR_CARBS,
                    ],
                  ] as [string, number, number, string, number][]
                ).map(([key, grams, pct, color, kcalPerG]) => (
                  <div key={key} className="mb-3 last:mb-0">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-widest text-white">
                        {t(`results.${key}`)} <span style={{ color: MUTED }}>{pct}%</span>
                      </span>
                      <span className="text-[10px] font-bold" style={{ color: BODY_TEXT_SOFT }}>
                        {fmt(grams)}G / {fmt(Math.round(grams * kcalPerG))} {t('results.kcal')}
                      </span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full"
                      style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ backgroundColor: color, width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Metabolic Velocity */}
              <div
                className="rounded-2xl border p-4"
                style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                    style={{
                      backgroundColor: 'rgba(0,255,163,0.1)',
                      borderColor: 'rgba(0,255,163,0.2)',
                    }}
                  >
                    <Zap className="h-4 w-4" color={BRAND_GREEN_BRIGHT} />
                  </div>
                  <div>
                    <p
                      className="text-[10px] font-bold tracking-widest"
                      style={{ color: BODY_TEXT_SOFT }}
                    >
                      {t('results.metabolicVelocity')}
                    </p>
                    <p className="text-xs font-semibold text-white">{t(velocityKey)}</p>
                  </div>
                </div>
              </div>

              {/* Daily Calorie Target */}
              <div
                className="rounded-2xl border p-4"
                style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
              >
                <p
                  className="mb-2 text-[10px] font-bold tracking-widest"
                  style={{ color: BODY_TEXT_SOFT }}
                >
                  {t('results.dailyTarget')}
                </p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-black" style={{ color: BRAND_GREEN_BRIGHT }}>
                    {fmt(target)}{' '}
                    <span className="text-sm font-bold" style={{ color: MUTED }}>
                      {t('results.kcal')}
                    </span>
                  </p>
                  <div className="text-right">
                    <p
                      className="text-[9px] font-semibold uppercase tracking-widest"
                      style={{ color: MUTED }}
                    >
                      {t('results.tdee')}
                    </p>
                    <p className="text-lg font-bold" style={{ color: BODY_TEXT_SOFT }}>
                      {fmt(tdee)}{' '}
                      <span className="text-xs" style={{ color: MUTED }}>
                        {t('results.kcal')}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
