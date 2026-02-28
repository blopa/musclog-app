/**
 * Writes completed Musclog workouts to Health Connect as ExerciseSession records.
 * Checks write permission first; skips silently if not granted or on non-Android.
 */

import { Platform } from 'react-native';
import { ExerciseSegmentType, ExerciseType, RecordingMethod } from 'react-native-health-connect';

import type { Units } from '../constants/settings';
import { SettingsService } from '../database/services/SettingsService';
import i18n from '../lang/lang';
import { getWeightUnit, getWeightUnitI18nKey } from '../utils/units';
import { healthConnectService, HealthConnectStatus } from './healthConnect';

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
  /** User's unit preference; if omitted, read from settings */
  units?: Units;
  /** Per-exercise breakdown for segments and notes */
  segmentItems?: SegmentItem[];
}

/**
 * Builds segments for Health Connect from segment items.
 * Approximates start/end times by splitting workout duration evenly across exercises.
 */
function buildSegments(
  startedAt: number,
  completedAt: number,
  segmentItems: SegmentItem[]
): { startTime: string; endTime: string; segmentType: number; repetitions: number }[] {
  if (segmentItems.length === 0) {
    return [];
  }
  const durationMs = completedAt - startedAt;
  const segmentDurationMs = durationMs / segmentItems.length;
  return segmentItems.map((item, index) => {
    const segStart = startedAt + index * segmentDurationMs;
    const segEnd = index === segmentItems.length - 1 ? completedAt : segStart + segmentDurationMs;
    return {
      startTime: new Date(segStart).toISOString(),
      endTime: new Date(segEnd).toISOString(),
      segmentType: ExerciseSegmentType.OTHER_WORKOUT,
      repetitions: item.totalReps,
    };
  });
}

/**
 * Builds a human-readable breakdown for notes (e.g. "Squat: 12×10kg, 10×12kg; Bench: 8×60kg").
 */
function formatSegmentBreakdown(segmentItems: SegmentItem[], unitLabel: string): string {
  return segmentItems
    .map((item) => {
      const setStr = item.sets
        .filter((s) => s.reps > 0 || s.weight > 0)
        .map((s) => `${s.reps}×${s.weight} ${unitLabel}`)
        .join(', ');
      return setStr
        ? `${item.exerciseName}: ${setStr}`
        : `${item.exerciseName}: ${item.totalReps} reps`;
    })
    .join('; ');
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

    const units: Units = payload.units ?? (await SettingsService.getUnits());
    const unitLabel = i18n.t(getWeightUnitI18nKey(units));
    const weightUnit = getWeightUnit(units);

    const noteParts: string[] = [];
    if (payload.totalVolume != null && payload.totalVolume > 0) {
      noteParts.push(
        i18n.t('healthConnect.workoutVolumeNote', {
          volume: payload.totalVolume.toLocaleString(),
          unit: unitLabel,
        })
      );
    }
    if (payload.segmentItems && payload.segmentItems.length > 0) {
      const breakdown = formatSegmentBreakdown(payload.segmentItems, weightUnit);
      if (breakdown) {
        noteParts.push(breakdown);
      }
    }
    const notes = noteParts.length > 0 ? noteParts.join('\n') : undefined;

    const segments =
      payload.segmentItems && payload.segmentItems.length > 0
        ? buildSegments(payload.startedAt, payload.completedAt, payload.segmentItems)
        : undefined;

    const record = {
      recordType: 'ExerciseSession' as const,
      exerciseType: ExerciseType.STRENGTH_TRAINING, // TODO: use whatever is the workout type
      startTime,
      endTime,
      title: payload.workoutName,
      notes,
      segments,
      metadata: {
        dataOrigin: 'Musclog',
        recordingMethod: RecordingMethod.RECORDING_METHOD_ACTIVELY_RECORDED,
      },
    };

    await healthConnectService.insertRecords([record]);
  } catch (error) {
    console.warn('[healthConnectWorkout] Failed to write workout to Health Connect:', error);
  }
}
