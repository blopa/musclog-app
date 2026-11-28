import { WorkoutTemplateRepository } from '@/database/repositories/WorkoutTemplateRepository';
import { WorkoutTodayRepository } from '@/database/repositories/WorkoutTodayRepository';
import { WorkoutPlanService } from '@/database/services/WorkoutPlanService';
import { WorkoutService } from '@/database/services/WorkoutService';
import {
  type MatchableWorkout,
  matchWorkoutsBySpeech,
  namesNoWorkout,
  toWorkoutChoice,
  type WorkoutChoice,
} from '@/utils/voiceCommand/workoutMatch';

export type SpokenWorkoutLookup =
  /** A workout is already running: it is the one to show. */
  | { kind: 'active'; workoutLogId: string }
  /** The one workout that was named. */
  | { kind: 'found'; workout: WorkoutChoice }
  /** The person says which: never empty. */
  | { kind: 'choose'; workouts: WorkoutChoice[] }
  /** There is no saved workout. */
  | { kind: 'none' };

async function savedWorkouts(): Promise<MatchableWorkout[]> {
  const [templates, plans] = await Promise.all([
    WorkoutTemplateRepository.getActive().fetch(),
    WorkoutPlanService.getPlansWithMemberships(),
  ]);

  return templates.map((template) => ({
    templateId: template.id,
    name: template.name,
    plans: plans
      .filter(({ memberships }) => memberships.some((row) => row.templateId === template.id))
      .map(({ plan }) => ({ planId: plan.id, planName: plan.name })),
  }));
}

async function todaysWorkout(): Promise<WorkoutChoice | null> {
  const today = (await WorkoutTodayRepository.upcoming()).find((item) => !item.completedToday);

  return today
    ? {
        templateId: today.template.id,
        name: today.template.name,
        planId: today.planId,
        planName: today.planName,
      }
    : null;
}

/**
 * Finds what "start ... workout" means on this phone. It only reads. One named workout is found;
 * with none named at all, today's is offered; anything else is for the person to pick.
 */
export async function findSpokenWorkout(said: string): Promise<SpokenWorkoutLookup> {
  const active = await WorkoutService.getActiveWorkout();
  if (active) {
    return { kind: 'active', workoutLogId: active.id };
  }

  const workouts = await savedWorkouts();
  if (workouts.length === 0) {
    return { kind: 'none' };
  }

  const matches = matchWorkoutsBySpeech(workouts, said);
  if (matches.length === 1) {
    return { kind: 'found', workout: matches[0] };
  }

  if (matches.length > 1) {
    return { kind: 'choose', workouts: matches };
  }

  const today = namesNoWorkout(said) ? await todaysWorkout() : null;

  return { kind: 'choose', workouts: today ? [today] : workouts.map(toWorkoutChoice) };
}
