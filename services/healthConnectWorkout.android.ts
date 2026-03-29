/**
 * Writes completed Musclog workouts to Health Connect as ExerciseSession records.
 * Checks write permission first; skips silently if not granted or on non-Android.
 */

import { Platform } from 'react-native';
import { ExerciseSegmentType, ExerciseType, RecordingMethod } from 'react-native-health-connect';

import type { Units } from '../constants/settings';
import { SettingsService } from '../database/services/SettingsService';
import i18n from '../lang/lang';
import { kgToDisplay } from '../utils/unitConversion';
import { getWeightUnitI18nKey } from '../utils/units';
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
  /** Calories burned (kcal), e.g. from MWEM calculation */
  caloriesBurned?: number;
  /** Workout type (strength, cardio, flexibility, calisthenics, other) for Health Connect exerciseType */
  workoutType?: string;
  /** User's unit preference; if omitted, read from settings */
  units?: Units;
  /** Per-exercise breakdown for segments and notes */
  segmentItems?: SegmentItem[];
}

/**
 * Maps app workout type to Health Connect ExerciseType constant.
 */
function mapWorkoutTypeToHealthConnect(workoutType: string | undefined): number {
  switch (workoutType) {
    case 'strength':
      return ExerciseType.STRENGTH_TRAINING;
    case 'cardio':
      return ExerciseType.HIGH_INTENSITY_INTERVAL_TRAINING;
    case 'flexibility':
      return ExerciseType.STRETCHING;
    case 'calisthenics':
      return ExerciseType.CALISTHENICS;
    case 'other':
    default:
      return ExerciseType.OTHER_WORKOUT;
  }
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
 * Weights are stored in kg; displayed in user unit (kg or lb).
 */
function formatSegmentBreakdown(
  segmentItems: SegmentItem[],
  unitLabel: string,
  units: Units
): string {
  return segmentItems
    .map((item) => {
      const setStr = item.sets
        .filter((s) => s.reps > 0 || s.weight > 0)
        .map((s) => {
          const displayWeight = kgToDisplay(s.weight, units);
          const rounded =
            displayWeight % 1 === 0 ? displayWeight : Math.round(displayWeight * 10) / 10;
          return i18n.t('healthConnect.repsWeightFormat', {
            reps: s.reps,
            weight: rounded,
            unit: unitLabel,
          });
        })
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
 * @returns The Health Connect record ID assigned to the inserted record, or undefined if not written.
 */
export async function writeWorkoutToHealthConnect(
  payload: CompletedWorkoutPayload
): Promise<string | undefined> {
  if (Platform.OS !== 'android') {
    return undefined;
  }

  try {
    const status = healthConnectService.getStatus();
    if (status !== HealthConnectStatus.AVAILABLE) {
      try {
        await healthConnectService.initializeHealthConnect();
      } catch {
        // HC not installed or not available - skip silently
        return undefined;
      }
    }

    const hasWrite = await healthConnectService.hasPermissionForRecordType(
      'ExerciseSession',
      'write'
    );

    if (!hasWrite) {
      return undefined;
    }

    const startTime = new Date(payload.startedAt).toISOString();
    const endTime = new Date(payload.completedAt).toISOString();

    const units: Units = payload.units ?? (await SettingsService.getUnits());
    const unitLabel = i18n.t(getWeightUnitI18nKey(units));

    const noteParts: string[] = [];
    if (payload.caloriesBurned != null && payload.caloriesBurned > 0) {
      noteParts.push(
        i18n.t('healthConnect.workoutCaloriesNote', { calories: payload.caloriesBurned })
      );
    }

    if (payload.totalVolume != null && payload.totalVolume > 0) {
      noteParts.push(
        i18n.t('healthConnect.workoutVolumeNote', {
          volume: payload.totalVolume.toLocaleString(),
          unit: unitLabel,
        })
      );
    }
    if (payload.segmentItems && payload.segmentItems.length > 0) {
      const breakdown = formatSegmentBreakdown(payload.segmentItems, unitLabel, units);
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
      exerciseType: mapWorkoutTypeToHealthConnect(payload.workoutType),
      startTime,
      endTime,
      title: `Musclog - ${payload.workoutName}`,
      notes,
      segments,
      metadata: {
        dataOrigin: 'Musclog',
        recordingMethod: RecordingMethod.RECORDING_METHOD_ACTIVELY_RECORDED,
      },
    };

    const recordIds = await healthConnectService.insertRecords([record]);
    return recordIds[0];
  } catch (error) {
    console.warn('[healthConnectWorkout] Failed to write workout to Health Connect:', error);
    return undefined;
  }
}
