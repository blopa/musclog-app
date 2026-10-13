import type { Units } from '@/constants/settings';

export interface SegmentItem {
  exerciseName: string;
  totalReps: number;
  sets: { reps: number; weight: number }[];
}

export interface CompletedWorkoutPayload {
  workoutName: string;
  startedAt: number;
  completedAt: number;
  totalVolume?: number;
  caloriesBurned?: number;
  workoutType?: string;
  units?: Units;
  segmentItems?: SegmentItem[];
  /** A quick walk/run log: which activity it was, so it maps to WALKING/RUNNING and not generic cardio. */
  activity?: 'walk' | 'run';
  /** Distance covered, in metres. Written as its own record where the platform needs one. */
  distanceM?: number;
}

export async function writeWorkoutToHealthConnect(
  _payload: CompletedWorkoutPayload
): Promise<string | undefined> {
  return undefined;
}
