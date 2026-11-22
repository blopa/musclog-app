/**
 * The coach's "state snapshot": a few lines of what is true about the person RIGHT NOW (today's
 * intake against their targets, the weight trend, today's workout, a Weekly Review decision that is
 * still shaping the week). Pure (no React Native, no database): `services/coachSnapshot.ts` reads
 * the data, this decides what the model is told and how.
 *
 * Why it exists: the chat prompt used to carry a one-line profile and a few logs, so the coach could
 * not answer "can I still eat X today?" or "why is my bench stuck?" with anything but generalities.
 * It is deliberately short (a few hundred characters) and is a block of DATA: the model is told the
 * numbers come from the app, never to invent others.
 *
 * Energy stays in kilocalories (stored and prompted value; `docs` energy-unit rule). Carbs are
 * digestible carbs on both sides, like the diary's bar.
 */

export type SnapshotMacros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type CoachSnapshotInput = {
  /** Today's targets; null with no goal or in intuitive-eating mode (then no target is stated). */
  targets: SnapshotMacros | null;
  /** What was eaten today so far (digestible carbs), null when nutrition could not be read. */
  eatenToday: SnapshotMacros | null;
  /** Whether anything at all was logged today (an empty day reads "nothing logged yet"). */
  loggedFoodToday: boolean;
  /** Weight change over `days` in the display unit, null with fewer than two weigh-ins. */
  weightChange: { amount: number; unit: string; days: number } | null;
  /** Today's (or the next rotating) workout, null when none is planned. */
  workout: { name: string; completedToday: boolean; scheduled: boolean } | null;
  /** A repeat/lighter week chosen in the Weekly Review that is still live, with its end day. */
  trainingWeek: { decision: 'repeat' | 'lighter'; untilDay: string } | null;
};

export const COACH_SNAPSHOT_HEADING =
  'Right now, read from the app (today so far; use only these numbers, never invent others):';

function whole(value: number): number {
  return Math.round(value);
}

function nutritionLine(input: CoachSnapshotInput): string | null {
  const { targets, eatenToday, loggedFoodToday } = input;
  if (!eatenToday) {
    return null;
  }

  if (!loggedFoodToday) {
    return targets
      ? `- Nutrition today: nothing logged yet. Targets: ${whole(targets.calories)} kcal, protein ${whole(targets.protein)} g, carbs ${whole(targets.carbs)} g, fat ${whole(targets.fat)} g, fiber ${whole(targets.fiber)} g.`
      : '- Nutrition today: nothing logged yet.';
  }

  if (!targets) {
    return `- Nutrition today: ${whole(eatenToday.calories)} kcal eaten so far (protein ${whole(eatenToday.protein)} g, carbs ${whole(eatenToday.carbs)} g, fat ${whole(eatenToday.fat)} g, fiber ${whole(eatenToday.fiber)} g).`;
  }

  const pair = (label: string, eaten: number, target: number, unit: string) =>
    `${label} ${whole(eaten)}/${whole(target)}${unit}`;

  return `- Nutrition today (eaten/target): ${[
    pair('calories', eatenToday.calories, targets.calories, ' kcal'),
    pair('protein', eatenToday.protein, targets.protein, ' g'),
    pair('carbs', eatenToday.carbs, targets.carbs, ' g'),
    pair('fat', eatenToday.fat, targets.fat, ' g'),
    pair('fiber', eatenToday.fiber, targets.fiber, ' g'),
  ].join(', ')}.`;
}

function weightLine(input: CoachSnapshotInput): string | null {
  const change = input.weightChange;
  if (!change) {
    return null;
  }

  const rounded = Math.round(Math.abs(change.amount) * 10) / 10;
  if (rounded === 0) {
    return `- Weight: unchanged over the last ${change.days} days.`;
  }

  return `- Weight: ${change.amount < 0 ? 'down' : 'up'} ${rounded} ${change.unit} over the last ${change.days} days.`;
}

function workoutLine(input: CoachSnapshotInput): string | null {
  const workout = input.workout;
  if (!workout) {
    return null;
  }

  if (workout.completedToday) {
    return `- Workout today: "${workout.name}", already done.`;
  }

  return workout.scheduled
    ? `- Workout today: "${workout.name}" is planned, not done yet.`
    : `- Next workout in their plan: "${workout.name}".`;
}

function trainingWeekLine(input: CoachSnapshotInput): string | null {
  const week = input.trainingWeek;
  if (!week) {
    return null;
  }

  return week.decision === 'lighter'
    ? `- Training week: they chose a lighter week in their Weekly Review (until ${week.untilDay}); loads and sets are deliberately reduced.`
    : `- Training week: they chose to repeat last week's targets in their Weekly Review (until ${week.untilDay}).`;
}

/** The snapshot block, or '' when there is nothing to say (the prompt then carries no heading). */
export function formatCoachSnapshot(input: CoachSnapshotInput): string {
  const lines = [
    nutritionLine(input),
    weightLine(input),
    workoutLine(input),
    trainingWeekLine(input),
  ].filter((line): line is string => line != null);

  return lines.length > 0 ? [COACH_SNAPSHOT_HEADING, ...lines].join('\n') : '';
}
