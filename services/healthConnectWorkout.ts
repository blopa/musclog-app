/**
 * Writes completed Musclog workouts to Health Connect as ExerciseSession records.
 * Checks write permission first; skips silently if not granted or on non-Android.
 */

import { Platform } from 'react-native';
import { ExerciseType } from 'react-native-health-connect';

import { healthConnectService, HealthConnectStatus } from './healthConnect';

export interface CompletedWorkoutPayload {
  workoutName: string;
  startedAt: number;
  completedAt: number;
  totalVolume?: number;
}

/**
 * Writes a completed workout to Health Connect as an ExerciseSessionRecord.
 * - No-ops on non-Android.
 * - If ExerciseSession write permission is not granted, returns without error.
 * - On failure (e.g. HC not available), logs and returns without throwing.
 */
export async function writeWorkoutToHealthConnect(payload: CompletedWorkoutPayload): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    const status = healthConnectService.getStatus();
    if (status !== HealthConnectStatus.AVAILABLE) {
      try {
        await healthConnectService.initializeHealthConnect();
      } catch {
        // HC not installed or not available - skip silently
        return;
      }
    }

    const hasWrite = await healthConnectService.hasPermissionForRecordType(
      'ExerciseSession',
      'write'
    );
    if (!hasWrite) {
      return;
    }

    const startTime = new Date(payload.startedAt).toISOString();
    const endTime = new Date(payload.completedAt).toISOString();

    const notes =
      payload.totalVolume != null && payload.totalVolume > 0
        ? `Volume: ${payload.totalVolume.toLocaleString()} kg`
        : undefined;

    // TODO: add Segments, which is a Breakdowns of the workout phases (e.g., 5 minutes of "Warm-up", 45 minutes of "Active", 10 minutes of "Cool-down")
    // so we should put the workout data, like 12 reps of 10kg of squat, etc
    // TODO: also add Metadata, let health connect know that the musclog app created this workout
    const record = {
      recordType: 'ExerciseSession' as const,
      exerciseType: ExerciseType.STRENGTH_TRAINING,
      startTime,
      endTime,
      title: payload.workoutName,
      notes,
    };

    await healthConnectService.insertRecords([record]);
  } catch (error) {
    console.warn('[healthConnectWorkout] Failed to write workout to Health Connect:', error);
  }
}
