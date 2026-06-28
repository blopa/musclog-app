/*
 * Demo fixture data and data builders for buildGameBoyDemoCartridgeRam.
 * Separated from decodeGameBoySave.ts to keep the encoder/decoder module
 * under 1 000 lines while giving the demo a clear home of its own.
 *
 * At runtime this module has no dependencies on decodeGameBoySave.ts — the
 * `import type` statements below are erased by TypeScript, so there is no
 * circular module cycle.
 */

import type { GameBoyCalDate } from './decodeGameBoySave';

// Mirrors the CUSTOM_FOOD_BASE constant in decodeGameBoySave.ts.
// Stable hardware-layout constant; duplicated here to break the import cycle.
const CUSTOM_FOOD_BASE = 0x8000;

type DemoWeighInRecord = { dayNumber: number; weightKgTenths: number };
type DemoFoodLogRecord = { dayNumber: number; foodIdx: number; grams: number };
type DemoWorkoutSetRecord = { exerciseIdx: number; reps: number; weightKgTenths: number };
type DemoWorkoutRecord = {
  dayNumber: number;
  dominantMuscleIdx: number;
  exerciseCount: number;
  sets: DemoWorkoutSetRecord[];
};

export type DemoCustomFoodRecord = {
  slot: number;
  name: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
};

function dayNumberFromDate(date: GameBoyCalDate): number {
  const ms = Date.UTC(date.year, date.month - 1, date.day);
  return Math.floor((ms - Date.UTC(2000, 0, 1)) / 86_400_000);
}

function calendarDaysFrom(date: GameBoyCalDate, deltaDays: number): GameBoyCalDate {
  const next = new Date(date.year, date.month - 1, date.day);
  next.setDate(next.getDate() + deltaDays);
  return { year: next.getFullYear(), month: next.getMonth() + 1, day: next.getDate() };
}

function recentDayNumber(today: GameBoyCalDate, daysAgo: number): number {
  return dayNumberFromDate(calendarDaysFrom(today, -daysAgo));
}

export const DEMO_CUSTOM_FOODS: DemoCustomFoodRecord[] = [
  {
    slot: 0,
    name: 'OVERNIGHT OATS',
    kcal: 146,
    proteinG: 6.2,
    fatG: 4.1,
    carbsG: 21.5,
    fiberG: 4.0,
  },
  {
    slot: 1,
    name: 'CHICKEN RICE',
    kcal: 168,
    proteinG: 13.2,
    fatG: 5.1,
    carbsG: 16.3,
    fiberG: 0.8,
  },
  { slot: 2, name: 'PB SHAKE', kcal: 92, proteinG: 7.8, fatG: 4.2, carbsG: 7.6, fiberG: 1.3 },
  { slot: 3, name: 'BEEF PASTA', kcal: 180, proteinG: 12.0, fatG: 6.0, carbsG: 19.0, fiberG: 1.2 },
  { slot: 4, name: 'YOGURT BOWL', kcal: 110, proteinG: 9.0, fatG: 3.0, carbsG: 12.0, fiberG: 1.0 },
];

export function buildDemoWeighIns(today: GameBoyCalDate): DemoWeighInRecord[] {
  const records: DemoWeighInRecord[] = [];
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const dayIndex = 29 - daysAgo;
    const weightKgTenths = 849 - dayIndex + ((dayIndex % 5) - 2) * 2;
    records.push({ dayNumber: recentDayNumber(today, daysAgo), weightKgTenths });
  }
  return records;
}

export function buildDemoFoodLog(today: GameBoyCalDate): DemoFoodLogRecord[] {
  const custom = (slot: number) => CUSTOM_FOOD_BASE + slot;
  const entries: DemoFoodLogRecord[] = [];
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const dayIndex = 29 - daysAgo;
    const dayNumber = recentDayNumber(today, daysAgo);
    const dayFoods = [
      { foodIdx: custom(dayIndex % 5), grams: 255 + ((dayIndex * 17) % 55) },
      { foodIdx: custom((dayIndex + 1) % 5), grams: 360 + ((dayIndex * 23) % 120) },
      { foodIdx: custom((dayIndex + 2) % 5), grams: 220 + ((dayIndex * 19) % 90) },
      { foodIdx: custom((dayIndex + 3) % 5), grams: 280 + ((dayIndex * 29) % 80) },
    ];
    for (const entry of dayFoods) {
      entries.push({ dayNumber, foodIdx: entry.foodIdx, grams: entry.grams });
    }
  }
  return entries;
}

export function buildDemoWorkouts(today: GameBoyCalDate): DemoWorkoutRecord[] {
  const workoutTemplates = [
    {
      dominantMuscleIdx: 0,
      sets: [
        { exerciseIdx: 54, reps: 14, weightKgTenths: 0 },
        { exerciseIdx: 54, reps: 12, weightKgTenths: 0 },
        { exerciseIdx: 101, reps: 16, weightKgTenths: 0 },
        { exerciseIdx: 101, reps: 14, weightKgTenths: 0 },
      ],
    },
    {
      dominantMuscleIdx: 1,
      sets: [
        { exerciseIdx: 13, reps: 12, weightKgTenths: 160 },
        { exerciseIdx: 13, reps: 10, weightKgTenths: 180 },
        { exerciseIdx: 21, reps: 12, weightKgTenths: 320 },
        { exerciseIdx: 21, reps: 10, weightKgTenths: 340 },
      ],
    },
    {
      dominantMuscleIdx: 2,
      sets: [
        { exerciseIdx: 10, reps: 12, weightKgTenths: 700 },
        { exerciseIdx: 10, reps: 10, weightKgTenths: 740 },
        { exerciseIdx: 12, reps: 12, weightKgTenths: 620 },
        { exerciseIdx: 12, reps: 10, weightKgTenths: 660 },
      ],
    },
    {
      dominantMuscleIdx: 3,
      sets: [
        { exerciseIdx: 0, reps: 8, weightKgTenths: 820 },
        { exerciseIdx: 0, reps: 8, weightKgTenths: 840 },
        { exerciseIdx: 117, reps: 10, weightKgTenths: 320 },
        { exerciseIdx: 117, reps: 8, weightKgTenths: 340 },
      ],
    },
    {
      dominantMuscleIdx: 4,
      sets: [
        { exerciseIdx: 52, reps: 50, weightKgTenths: 0 },
        { exerciseIdx: 52, reps: 45, weightKgTenths: 0 },
        { exerciseIdx: 68, reps: 14, weightKgTenths: 240 },
        { exerciseIdx: 68, reps: 12, weightKgTenths: 260 },
      ],
    },
    {
      dominantMuscleIdx: 5,
      sets: [
        { exerciseIdx: 4, reps: 5, weightKgTenths: 1420 },
        { exerciseIdx: 4, reps: 5, weightKgTenths: 1480 },
        { exerciseIdx: 43, reps: 18, weightKgTenths: 240 },
        { exerciseIdx: 43, reps: 16, weightKgTenths: 260 },
      ],
    },
    {
      dominantMuscleIdx: 6,
      sets: [
        { exerciseIdx: 35, reps: 15, weightKgTenths: 0 },
        { exerciseIdx: 36, reps: 10, weightKgTenths: 1000 },
        { exerciseIdx: 111, reps: 14, weightKgTenths: 200 },
        { exerciseIdx: 111, reps: 12, weightKgTenths: 220 },
      ],
    },
    {
      dominantMuscleIdx: 7,
      sets: [
        { exerciseIdx: 8, reps: 8, weightKgTenths: 1120 },
        { exerciseIdx: 8, reps: 8, weightKgTenths: 1160 },
        { exerciseIdx: 34, reps: 10, weightKgTenths: 900 },
        { exerciseIdx: 34, reps: 10, weightKgTenths: 940 },
      ],
    },
    {
      dominantMuscleIdx: 8,
      sets: [
        { exerciseIdx: 3, reps: 8, weightKgTenths: 460 },
        { exerciseIdx: 3, reps: 8, weightKgTenths: 480 },
        { exerciseIdx: 16, reps: 14, weightKgTenths: 100 },
        { exerciseIdx: 16, reps: 12, weightKgTenths: 120 },
      ],
    },
  ] as const;

  const workouts: DemoWorkoutRecord[] = [];
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const dayIndex = 29 - daysAgo;
    const template = workoutTemplates[dayIndex % workoutTemplates.length];
    const progression = dayIndex % 4;
    workouts.push({
      dayNumber: recentDayNumber(today, daysAgo),
      dominantMuscleIdx: template.dominantMuscleIdx,
      exerciseCount: 2,
      sets: template.sets.map((set, setIndex) => ({
        exerciseIdx: set.exerciseIdx,
        reps: Math.max(1, set.reps + ((dayIndex + setIndex) % 3 === 0 ? 1 : 0)),
        weightKgTenths:
          set.weightKgTenths === 0
            ? 0
            : set.weightKgTenths + progression * (setIndex < 2 ? 20 : 10),
      })),
    });
  }
  return workouts;
}
