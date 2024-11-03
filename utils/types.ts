import { DARK, LIGHT, SYSTEM_DEFAULT } from '@/constants/colors';
import {
    ACTIVITY_LEVELS,
    EXERCISE_TYPES,
    EXPERIENCE_LEVELS,
    MUSCLE_GROUPS,
    VOLUME_CALCULATION_TYPES,
} from '@/constants/exercises';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { EATING_PHASES, NUTRITION_TYPES } from '@/constants/nutrition';
import { FRIDAY, MONDAY, SATURDAY, SUNDAY, THURSDAY, TUESDAY, WEDNESDAY } from '@/constants/storage';
import { RecordResult } from 'react-native-health-connect/lib/typescript/types';

export type ThemeType = typeof DARK | typeof LIGHT | typeof SYSTEM_DEFAULT;

export type ExerciseInsertType = {
    createdAt?: string;
    deletedAt?: string;
    description?: string;
    id?: number;
    image?: string;
    muscleGroup?: string;
    name: string;
    type?: string;
};

export type ExerciseReturnType = {
    id: number;
} & Omit<ExerciseInsertType, 'id'>;

export type SetInsertType = {
    createdAt?: string;
    deletedAt?: string;
    difficultyLevel?: number; // TODO maybe not needed
    exerciseId: number;
    id?: number;
    isDropSet?: boolean;
    reps: number;
    restTime: number;
    weight: number;
    workoutId: number;
    setOrder: number;
    supersetName?: string;
};

export type CurrentWorkoutProgressType = {
    difficultyLevel: number;
    exerciseId?: number;
    name: string;
    reps: number;
    restTime: number;
    setId: number;
    setIndex: number;
    targetReps: number;
    targetWeight: number;
    weight: number;
    workoutDuration: number;
    supersetName?: string;
};

export type SetReturnType = {
    id: number;
} & Omit<SetInsertType, 'id'>;

export type ExerciseVolumeSetType = ({
    setId: number,
    targetReps?: number,
    targetWeight?: number,
} & SetReturnType);

export type ExerciseVolumeType = {
    exerciseId: number;
    sets: ExerciseVolumeSetType[];
};

export type WorkoutVolumeType = {
    exercises: ExerciseVolumeType[];
    workoutId: number;
};

export type WorkoutInsertType = {
    createdAt?: string;
    deletedAt?: string;
    description?: string;
    id?: number;
    recurringOnWeek?:
        typeof FRIDAY
        | typeof MONDAY
        | typeof SATURDAY
        | typeof SUNDAY
        | typeof THURSDAY
        | typeof TUESDAY
        | typeof WEDNESDAY;
    title: string;
    volumeCalculationType: VolumeCalculationTypeType;
};

export type VersioningInsertType = {
    id?: number;
    version: string;
};

export type VersioningReturnType = {
    id: number;
} & Omit<VersioningInsertType, 'id'>;

export type WorkoutReturnType = {
    id: number;
} & Omit<WorkoutInsertType, 'id'>;

export type UserInsertType = {
    activityLevel?: ActivityLevelType;
    birthday?: string;
    createdAt?: string;
    deletedAt?: string;
    fitnessGoals?: string;
    gender?: string;
    id?: number;
    liftingExperience?: ExperienceLevelType;
    name?: string;
};

export type UserReturnType = {
    id: number;
} & Omit<UserInsertType, 'id'>;

export type TotalMacrosType = {
    totalCalories: number;
    totalCarbs: number;
    totalFats: number;
    totalProteins: number;
    totalSaturatedFats: number;
    totalTransFats: number;
};

export type HealthDataType = {
    bodyFatRecords?: HealthConnectBodyFatRecordData[];
    heightRecords?: any[];
    latest: LatestHealthDataType;
    nutritionRecords?: NutritionType[];
    totalCaloriesBurnedRecords?: any[];
    weightRecords?: HealthConnectWeightRecord[];
};

export type LatestHealthDataType = {
    dataId?: string;
    date: string;
    fatPercentage?: number;
    height?: number;
    macros?: TotalMacrosType;
    totalCaloriesBurned?: number;
    weight?: number;
};

export type AggregatedUserMetricsNutritionType = {
    [key: string]: {
        totalCalories: number;
        totalCarbs: number;
        totalFats: number;
        totalProteins: number;
    } & UserMetricsInsertType;
};

export type UserMeasurementsInsertType = {
    createdAt?: string;
    dataId: string;
    date: string;
    deletedAt?: string;
    id?: number;
    measurements: Record<string, number>
    source: UserMetricSourceType;
    userId: number;
};

export type UserMeasurementsReturnType = {
    id: number;
} & Omit<UserMeasurementsInsertType, 'id'>;

export type UserMetricsInsertType = {
    createdAt?: string;
    dataId: string;
    // weightDataId: string;
    // bodyFatDataId: string;
    date: string;
    deletedAt?: string;
    eatingPhase?: EatingPhaseType;
    fatPercentage?: number;
    height?: number;
    id?: number;
    source: UserMetricSourceType;
    userId?: number;
    weight?: number;
};

export type UserMetricsEncryptedReturnType = {
    fatPercentage?: string;
    height?: string;
    id: number;
    weight?: string;
} & Omit<UserMetricsInsertType, 'fatPercentage' | 'height' | 'id' | 'weight'>;

export type UserMetricsDecryptedReturnType = {
    id: number;
} & Omit<UserMetricsInsertType, 'id'>;

export type MetricsForUserType = {
    latestId: number;
} & Omit<UserMetricsDecryptedReturnType, 'createdAt' | 'dataId' | 'deletedAt' | 'id' | 'userId'>;

export type UserWithMetricsType = {
    metrics: MetricsForUserType;
} & UserReturnType;

export type ChatInsertType = {
    createdAt?: string;
    deletedAt?: string;
    id?: number;
    message: string;
    misc?: any;
    sender: string;
    type: string;
};

export type ChatReturnType = {
    id: number;
} & Omit<ChatInsertType, 'id'>;

type WorkoutTypeWithOptionalExerciseIds = {} & Omit<WorkoutReturnType, 'volumeCalculationType'>;

export type WorkoutEventInsertType = {
    alcohol?: number;
    bodyWeight?: number;
    calories?: number;
    carbohydrate?: number;
    date: string;
    duration?: number;
    eatingPhase?: EatingPhaseType;
    exerciseData?: string;
    exhaustionLevel?: number;
    fat?: number;
    fatPercentage?: number;
    fiber?: number;
    id?: number;
    protein?: number;
    status: string;
    workoutId: number;
    workoutScore?: number;
    workoutVolume?: string;
} & Omit<WorkoutTypeWithOptionalExerciseIds, 'id'>;

export type WorkoutEventReturnType = {
    id: number;
} & Omit<WorkoutEventInsertType, 'id'>;

export type WorkoutExerciseInsertType = {
    createdAt?: string;
    deletedAt?: string;
    exerciseId: number;
    id?: number;
    order: number;
    setIds: number[];
    workoutId: number;
};

export type WorkoutExerciseReturnType = {
    id: number;
} & Omit<WorkoutExerciseInsertType, 'id'>;

export type UserNutritionInsertType = {
    alcohol?: number;
    calories: number;
    carbohydrate: number;
    createdAt?: string;
    dataId: string;
    date: string;
    deletedAt?: string;
    fat: number;
    fiber?: number;
    id?: number;
    monounsaturatedFat?: number;
    name: string;
    polyunsaturatedFat?: number;
    protein: number;
    saturatedFat?: number;
    source: UserMetricSourceType;
    sugar?: number;
    transFat?: number;
    type: UserNutritionTypeType;
    unsaturatedFat?: number;
    userId?: number;
};

export type UserNutritionEncryptedReturnType = {
    alcohol?: string;
    calories: string;
    carbohydrate: string;
    fat: string;
    fiber?: string;
    id: number;
    monounsaturatedFat?: string;
    polyunsaturatedFat?: string;
    protein: string;
    saturatedFat?: string;
    sugar?: string;
    transFat?: string;
    unsaturatedFat?: string;
} & Omit<UserNutritionInsertType, 'calories' | 'carbohydrate' | 'fat' | 'fiber' | 'id' | 'monounsaturatedFat' | 'polyunsaturatedFat' | 'protein' | 'saturatedFat' | 'sugar' | 'transFat' | 'unsaturatedFat'>;

export type UserNutritionDecryptedReturnType = {
    id: number;
} & Omit<UserNutritionInsertType, 'id'>;

export type SettingsInsertType = {
    createdAt?: string;
    deletedAt?: string;
    id?: number;
    type: string;
    value: string;
};

export type SettingsReturnType = {
    id: number;
} & Omit<SettingsInsertType, 'id'>;

export type BioInsertType = {
    createdAt?: string;
    deletedAt?: string;
    id?: number;
    value: string;
};

export type BioReturnType = {
    id: number;
} & Omit<BioInsertType, 'id'>;

export type OneRepMaxInsertType = {
    createdAt?: string;
    deletedAt?: string;
    exerciseId: number;
    id?: number;
    weight: number;
};

export type OneRepMaxReturnType = {
    id: number;
} & Omit<OneRepMaxInsertType, 'id'>;

export type WorkoutPlanExercise = {
    name: string;
    oneRepMaxPercentage?: number;
    reps?: number;
    restTime?: number;
    sets?: number;
};

export type WorkoutPlanWorkout = {
    description?: string;
    exercises: WorkoutPlanExercise[];
    title: string;
};

export type WorkoutPlan = {
    workoutPlan: WorkoutPlanWorkout[];
};

export type ParsedRecentWorkout = {
    date: string;
    description?: string;
    duration: string;
    exercises: ParsedExerciseTypeWithSets[];
    title: string;
};

export type ParsedPastNutrition = {
    alcohol?: number;
    amount_in_grams?: number;
    calories: number;
    carbs: number;
    cholesterol?: number;
    date: string;
    fat: number;
    fat_saturated?: number;
    fat_unsaturated?: number;
    fiber?: number;
    name?: string; // TODO: for now it only import as full_day
    potassium?: number;
    protein: number;
    sodium?: number;
    sugar?: number;
    type?: string;
};

export type ParsedUserMetrics = {
    date: string;
    fatPercentage?: number;
    height?: number;
    weight?: number;
};

export type ParsedExerciseTypeWithSets = {
    exerciseId?: number;
    muscleGroup: MuscleGroupType;
    name: string;
    sets: ({
        exerciseId?: number;
        setId?: number;
    } & Omit<ExerciseVolumeSetType, 'exerciseId' | 'setId'>)[];
    type: ExerciseTypesType;
};

export type ExerciseWithSetsType = ({ 
    sets: SetReturnType[];
} & ExerciseReturnType);

export type WorkoutWithExercisesRepsAndSetsDetailsInsertType = {
    description?: string;
    exercises: ExerciseWithSetsType[];
    title: string;
};

export type WorkoutWithExercisesRepsAndSetsDetailsReturnType = {
    id: number;
} & Omit<WorkoutWithExercisesRepsAndSetsDetailsInsertType, 'id'>;

export type NutritionType = RecordResult<'Nutrition'>;

export type ExerciseTypesType = typeof EXERCISE_TYPES[keyof typeof EXERCISE_TYPES];

export type MuscleGroupType = typeof MUSCLE_GROUPS[keyof typeof MUSCLE_GROUPS];

export type UserMetricSourceType = typeof USER_METRICS_SOURCES[keyof typeof USER_METRICS_SOURCES];

export type UserNutritionTypeType = typeof NUTRITION_TYPES[keyof typeof NUTRITION_TYPES];

export type EatingPhaseType = '' | typeof EATING_PHASES[keyof typeof EATING_PHASES];

export type ActivityLevelType = '' | typeof ACTIVITY_LEVELS[keyof typeof ACTIVITY_LEVELS];

export type ExperienceLevelType = '' | typeof EXPERIENCE_LEVELS[keyof typeof EXPERIENCE_LEVELS];

export type VolumeCalculationTypeType = '' | typeof VOLUME_CALCULATION_TYPES[keyof typeof VOLUME_CALCULATION_TYPES];

export interface HealthConnectMetadataType {
    clientRecordId: null | string;
    clientRecordVersion: number;
    dataOrigin: string;
    device: number;
    id: string;
    lastModifiedTime: string;
    recordingMethod: number;
}

export interface HealthConnectBodyFatRecordData {
    metadata: HealthConnectMetadataType;
    percentage: number;
    time: string;
}

export interface HealthConnectWeightRecord {
    metadata: HealthConnectMetadataType;
    time: string;
    weight: {
        inGrams: number;
        inKilograms: number;
        inMicrograms: number;
        inMilligrams: number;
        inOunces: number;
        inPounds: number;
    };
}

export interface HealthConnectHeightRecord {
    height: {
        inFeet: number;
        inInches: number;
        inKilometers: number;
        inMeters: number;
        inMiles: number;
    };
    metadata: HealthConnectMetadataType;
    time: string;
}

export interface Data {
    bodyFatRecords: HealthConnectBodyFatRecordData[];
    weightRecords: HealthConnectWeightRecord[];
}

export type NutritionStackedBarChartDataType = {
    date: string;
    marker: string | string[];
    totalCalories: string;
    x: number;
    y: number[];
};

export interface ExtendedLineChartDataType extends LineChartDataType {
    date: string;
}

export type LineChartDataType = {
    marker: string;
    x: number;
    y: number;
};
