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
}

export async function writeWorkoutToHealthConnect(
  _payload: CompletedWorkoutPayload
): Promise<string | undefined> {
  return undefined;
}
