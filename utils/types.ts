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
    completed: ExerciseProgressType[];
    skipped?: ExerciseProgressType[];
};

export type ExerciseProgressType = {
    difficultyLevel: number;
    exerciseId?: number;
    name: string;
    reps: number;
    restTime: number;
    setId: number;
    setIndex: number;
    setOrder: number;
    targetReps: number;
    targetWeight: number;
    weight: number;
    workoutDuration: number;
    supersetName?: string;
    isDropSet?: boolean;
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

export type NutritionGoalsInsertType = {
    createdAt?: string;
    deletedAt?: string;
    id?: number;
    calories: number;
    totalCarbohydrate: number;
    totalFat: number;
    protein: number;
    alcohol?: number;
    fiber?: number;
    sugar?: number;
};

export type NutritionGoalsReturnType = {
    id: number;
} & Omit<NutritionGoalsInsertType, 'id'>;

export type FoodInsertType = {
    createdAt?: string;
    deletedAt?: string;
    id?: number;
    dataId?: string;
    calories: number;
    totalCarbohydrate: number;
    totalFat: number;
    protein: number;
    alcohol?: number;
    fiber?: number;
    sugar?: number;
    name: string;
    brand?: string;
    productCode?: string;
    servingSize?: number;
    // these are not used yet
    zinc?: number;
    vitaminK?: number;
    vitaminC?: number;
    vitaminB12?: number;
    vitaminA?: number;
    unsaturatedFat?: number;
    vitaminE?: number;
    thiamin?: number;
    selenium?: number;
    polyunsaturatedFat?: number;
    vitaminB6?: number;
    pantothenicAcid?: number;
    niacin?: number;
    monounsaturatedFat?: number;
    calcium?: number;
    iodine?: number;
    molybdenum?: number;
    vitaminD?: number;
    manganese?: number;
    magnesium?: number;
    transFat?: number;
    folicAcid?: number;
    copper?: number;
    iron?: number;
    saturatedFat?: number;
    chromium?: number;
    caffeine?: number;
    cholesterol?: number;
    phosphorus?: number;
    chloride?: number;
    folate?: number;
    biotin?: number;
    sodium?: number;
    riboflavin?: number;
    potassium?: number;
};

export type FoodReturnType = {
    id: number;
} & Omit<FoodInsertType, 'id'>;

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

export type MusclogApiFoodInfoType = {
    ean?: string;
    brand?: string;
    productTitle: string;
    productImage?: string;
    basis?: number;
    kj?: number;
    kcal: number;
    fat: number;
    carbs: number;
    protein: number;
    sugars?: number;
    fiber?: number;
    salt?: number;
    saturatedFat?: number;
    unsaturatedFat?: number;
    polyUnsaturatedFat?: number;
    monoUnsaturatedFat?: number;
};

export type OpenFoodFactsApiNutritionType = {
    carbohydrates: number;
    carbohydrates_100g: number;
    carbohydrates_serving: number;
    carbohydrates_unit: string;
    carbohydrates_value: number;
    energy: number;
    'energy-kcal': number;
    'energy-kcal_100g': number;
    'energy-kcal_serving': number;
    'energy-kcal_unit': string;
    'energy-kcal_value': number;
    'energy-kcal_value_computed': number;
    'energy-kj': number;
    'energy-kj_100g': number;
    'energy-kj_serving': number;
    'energy-kj_unit': string;
    'energy-kj_value': number;
    'energy-kj_value_computed': number;
    energy_100g: number;
    energy_serving: number;
    energy_unit: string;
    energy_value: number;
    fat: number;
    fat_100g: number;
    fat_serving: number;
    fat_unit: string;
    fat_value: number;
    fiber: number;
    fiber_100g: number;
    fiber_serving: number;
    fiber_unit: string;
    fiber_value: number;
    'fruits-vegetables-legumes-estimate-from-ingredients_100g': number;
    'fruits-vegetables-legumes-estimate-from-ingredients_serving': number;
    'fruits-vegetables-nuts-estimate-from-ingredients_100g': number;
    'fruits-vegetables-nuts-estimate-from-ingredients_serving': number;
    'nova-group': number;
    'nova-group_100g': number;
    'nova-group_serving': number;
    'nutrition-score-fr': number;
    'nutrition-score-fr_100g': number;
    proteins: number;
    proteins_100g: number;
    proteins_serving: number;
    proteins_unit: string;
    proteins_value: number;
    salt: number;
    salt_100g: number;
    salt_serving: number;
    salt_unit: string;
    salt_value: number;
    'saturated-fat': number;
    'saturated-fat_100g': number;
    'saturated-fat_serving': number;
    'saturated-fat_unit': string;
    'saturated-fat_value': number;
    sodium: number;
    sodium_100g: number;
    sodium_serving: number;
    sodium_unit: string;
    sodium_value: number;
    sugars: number;
    sugars_100g: number;
    sugars_serving: number;
    sugars_unit: string;
    sugars_value: number;
};

export type OpenFoodFactsApiFoodInfoType = {
    code: string;
    errors: string[];
    product: {
        _id: string;
        _keywords: string[];
        added_countries_tags: string[];
        additives_n: number;
        additives_original_tags: string[];
        additives_tags: string[];
        allergens: string;
        allergens_from_ingredients: string;
        allergens_from_user: string;
        allergens_hierarchy: string[];
        allergens_lc: string;
        allergens_tags: string[];
        amino_acids_tags: string[];
        brands: string;
        brands_tags: string[];
        categories: string;
        categories_hierarchy: string[];
        categories_lc: string;
        categories_old: string;
        categories_properties: Record<string, string>;
        categories_properties_tags: string[];
        categories_tags: string[];
        checkers_tags: string[];
        cities_tags: string[];
        code: string;
        codes_tags: string[];
        compared_to_category: string;
        complete: number;
        completeness: number;
        correctors_tags: string[];
        countries: string;
        countries_hierarchy: string[];
        countries_lc: string;
        countries_tags: string[];
        created_t: number;
        creator: string;
        data_quality_bugs_tags: string[];
        data_quality_errors_tags: string[];
        data_quality_info_tags: string[];
        data_quality_tags: string[];
        data_quality_warnings_tags: string[];
        data_sources: string;
        data_sources_tags: string[];
        debug_param_sorted_langs: string[];
        ecoscore_data: {
            adjustments: {
                origins_of_ingredients: {
                    aggregated_origins: {
                        epi_score: number;
                        origin: string;
                        percent: number;
                        transportation_score: number;
                    }[];
                    epi_score: number;
                    epi_value: number;
                    origins_from_categories: string[];
                    origins_from_origins_field: string[];
                    transportation_score: number;
                    transportation_scores: Record<string, number>;
                    transportation_value: number;
                    transportation_values: Record<string, number>;
                    value: number;
                    values: Record<string, number>;
                    warning: string;
                };
                packaging: {
                    value: number;
                    warning: string;
                };
                production_system: {
                    labels: string[];
                    value: number;
                    warning: string;
                };
                threatened_species: Record<string, unknown>;
            };
            ecoscore_not_applicable_for_category: string;
            missing: {
                labels: number;
                origins: number;
                packagings: number;
            };
            missing_key_data: number;
            scores: Record<string, unknown>;
            status: string;
        };
        ecoscore_grade: string;
        ecoscore_tags: string[];
        editors_tags: string[];
        emb_codes: string;
        emb_codes_tags: string[];
        entry_dates_tags: string[];
        expiration_date: string;
        food_groups: string;
        food_groups_tags: string[];
        generic_name: string;
        generic_name_fr: string;
        id: string;
        image_front_small_url: string;
        image_front_thumb_url: string;
        image_front_url: string;
        images: Record<string, {
            sizes: {
                '100': { h: number; w: number };
                '400': { h: number; w: number };
                full: { h: number; w: number };
            };
            uploaded_t: number;
            uploader: string;
        }>;
        ingredients: {
            ciqual_proxy_food_code?: string;
            ecobalyse_code?: string;
            id: string;
            is_in_taxonomy: number;
            percent_estimate: number;
            percent_max: number | string;
            percent_min: number;
            text: string;
            vegan: string;
            vegetarian: string;
            ingredients?: {
                id: string;
                is_in_taxonomy: number;
                percent_estimate: number;
                percent_max: number;
                percent_min: number;
                text: string;
                vegan: string;
                vegetarian: string;
            }[];
        }[];
        ingredients_analysis_tags: string[];
        ingredients_text: string;
        ingredients_text_fr: string;
        ingredients_text_nl: string;
        ingredients_text_with_allergens: string;
        ingredients_text_with_allergens_fr: string;
        ingredients_text_with_allergens_nl: string;
        known_ingredients_n: number;
        labels: string;
        labels_tags: string[];
        lang: string;
        languages_tags: string[];
        last_edit_dates_tags: string[];
        last_editor: string;
        last_image_dates_tags: string[];
        last_image_t: number;
        last_modified_by: string;
        last_modified_t: number;
        last_updated_t: number;
        lc: string;
        link: string;
        max_imgid: string;
        misc_tags: string[];
        nutrient_levels: Record<string, string>;
        nutriments: OpenFoodFactsApiNutritionType;
        nutriscore: Record<string, Record<string, unknown>>;
        nutriscore_grade: string;
        nutriscore_score: number;
        nutrition_data: string;
        nutrition_data_per: string;
        origin: string;
        origins_hierarchy: string[];
        packaging: string;
        packaging_tags: string[];
        photographers_tags: string[];
        product_name: string;
        product_quantity: string;
        quantity: string;
        scans_n: number;
        selected_images: {
            front: {
                display: Record<string, string>;
                small: Record<string, string>;
                thumb: Record<string, string>;
            };
            ingredients: {
                display: Record<string, string>;
                small: Record<string, string>;
                thumb: Record<string, string>;
            };
            nutrition: {
                display: Record<string, string>;
                small: Record<string, string>;
                thumb: Record<string, string>;
            };
        };
        states: string;
        status: string;
        warnings: string[];
    };
};

export type PaginatedOpenFoodFactsApiFoodProductInfoType = {
    _id: string;
    _keywords: string[];
    added_countries_tags: string[];
    additives_n: number;
    additives_original_tags: string[];
    additives_tags: string[];
    allergens: string;
    allergens_from_ingredients: string;
    allergens_from_user: string;
    allergens_hierarchy: string[];
    allergens_lc: string;
    allergens_tags: string[];
    amino_acids_prev_tags: string[];
    amino_acids_tags: string[];
    brands: string;
    brands_tags: string[];
    categories: string;
    categories_hierarchy: string[];
    categories_lc: string;
    categories_old: string;
    categories_properties: Record<string, string>;
    categories_properties_tags: string[];
    categories_tags: string[];
    category_properties: Record<string, string>;
    checkers_tags: string[];
    ciqual_food_name_tags: string[];
    cities_tags: string[];
    code: string;
    codes_tags: string[];
    compared_to_category: string;
    complete: number;
    completeness: number;
    correctors_tags: string[];
    countries: string;
    countries_beforescanbot: string;
    countries_hierarchy: string[];
    countries_lc: string;
    countries_tags: string[];
    created_t: number;
    creator: string;
    data_quality_bugs_tags: string[];
    data_quality_errors_tags: string[];
    data_quality_info_tags: string[];
    data_quality_tags: string[];
    data_quality_warnings_tags: string[];
    data_sources: string;
    data_sources_tags: string[];
    debug_param_sorted_langs: string[];
    ecoscore_data: {
        adjustments: {
            origins_of_ingredients: {
                aggregated_origins: {
                    epi_score: string | number;
                    origin: string;
                    percent: number;
                    transportation_score: number;
                }[];
                epi_score: number;
                epi_value: number;
                origins_from_categories: string[];
                origins_from_origins_field: string[];
                transportation_score: number;
                transportation_scores: Record<string, number>;
                transportation_value: number;
                transportation_values: Record<string, number>;
                value: number;
                values: Record<string, number>;
                warning: string;
            };
            packaging: {
                non_recyclable_and_non_biodegradable_materials: number;
                packagings: {
                    ecoscore_material_score: number;
                    ecoscore_shape_ratio: number;
                    material: string;
                    number_of_units: number;
                    quantity_per_unit: string;
                    quantity_per_unit_unit: string;
                    quantity_per_unit_value: number;
                    recycling: string;
                    shape: string;
                    weight_measured: number;
                }[];
                score: number;
                value: number;
            };
            production_system: {
                labels: string[];
                value: number;
                warning: string;
            };
            threatened_species: Record<string, unknown>;
        };
        ecoscore_not_applicable_for_category: string;
        missing: {
            labels: number;
            origins: number;
        };
        scores: Record<string, unknown>;
        status: string;
    };
    ecoscore_extended_data: {
        error: string;
    };
    ecoscore_extended_data_version: string;
    ecoscore_grade: string;
    ecoscore_tags: string[];
    editors_tags: string[];
    emb_codes: string;
    emb_codes_20141016: string;
    emb_codes_orig: string;
    emb_codes_tags: string[];
    entry_dates_tags: string[];
    environment_impact_level: string;
    environment_impact_level_tags: string[];
    expiration_date: string;
    food_groups: string;
    food_groups_tags: string[];
    fruits_vegetables_nuts_100g_estimate: number;
    generic_name: string;
    generic_name_de: string;
    generic_name_en: string;
    generic_name_es: string;
    generic_name_fr: string;
    generic_name_it: string;
    generic_name_sr: string;
    id: string;
    image_front_small_url: string;
    image_front_thumb_url: string;
    image_front_url: string;
    image_small_url: string;
    image_thumb_url: string;
    image_url: string;
    images: Record<string, { sizes: { '100': { h: number; w: number }; '400': { h: number; w: number }; full: { h: number; w: number } }; uploaded_t: string; uploader: string }>;
    informers_tags: string[];
    ingredients: {
        ciqual_food_code?: string;
        has_sub_ingredients?: string;
        id: string;
        is_in_taxonomy: number;
        percent_estimate: number;
        percent_max: number | string;
        percent_min: number;
        rank?: number;
        text: string;
        vegan?: string;
        vegetarian?: string;
    }[];
    ingredients_analysis: Record<string, unknown>;
    ingredients_analysis_tags: string[];
    ingredients_debug: (string | null)[];
    ingredients_from_or_that_may_be_from_palm_oil_n: number;
    ingredients_from_palm_oil_n: number;
    ingredients_from_palm_oil_tags: string[];
    ingredients_hierarchy: string[];
    ingredients_ids_debug: string[];
    ingredients_lc: string;
    ingredients_n: number;
    ingredients_n_tags: string[];
    ingredients_non_nutritive_sweeteners_n: number;
    ingredients_original_tags: string[];
    ingredients_percent_analysis: number;
    ingredients_sweeteners_n: number;
    ingredients_tags: string[];
    ingredients_text: string;
    ingredients_text_de: string;
    ingredients_text_debug: string;
    ingredients_text_en: string;
    ingredients_text_es: string;
    ingredients_text_fr: string;
    ingredients_text_it: string;
    ingredients_text_sr: string;
    ingredients_text_with_allergens: string;
    ingredients_text_with_allergens_de: string;
    ingredients_text_with_allergens_en: string;
    ingredients_text_with_allergens_es: string;
    ingredients_text_with_allergens_fr: string;
    ingredients_text_with_allergens_it: string;
    ingredients_text_with_allergens_sr: string;
    ingredients_that_may_be_from_palm_oil_n: number;
    ingredients_that_may_be_from_palm_oil_tags: string[];
    ingredients_with_specified_percent_n: number;
    ingredients_with_specified_percent_sum: number;
    ingredients_with_unspecified_percent_n: number;
    ingredients_with_unspecified_percent_sum: number;
    ingredients_without_ciqual_codes: string[];
    ingredients_without_ciqual_codes_n: number;
    interface_version_created: string;
    interface_version_modified: string;
    known_ingredients_n: number;
    labels: string;
    labels_hierarchy: string[];
    labels_lc: string;
    labels_old: string;
    labels_tags: string[];
    lang: string;
    languages: Record<string, number>;
    languages_codes: Record<string, number>;
    languages_hierarchy: string[];
    languages_tags: string[];
    last_edit_dates_tags: string[];
    last_editor: string;
    last_image_dates_tags: string[];
    last_image_t: number;
    last_modified_by: string;
    last_modified_t: number;
    last_updated_t: number;
    lc: string;
    link: string;
    main_countries_tags: string[];
    manufacturing_places: string;
    manufacturing_places_tags: string[];
    max_imgid: string;
    minerals_prev_tags: string[];
    minerals_tags: string[];
    misc_tags: string[];
    no_nutrition_data: string;
    nova_group: number;
    nova_group_debug: string;
    nova_groups: string;
    nova_groups_markers: Record<string, [string, string][]>;
    nova_groups_tags: string[];
    nucleotides_prev_tags: string[];
    nucleotides_tags: string[];
    nutrient_levels: Record<string, string>;
    nutrient_levels_tags: string[];
    nutriments: OpenFoodFactsApiNutritionType;
    nutriscore: Record<string, Record<string, unknown>>;
    nutriscore_2021_tags: string[];
    nutriscore_2023_tags: string[];
    nutriscore_data: Record<string, unknown>;
    nutriscore_grade: string;
    nutriscore_score: number;
    nutriscore_score_opposite: number;
    nutriscore_tags: string[];
    nutriscore_version: string;
    nutrition_data: string;
    nutrition_data_per: string;
    nutrition_data_prepared: string;
    nutrition_data_prepared_per: string;
    nutrition_grade_fr: string;
    nutrition_grades: string;
    nutrition_grades_tags: string[];
    nutrition_score_beverage: number;
    nutrition_score_debug: string;
    nutrition_score_warning_fruits_vegetables_legumes_estimate_from_ingredients: number;
    nutrition_score_warning_fruits_vegetables_legumes_estimate_from_ingredients_value: number;
    nutrition_score_warning_fruits_vegetables_nuts_estimate_from_ingredients: number;
    nutrition_score_warning_fruits_vegetables_nuts_estimate_from_ingredients_value: number;
    obsolete: string;
    obsolete_since_date: string;
    origin: string;
    origin_de: string;
    origin_en: string;
    origin_es: string;
    origin_fr: string;
    origin_it: string;
    origin_sr: string;
    origins: string;
    origins_hierarchy: string[];
    origins_lc: string;
    origins_old: string;
    origins_tags: string[];
    other_nutritional_substances_tags: string[];
    packaging: string;
    packaging_hierarchy: string[];
    packaging_lc: string;
    packaging_materials_tags: string[];
    packaging_old: string;
    packaging_old_before_taxonomization: string;
    packaging_recycling_tags: string[];
    packaging_shapes_tags: string[];
    packaging_tags: string[];
    packaging_text: string;
    packaging_text_de: string;
    packaging_text_en: string;
    packaging_text_es: string;
    packaging_text_fr: string;
    packaging_text_it: string;
    packaging_text_sr: string;
    packagings: {
        material: string;
        number_of_units: number;
        quantity_per_unit: string;
        quantity_per_unit_unit: string;
        quantity_per_unit_value: number;
        recycling: string;
        shape: string;
        weight_measured: number;
    }[];
    packagings_complete: number;
    packagings_materials: Record<string, { weight: number; weight_100g: number; weight_percent: number }>;
    packagings_materials_main: string;
    packagings_n: number;
    photographers_tags: string[];
    pnns_groups_1: string;
    pnns_groups_1_tags: string[];
    pnns_groups_2: string;
    pnns_groups_2_tags: string[];
    popularity_key: number;
    popularity_tags: string[];
    product_name: string;
    product_name_de: string;
    product_name_en: string;
    product_name_es: string;
    product_name_fr: string;
    product_name_it: string;
    product_name_sr: string;
    product_quantity: string;
    product_quantity_unit: string;
    product_type: string;
    purchase_places: string;
    purchase_places_tags: string[];
    quantity: string;
    removed_countries_tags: string[];
    rev: number;
    scans_n: number;
    selected_images: {
        front: {
            display: Record<string, string>;
            small: Record<string, string>;
            thumb: Record<string, string>;
        };
    };
    serving_quantity: string;
    serving_quantity_unit: string;
    serving_size: string;
    sortkey: number;
    states: string;
    states_hierarchy: string[];
    states_tags: string[];
    stores: string;
    stores_tags: string[];
    teams: string;
    teams_tags: string[];
    traces: string;
    traces_from_ingredients: string;
    traces_from_user: string;
    traces_hierarchy: string[];
    traces_lc: string;
    traces_tags: string[];
    unique_scans_n: number;
    unknown_ingredients_n: number;
    unknown_nutrients_tags: string[];
    update_key: string;
    url: string;
    vitamins_prev_tags: string[];
    vitamins_tags: string[];
    weighers_tags: string[];
    with_non_nutritive_sweeteners: number;
};

export type PaginatedOpenFoodFactsApiFoodInfoType = {
    count: number;
    page: number;
    page_count: number;
    page_size: number;
    products: PaginatedOpenFoodFactsApiFoodProductInfoType[];
    skip: number;
};
