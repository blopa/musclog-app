/**
 * Writes completed workouts to Apple Health (HKWorkout).
 */

import {
  AuthorizationStatus,
  authorizationStatusFor,
  saveWorkoutSample,
  WorkoutActivityType,
  WorkoutTypeIdentifier,
} from '@kingstinct/react-native-healthkit';
import type { ObjectTypeIdentifier } from '@kingstinct/react-native-healthkit/types';

import type { Units } from '../constants/settings';
import { SettingsService } from '../database/services/SettingsService';
import i18n from '../lang/lang';
import { kgToDisplay } from '../utils/unitConversion';
import { getWeightUnitI18nKey } from '../utils/units';

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

function mapWorkoutTypeToActivity(workoutType: string | undefined): WorkoutActivityType {
  switch (workoutType) {
    case 'strength':
      return WorkoutActivityType.traditionalStrengthTraining;
    case 'cardio':
      return WorkoutActivityType.highIntensityIntervalTraining;
    case 'flexibility':
      return WorkoutActivityType.flexibility;
    case 'calisthenics':
      return WorkoutActivityType.functionalStrengthTraining;
    case 'other':
    default:
      return WorkoutActivityType.other;
  }
}

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

export async function writeWorkoutToHealthConnect(
  payload: CompletedWorkoutPayload
): Promise<string | undefined> {
  try {
    if (
      authorizationStatusFor(WorkoutTypeIdentifier as unknown as ObjectTypeIdentifier) !==
      AuthorizationStatus.sharingAuthorized
    ) {
      return undefined;
    }

    const startDate = new Date(payload.startedAt);
    const endDate = new Date(payload.completedAt);
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

    const activity = mapWorkoutTypeToActivity(payload.workoutType);
    const workout = await saveWorkoutSample(
      activity,
      [],
      startDate,
      endDate,
      payload.caloriesBurned != null && payload.caloriesBurned > 0
        ? { energyBurned: payload.caloriesBurned }
        : undefined,
      noteParts.length > 0 ? ({ HKWorkoutBrandName: noteParts.join('\n') } as any) : undefined
    );

    return workout.uuid;
  } catch (error) {
    console.warn('[healthConnectWorkout.iOS] Failed to write workout:', error);
    return undefined;
  }
}
