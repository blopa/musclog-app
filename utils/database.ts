import type { DatabaseChangeEvent, SQLiteDatabase } from 'expo-sqlite';

import { VOLUME_CALCULATION_TYPES } from '@/constants/exercises';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { EATING_PHASES, NUTRITION_TYPES } from '@/constants/nutrition';
import { COMPLETED_STATUS, GEMINI_API_KEY_TYPE, OPENAI_API_KEY_TYPE, SCHEDULED_STATUS } from '@/constants/storage';
import packageJson from '@/package.json';
import { getCommonFunctions } from '@/utils/databaseCommon';
import {
    getCurrentTimestampISOString,
    getEndOfDayTimestampISOString,
    getStartOfDayTimestampISOString,
} from '@/utils/date';
import { decrypt, decryptDatabaseValue, encrypt, encryptDatabaseValue } from '@/utils/encryption';
import { generateHash, normalizeName } from '@/utils/string';
import {
    BioReturnType,
    ChatInsertType,
    ChatReturnType,
    ExerciseInsertType,
    ExerciseReturnType,
    ExerciseVolumeType,
    ExerciseWithSetsType,
    FitnessGoalsInsertType,
    FitnessGoalsReturnType,
    FoodInsertType,
    FoodReturnType,
    MetricsForUserType,
    MigrationReturnType,
    OneRepMaxReturnType,
    SetInsertType,
    SetReturnType,
    SettingsInsertType,
    SettingsReturnType,
    UserInsertType,
    UserMeasurementsInsertType,
    UserMeasurementsReturnType,
    UserMetricsDecryptedReturnType,
    UserMetricsEncryptedReturnType,
    UserMetricsInsertType,
    UserNutritionDecryptedReturnType,
    UserNutritionEncryptedReturnType,
    UserNutritionInsertType,
    UserReturnType,
    UserWithMetricsType,
    VersioningReturnType,
    WorkoutEventInsertType,
    WorkoutEventReturnType,
    WorkoutInsertType,
    WorkoutPlan,
    WorkoutReturnType,
    WorkoutWithExercisesRepsAndSetsDetailsReturnType,
} from '@/utils/types';
import { addDatabaseChangeListener, openDatabaseSync } from 'expo-sqlite';

const createTables = (database: SQLiteDatabase) => {
    const tables = [{
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'name' TEXT",
            "'muscleGroup' TEXT",
            "'type' TEXT",
            "'description' TEXT",
            "'image' TEXT NULLABLE",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT NULLABLE",
        ],
        name: 'Exercise',
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'dataId' TEXT",
            "'name' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT NULLABLE",
            "'alcohol' REAL",
            "'protein' REAL",
            "'totalCarbohydrate' REAL",
            "'totalFat' REAL",
            "'fiber' REAL",
            "'calories' REAL",
            "'sugar' REAL",
            "'servingSize' REAL",
            "'brand' TEXT NULLABLE",
            "'productCode' TEXT NULLABLE",
            // these are not used yet
            "'zinc' REAL NULLABLE DEFAULT 0",
            "'vitaminK' REAL NULLABLE DEFAULT 0",
            "'vitaminC' REAL NULLABLE DEFAULT 0",
            "'vitaminB12' REAL NULLABLE DEFAULT 0",
            "'vitaminA' REAL NULLABLE DEFAULT 0",
            "'unsaturatedFat' REAL NULLABLE DEFAULT 0",
            "'vitaminE' REAL NULLABLE DEFAULT 0",
            "'thiamin' REAL NULLABLE DEFAULT 0",
            "'selenium' REAL NULLABLE DEFAULT 0",
            "'polyunsaturatedFat' REAL NULLABLE DEFAULT 0",
            "'vitaminB6' REAL NULLABLE DEFAULT 0",
            "'pantothenicAcid' REAL NULLABLE DEFAULT 0",
            "'niacin' REAL NULLABLE DEFAULT 0",
            "'monounsaturatedFat' REAL NULLABLE DEFAULT 0",
            "'calcium' REAL NULLABLE DEFAULT 0",
            "'iodine' REAL NULLABLE DEFAULT 0",
            "'molybdenum' REAL NULLABLE DEFAULT 0",
            "'vitaminD' REAL NULLABLE DEFAULT 0",
            "'manganese' REAL NULLABLE DEFAULT 0",
            "'magnesium' REAL NULLABLE DEFAULT 0",
            "'transFat' REAL NULLABLE DEFAULT 0",
            "'folicAcid' REAL NULLABLE DEFAULT 0",
            "'copper' REAL NULLABLE DEFAULT 0",
            "'iron' REAL NULLABLE DEFAULT 0",
            "'saturatedFat' REAL NULLABLE DEFAULT 0",
            "'chromium' REAL NULLABLE DEFAULT 0",
            "'caffeine' REAL NULLABLE DEFAULT 0",
            "'cholesterol' REAL NULLABLE DEFAULT 0",
            "'phosphorus' REAL NULLABLE DEFAULT 0",
            "'chloride' REAL NULLABLE DEFAULT 0",
            "'folate' REAL NULLABLE DEFAULT 0",
            "'biotin' REAL NULLABLE DEFAULT 0",
            "'sodium' REAL NULLABLE DEFAULT 0",
            "'riboflavin' REAL NULLABLE DEFAULT 0",
            "'potassium' REAL NULLABLE DEFAULT 0",
            "'isFavorite' INTEGER DEFAULT 0",
        ],
        name: 'Food',
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'calories' REAL",
            "'protein' REAL",
            "'alcohol' REAL",
            "'totalCarbohydrate' REAL",
            "'sugar' REAL",
            "'fiber' REAL",
            "'totalFat' REAL",
            "'weight' REAL",
            "'bodyFat' REAL",
            "'bmi' REAL",
            "'ffmi' REAL",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT NULLABLE",
        ],
        name: 'FitnessGoals',
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'reps' INTEGER",
            "'weight' INTEGER",
            "'restTime' INTEGER",
            "'exerciseId' INTEGER",
            "'workoutId' INTEGER DEFAULT 0",
            "'setOrder' INTEGER DEFAULT 0",
            "'supersetName' TEXT DEFAULT \"\"",
            "'difficultyLevel' INTEGER",
            "'isDropSet' INTEGER",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT NULLABLE",
        ],
        name: 'Set',
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'title' TEXT",
            "'description' TEXT",
            "'volumeCalculationType' TEXT",
            "'recurringOnWeek' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT NULLABLE",
        ],
        name: 'Workout',
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'name' TEXT",
            "'birthday' TEXT",
            "'fitnessGoals' TEXT",
            "'activityLevel' TEXT",
            "'liftingExperience' TEXT",
            "'gender' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT NULLABLE",
        ],
        name: 'User',
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'message' TEXT",
            "'sender' TEXT",
            "'misc' TEXT",
            "'type' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT NULLABLE",
        ],
        name: 'Chat',
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'date' TEXT",
            "'duration' INTEGER",
            "'bodyWeight' TEXT",
            "'exhaustionLevel' INTEGER",
            "'workoutScore' INTEGER",
            "'workoutVolume' TEXT",
            "'fatPercentage' TEXT",
            "'eatingPhase' TEXT NULLABLE",
            "'workoutId' INTEGER",
            "'title' TEXT",
            "'status' TEXT",
            "'exerciseData' TEXT",
            "'recurringOnWeek' TEXT",
            "'description' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT NULLABLE",
            "'alcohol' REAL DEFAULT 0",
            "'protein' REAL DEFAULT 0",
            "'carbohydrate' REAL DEFAULT 0",
            "'fat' REAL DEFAULT 0",
            "'fiber' REAL DEFAULT 0",
            "'calories' REAL DEFAULT 0",
        ],
        name: 'WorkoutEvent',
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'type' TEXT",
            "'value' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT NULLABLE",
        ],
        name: 'Setting',
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'value' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT NULLABLE",
        ],
        name: 'Bio',
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'version' INTEGER",
        ],
        name: 'Versioning',
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'dataId' TEXT",
            "'measurements' TEXT",
            "'userId' INTEGER",
            "'date' TEXT",
            "'source' TEXT NULLABLE",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT NULLABLE",
        ],
        name: 'UserMeasurements',
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'exerciseId' INTEGER",
            "'weight' INTEGER",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT NULLABLE",
        ],
        name: 'OneRepMax',
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'migration' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT NULLABLE",
        ],
        name: 'Migrations',
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'userId' INTEGER",
            "'weight' TEXT NULLABLE",
            "'height' TEXT NULLABLE",
            "'fatPercentage' TEXT NULLABLE",
            "'eatingPhase' TEXT NULLABLE",
            "'dataId' TEXT",
            "'date' TEXT",
            "'source' TEXT NULLABLE",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT NULLABLE",
        ],
        name: 'UserMetrics',
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'userId' INTEGER",
            "'name' TEXT",
            "'calories' TEXT",
            "'alcohol' TEXT NULLABLE",
            "'protein' TEXT",
            "'carbohydrate' TEXT",
            "'sugar' TEXT",
            "'fiber' TEXT",
            "'fat' TEXT",
            "'monounsaturatedFat' TEXT",
            "'polyunsaturatedFat' TEXT",
            "'saturatedFat' TEXT",
            "'transFat' TEXT",
            "'unsaturatedFat' TEXT",
            "'dataId' TEXT",
            "'type' TEXT",
            "'mealType' TEXT NULLABLE",
            "'grams' TEXT NULLABLE",
            "'source' TEXT",
            "'date' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT NULLABLE",
        ],
        name: 'UserNutrition',
    }];

    const createTableStatements = tables.map(
        (table) => `CREATE TABLE IF NOT EXISTS '${table.name}' (${table.columns.join(', ')});`
    ).join('\n');

    database.execSync([
        'PRAGMA journal_mode = WAL;',
        createTableStatements,
    ].join('\n'));
};

const database = openDatabaseSync('workoutLoggerDatabase.db', {
    enableChangeListener: true,
    useNewConnection: true,
});

createTables(database);

export const listenToDatabaseChanges = (callback: (event: DatabaseChangeEvent) => void) => {
    return addDatabaseChangeListener(callback);
};

// Create functions

export const addUserMeasurements = async (userMeasurements: UserMeasurementsInsertType): Promise<number> => {
    const createdAt = userMeasurements.createdAt || getCurrentTimestampISOString();
    try {
        const result = database.runSync(`
            INSERT INTO "UserMeasurements" ("userId", "dataId", "date", "measurements", "source", "createdAt")
            VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
            userMeasurements.userId,
            userMeasurements.dataId,
            userMeasurements.date,
            JSON.stringify(userMeasurements.measurements),
            userMeasurements.source || USER_METRICS_SOURCES.USER_INPUT,
            createdAt,
        ]);

        return result.lastInsertRowId;
    } catch (error) {
        throw error;
    }
};

export const addVersioning = async (version: string): Promise<number> => {
    try {
        const existingVersion = await getVersioningByVersion(version);

        if (existingVersion) {
            return existingVersion.id;
        } else {
            const result = database.runSync(
                'INSERT INTO "Versioning" ("version") VALUES (?)',
                [version]
            );

            return result.lastInsertRowId;
        }
    } catch (error) {
        throw error;
    }
};

export const addWorkout = async (workout: WorkoutInsertType): Promise<number> => {
    const createdAt = workout.createdAt || getCurrentTimestampISOString();
    try {
        const result = database.runSync(
            'INSERT INTO "Workout" ("title", "recurringOnWeek", "volumeCalculationType", "description", "createdAt") VALUES (?, ?, ?, ?, ?)',
            [
                workout.title,
                (workout.recurringOnWeek || ''),
                workout.volumeCalculationType,
                (workout.description || ''),
                createdAt,
            ]
        );

        return result.lastInsertRowId;
    } catch (error) {
        throw error;
    }
};

export const addWorkoutEvent = async (workoutEvent: WorkoutEventInsertType): Promise<number> => {
    const createdAt = workoutEvent.createdAt || getCurrentTimestampISOString();
    const user = await getUser();
    let exerciseData = workoutEvent.exerciseData || '[]';

    if (workoutEvent.status === COMPLETED_STATUS && !workoutEvent.exerciseData) {
        const exercisesWithSets = await getExercisesWithSetsFromWorkout(workoutEvent.workoutId);
        exerciseData = JSON.stringify(exercisesWithSets.map((exercisesWithSet) => {
            return {
                exerciseId: exercisesWithSet.id,
                sets: exercisesWithSet.sets.map((set) => {
                    return {
                        difficultyLevel: set.difficultyLevel,
                        id: set.id,
                        isDropSet: set.isDropSet,
                        reps: set.reps,
                        restTime: set.restTime,
                        setId: set.id,
                        weight: set.weight,
                        // setOrder: set.setOrder, // TODO not needed?
                    } as Omit<SetReturnType, 'exerciseId' | 'setOrder' | 'supersetName' | 'workoutId'>;
                }),
                workoutId: workoutEvent.workoutId,
            };
        }));
    }

    try {
        const result = database.runSync(`
            INSERT INTO "WorkoutEvent" ("date", "duration", "bodyWeight", "fatPercentage", "eatingPhase", "workoutId", "title", "status", "exerciseData", "exhaustionLevel", "workoutScore", "createdAt", "workoutVolume", "recurringOnWeek", "calories", "carbohydrate", "fat", "protein", "alcohol", "fiber")
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            workoutEvent.date,
            workoutEvent?.duration || 0,
            user?.metrics.weight || 0,
            user?.metrics.fatPercentage || 0,
            user?.metrics.eatingPhase || EATING_PHASES.MAINTENANCE,
            workoutEvent.workoutId,
            workoutEvent.title,
            workoutEvent.status,
            exerciseData,
            workoutEvent.exhaustionLevel || 5,
            workoutEvent.workoutScore || 5,
            createdAt,
            workoutEvent.workoutVolume || '',
            workoutEvent.recurringOnWeek || '',
            workoutEvent.calories || 0,
            workoutEvent.carbohydrate || 0,
            workoutEvent.fat || 0,
            workoutEvent.protein || 0,
            workoutEvent.alcohol || 0,
            workoutEvent.fiber || 0,
        ]);

        return result.lastInsertRowId;
    } catch (error) {
        throw error;
    }
};

export const addOneRepMax = async (exerciseId: number, weight: number, createdAt?: string): Promise<number> => {
    const createdTimestamp = createdAt || getCurrentTimestampISOString();
    try {
        const result = database.runSync(
            'INSERT INTO "OneRepMax" ("exerciseId", "weight", "createdAt") VALUES (?, ?, ?)',
            [exerciseId, weight, createdTimestamp]
        );

        return result.lastInsertRowId;
    } catch (error) {
        console.error('Error inserting OneRepMax', error);
        throw error;
    }
};

export const addBio = async (value: string, createdAt?: string): Promise<number> => {
    const createdTimestamp = createdAt || getCurrentTimestampISOString();
    try {
        const result = database.runSync(
            'INSERT INTO "Bio" ("value", "createdAt") VALUES (?, ?)',
            [value, createdTimestamp]
        );

        return result.lastInsertRowId;
    } catch (error) {
        throw error;
    }
};

export const addOrUpdateSetting = async (setting: SettingsInsertType): Promise<number> => {
    const existingSetting = await getSetting(setting.type);

    if (existingSetting) {
        return updateSetting(existingSetting.id!, setting.value);
    }

    return addSetting(setting.type, setting.value);
};

export const addSetting = async (type: string, value: string, createdAt?: string): Promise<number> => {
    const createdTimestamp = createdAt || getCurrentTimestampISOString();
    try {
        const result = database.runSync(
            'INSERT INTO "Setting" ("type", "value", "createdAt") VALUES (?, ?, ?)',
            [type, value, createdTimestamp]
        );

        return result.lastInsertRowId;
    } catch (error) {
        throw error;
    }
};

export const addExercise = async (exercise: ExerciseInsertType): Promise<number> => {
    const createdAt = exercise.createdAt || getCurrentTimestampISOString();
    const result = database.runSync(
        'INSERT INTO "Exercise" ("name", "muscleGroup", "type", "description", "image", "createdAt") VALUES (?, ?, ?, ?, ?, ?)',
        [exercise.name, exercise?.muscleGroup || '', exercise?.type || '', exercise?.description || '', exercise?.image || '', createdAt]
    );

    return result.lastInsertRowId;
};

export const addSet = async (set: SetInsertType): Promise<number> => {
    const createdAt = set.createdAt || getCurrentTimestampISOString();
    const result = database.runSync(
        'INSERT INTO "Set" ("reps", "weight", "restTime", "exerciseId", "isDropSet", "difficultyLevel", "workoutId", "setOrder", "supersetName", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [set.reps, set.weight, set.restTime, set.exerciseId, set.isDropSet ? 1 : 0, set.difficultyLevel || 5, set.workoutId, set.setOrder, set.supersetName || '', createdAt]
    );

    return result.lastInsertRowId;
};

export const addOrUpdateUser = async (user: UserInsertType, userMetrics?: UserMetricsInsertType): Promise<number> => {
    const existingUser = await getUser();
    if (existingUser) {
        await updateUser(existingUser.id, {
            ...existingUser,
            ...user,
        });

        if (userMetrics) {
            await addUserMetrics({ ...userMetrics, userId: existingUser.id! });
        }

        return existingUser.id!;
    }

    return addUser(user, userMetrics);
};

const addUser = async (user: UserInsertType, userMetrics?: UserMetricsInsertType): Promise<number> => {
    const createdAt = user.createdAt || getCurrentTimestampISOString();
    try {
        const userResult = database.runSync(`
            INSERT INTO "User" ("name", "birthday", "fitnessGoals", "activityLevel", "gender", "liftingExperience", "createdAt")
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
            user?.name || '',
            user?.birthday || '',
            user?.fitnessGoals || '',
            user?.activityLevel || '',
            user?.gender || '',
            user?.liftingExperience || '',
            createdAt,
        ]
        );

        const userId = userResult.lastInsertRowId;
        if (userMetrics) {
            await addUserMetrics({ ...userMetrics, userId });
        }

        return userId;
    } catch (error) {
        throw error;
    }
};

export const addUserMetrics = async (
    userMetrics: UserMetricsInsertType
): Promise<number> => {
    const createdAt = userMetrics.createdAt || getCurrentTimestampISOString();
    let { userId } = userMetrics;

    try {
        if (userMetrics.dataId) {
            const existingUserMetrics = await getUserMetricsByDataId(userMetrics.dataId);

            if (existingUserMetrics) {
                return await updateUserMetrics(existingUserMetrics.id, {
                    ...userMetrics,
                    createdAt: existingUserMetrics.createdAt,
                    id: existingUserMetrics.id,
                });
            }
        }

        if (!userId) {
            const user = await getLatestUser();
            if (!user) {
                throw new Error('No user found to add metrics to');
            }

            userId = user.id!;
        }

        const result = database.runSync(`
            INSERT INTO "UserMetrics" ("userId", "weight", "height", "fatPercentage", "eatingPhase", "dataId", "createdAt", "date", "source")
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            userId,
            await encryptDatabaseValue(userMetrics.weight?.toString() || ''),
            await encryptDatabaseValue(userMetrics.height?.toString() || ''),
            await encryptDatabaseValue(userMetrics.fatPercentage?.toString() || ''),
            userMetrics.eatingPhase || EATING_PHASES.MAINTENANCE,
            userMetrics.dataId || generateHash(),
            createdAt,
            userMetrics.date || createdAt,
            userMetrics.source || USER_METRICS_SOURCES.USER_INPUT,
        ]
        );

        return result.lastInsertRowId;
    } catch (error) {
        console.error('Error in addUserMetrics:', error);
        throw new Error('Failed to add or update user metrics');
    }
};

const addChatRaw = async (chat: ChatInsertType): Promise<number> => {
    const createdAt = chat.createdAt || getCurrentTimestampISOString();
    try {
        const result = database.runSync(`
            INSERT INTO "Chat" ("message", "sender", "misc", "type", "createdAt")
            VALUES (?, ?, ?, ?, ?)
        `,
        [
            chat.message,
            chat.sender,
            chat.misc,
            chat.type,
            createdAt,
        ]
        );

        return result.lastInsertRowId;
    } catch (error) {
        throw error;
    }
};

export const addUserNutritions = async (userNutritions: UserNutritionInsertType[]): Promise<boolean> => {
    if (userNutritions.length === 0) {
        return false;
    }

    const user = await getLatestUser();
    const userId = user?.id;
    if (!userId) {
        console.error('No user found to add metrics to');
        return false;
    }

    const processedUserNutritions = await Promise.all(
        userNutritions.map(async (nutrition) => ({
            ...nutrition,
            alcohol: await encryptDatabaseValue(nutrition.alcohol?.toString() || ''),
            calories: await encryptDatabaseValue(nutrition.calories?.toString() || ''),
            carbohydrate: await encryptDatabaseValue(nutrition.carbohydrate?.toString() || ''),
            createdAt: nutrition.createdAt || getCurrentTimestampISOString(),
            fat: await encryptDatabaseValue(nutrition.fat?.toString() || ''),
            fiber: await encryptDatabaseValue(nutrition.fiber?.toString() || ''),
            grams: await encryptDatabaseValue(nutrition.grams?.toString() || ''),
            mealType: await encryptDatabaseValue(nutrition.mealType?.toString() || ''),
            monounsaturatedFat: await encryptDatabaseValue(nutrition.monounsaturatedFat?.toString() || ''),
            name: await encryptDatabaseValue(nutrition.name || ''),
            polyunsaturatedFat: await encryptDatabaseValue(nutrition.polyunsaturatedFat?.toString() || ''),
            protein: await encryptDatabaseValue(nutrition.protein?.toString() || ''),
            saturatedFat: await encryptDatabaseValue(nutrition.saturatedFat?.toString() || ''),
            source: nutrition.source || USER_METRICS_SOURCES.USER_INPUT,
            sugar: await encryptDatabaseValue(nutrition.sugar?.toString() || ''),
            transFat: await encryptDatabaseValue(nutrition.transFat?.toString() || ''),
            unsaturatedFat: await encryptDatabaseValue(nutrition.unsaturatedFat?.toString() || ''),
            userId: nutrition.userId || userId,
        }))
    );

    const columns = [
        'userId',
        'name',
        'calories',
        'carbohydrate',
        'sugar',
        'fiber',
        'fat',
        'monounsaturatedFat',
        'polyunsaturatedFat',
        'saturatedFat',
        'transFat',
        'unsaturatedFat',
        'protein',
        'alcohol',
        'grams',
        'mealType',
        'dataId',
        'date',
        'createdAt',
        'type',
        'source',
    ] as (keyof UserNutritionInsertType)[];

    const batchSize = 500;

    for (let i = 0; i < processedUserNutritions.length; i += batchSize) {
        const batch = processedUserNutritions.slice(i, i + batchSize);

        const valuesClause = batch
            .map(() => `(${columns.map(() => '?').join(', ')})`)
            .join(', ');

        const parameters = batch.flatMap((nutrition) =>
            columns.map((col) => nutrition[col])
        ).map((param) => param ?? '');

        const sql = `
            INSERT INTO "UserNutrition" (${columns.map((col) => `"${col}"`).join(', ')})
            VALUES ${valuesClause}
        `;

        try {
            database.runSync(sql, ...parameters);
        } catch (error) {
            console.error(`Error during batch insert (batch ${i / batchSize + 1}):`, error);
            throw error;
        }
    }

    return true;
};

export const addUserNutrition = async (userNutrition: UserNutritionInsertType): Promise<number> => {
    const createdAt = userNutrition.createdAt || getCurrentTimestampISOString();
    const existingUserNutrition = await getUserNutritionByDataId(userNutrition.dataId);

    if (existingUserNutrition) {
        return updateUserNutrition(existingUserNutrition.id, {
            ...userNutrition,
            createdAt: existingUserNutrition.createdAt,
        });
    }

    if (!userNutrition.userId) {
        const user = await getLatestUser();
        if (user) {
            userNutrition.userId = user.id!;
        } else {
            console.error('No user found to add metrics to');
            return 0;
        }
    }

    try {
        const result = database.runSync(`
            INSERT INTO "UserNutrition" ("userId", "name", "calories", "carbohydrate", "sugar", "fiber", "fat", "monounsaturatedFat", "polyunsaturatedFat", "saturatedFat", "transFat", "unsaturatedFat", "protein", "alcohol", "grams", "mealType", "dataId", "date", "createdAt", "type", "source")
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            userNutrition.userId,
            await encryptDatabaseValue(userNutrition.name || ''),
            await encryptDatabaseValue(userNutrition.calories?.toString() || ''),
            await encryptDatabaseValue(userNutrition.carbohydrate?.toString() || ''),
            await encryptDatabaseValue(userNutrition.sugar?.toString() || ''),
            await encryptDatabaseValue(userNutrition.fiber?.toString() || ''),
            await encryptDatabaseValue(userNutrition.fat?.toString() || ''),
            await encryptDatabaseValue(userNutrition.monounsaturatedFat?.toString() || ''),
            await encryptDatabaseValue(userNutrition.polyunsaturatedFat?.toString() || ''),
            await encryptDatabaseValue(userNutrition.saturatedFat?.toString() || ''),
            await encryptDatabaseValue(userNutrition.transFat?.toString() || ''),
            await encryptDatabaseValue(userNutrition.unsaturatedFat?.toString() || ''),
            await encryptDatabaseValue(userNutrition.protein?.toString() || ''),
            await encryptDatabaseValue(userNutrition.alcohol?.toString() || ''),
            await encryptDatabaseValue(userNutrition.grams?.toString() || ''),
            await encryptDatabaseValue(userNutrition.mealType?.toString() || ''),
            userNutrition.dataId,
            userNutrition.date || createdAt,
            createdAt,
            userNutrition.type,
            userNutrition.source || USER_METRICS_SOURCES.USER_INPUT,
        ]
        );

        return result.lastInsertRowId;
    } catch (error) {
        throw error;
    }
};

export const addFood = async (food: FoodInsertType): Promise<number> => {
    const createdAt = food.createdAt || getCurrentTimestampISOString();
    try {
        const result = database.runSync(`
            INSERT INTO "Food" ("dataId", "name", "calories", "totalCarbohydrate", "totalFat", "protein", "alcohol", "fiber", "sugar", "isFavorite", "createdAt")
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        food.dataId || generateHash(),
        food.name,
        food.calories,
        food.totalCarbohydrate,
        food.totalFat,
        food.protein,
        food.alcohol || 0,
        food.fiber || 0,
        food.sugar || 0,
        food.isFavorite ? 1 : 0,
        createdAt
        );

        return result.lastInsertRowId;
    } catch (error) {
        throw error;
    }
};

export const addFitnessGoals = async (fitnessGoals: FitnessGoalsInsertType): Promise<number> => {
    const createdAt = fitnessGoals.createdAt || getCurrentTimestampISOString();
    try {
        const result = database.runSync(`
            INSERT INTO "FitnessGoals" ("alcohol", "protein", "totalCarbohydrate", "totalFat", "fiber", "calories", "sugar", "weight", "bodyFat", "bmi", "ffmi", "createdAt")
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        fitnessGoals.alcohol || 0,
        fitnessGoals.protein,
        fitnessGoals.totalCarbohydrate,
        fitnessGoals.totalFat,
        fitnessGoals.fiber || 0,
        fitnessGoals.calories,
        fitnessGoals.sugar || 0,
        fitnessGoals.weight || 0,
        fitnessGoals.bodyFat || 0,
        fitnessGoals.bmi || 0,
        fitnessGoals.ffmi || 0,
        createdAt
        );

        return result.lastInsertRowId;
    } catch (error) {
        throw error;
    }
};

export const createMigration = async (migration: string): Promise<number> => {
    const createdAt = getCurrentTimestampISOString();
    try {
        const result = database.runSync(
            'INSERT INTO "Migrations" ("migration", "createdAt") VALUES (?, ?)',
            [migration, createdAt]
        );

        return result.lastInsertRowId;
    } catch (error) {
        throw error;
    }
};

// Get functions

export const getUserMeasurements = async (id: number): Promise<undefined | UserMeasurementsReturnType & { measurements: string }> => {
    try {
        const result = database.getFirstSync<UserMeasurementsReturnType & { measurements: string }>(
            'SELECT * FROM "UserMeasurements" WHERE "id" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [id]
        );

        if (result) {
            return {
                ...result,
                measurements: JSON.parse(result.measurements),
            };
        }

        return undefined;
    } catch (error) {
        throw error;
    }
};

export const getUserMeasurementsBetweenDates = async (startDate: string, endDate: string): Promise<(UserMeasurementsReturnType & { measurements: string })[]> => {
    try {
        const results = database.getAllSync<UserMeasurementsReturnType & { measurements: string }>(
            'SELECT * FROM "UserMeasurements" WHERE "date" BETWEEN ? AND ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [startDate, endDate]
        );

        return results.map((result) => ({
            ...result,
            measurements: JSON.parse(result.measurements),
        }));
    } catch (error) {
        throw error;
    }
};

export const getUserMeasurementsFromDate = async (startDate: string): Promise<(UserMeasurementsReturnType & { measurements: string })[]> => {
    try {
        const results = database.getAllSync<UserMeasurementsReturnType & { measurements: string }>(
            'SELECT * FROM "UserMeasurements" WHERE "date" >= ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [startDate]
        );

        return results.map((result) => ({
            ...result,
            measurements: JSON.parse(result.measurements),
        }));
    } catch (error) {
        throw error;
    }
};

export const getUserMeasurementsPaginated = async (offset = 0, limit = 20): Promise<(UserMeasurementsReturnType & { measurements: string })[]> => {
    try {
        const results = database.getAllSync<UserMeasurementsReturnType & { measurements: string }>(
            'SELECT * FROM "UserMeasurements" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\') ORDER BY "id" DESC LIMIT ? OFFSET ?',
            [limit, limit * offset]
        );

        return results.map((result) => ({
            ...result,
            measurements: JSON.parse(result.measurements),
        }));
    } catch (error) {
        throw error;
    }
};

export const getTotalUserMeasurementsCount = async (): Promise<number> => {
    try {
        const result = database.getFirstSync<{ count: number }>(
            'SELECT COUNT(*) as count FROM "UserMeasurements" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')'
        );

        return result?.count || 0;
    } catch (error) {
        throw error;
    }
};

export const getLatestVersion = async (): Promise<string | undefined> => {
    try {
        const result = database.getFirstSync<{ version: string }>('SELECT * FROM "Versioning" ORDER BY "id" DESC LIMIT 1');
        return result?.version;
    } catch (error) {
        throw error;
    }
};

export const getVersioningByVersion = async (version: string): Promise<undefined | VersioningReturnType> => {
    try {
        const result = database.getFirstSync<VersioningReturnType>('SELECT * FROM "Versioning" WHERE "version" = ?', [version]);
        return result ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getOneRepMax = async (exerciseId: number): Promise<OneRepMaxReturnType | undefined> => {
    try {
        const result = database.getFirstSync<OneRepMaxReturnType>(
            'SELECT * FROM "OneRepMax" WHERE "exerciseId" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [exerciseId]
        );
        return result ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getBio = async (id: number): Promise<BioReturnType | undefined> => {
    try {
        const result = database.getFirstSync<BioReturnType>(
            'SELECT * FROM "Bio" WHERE "id" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [id]
        );
        return result ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getAllBio = async (): Promise<BioReturnType[]> => {
    try {
        return database.getAllSync<BioReturnType>('SELECT * FROM "Bio" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')');
    } catch (error) {
        throw error;
    }
};

export const getSetting = async (type: string): Promise<SettingsReturnType | undefined> => {
    try {
        const result = database.getFirstSync<SettingsReturnType>(
            'SELECT * FROM "Setting" WHERE "type" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [type]
        );

        return result ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getAllSettings = async (): Promise<SettingsReturnType[]> => {
    try {
        return database.getAllSync<SettingsReturnType>('SELECT * FROM "Setting" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')');
    } catch (error) {
        throw error;
    }
};

export const getAllChats = async (): Promise<ChatReturnType[]> => {
    try {
        return database.getAllSync<ChatReturnType>('SELECT * FROM "Chat" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')');
    } catch (error) {
        throw error;
    }
};

export const getChatsPaginated = async (offset = 0, limit = 20): Promise<ChatReturnType[]> => {
    try {
        return database.getAllSync<ChatReturnType>(`
            SELECT * FROM "Chat"
            WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')
            ORDER BY "id" DESC
            LIMIT ?
            OFFSET ?
        `, [limit, limit * offset]);
    } catch (error) {
        throw error;
    }
};

export const getUser = async (id?: number): Promise<undefined | UserWithMetricsType> => {
    if (!id) {
        return getLatestUser();
    }

    try {
        const user = database.getFirstSync<UserReturnType>('SELECT * FROM "User" WHERE "id" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')', [id]) ?? undefined;

        if (user) {
            const metrics = await getAllLatestMetricsForUser(user.id!) || {};
            return { ...user, metrics } as UserWithMetricsType;
        }

        return undefined;
    } catch (error) {
        throw error;
    }
};

export const getAllUsers = async (): Promise<UserReturnType[]> => {
    try {
        return database.getAllSync<UserReturnType>('SELECT * FROM "User" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')');
    } catch (error) {
        throw error;
    }
};

export const getClosestWeightUserMetric = async (
    // TODO: remove this userId
    userId: number = 1,
    targetDate: string = getCurrentTimestampISOString()
): Promise<MetricsForUserType['weight'] | undefined> => {
    const query = `
        SELECT "id", "weight" FROM "UserMetrics" 
        WHERE "userId" = ? 
        AND "weight" IS NOT NULL 
        AND "weight" <> '' 
        AND ("deletedAt" IS NULL OR "deletedAt" = '')
        ORDER BY ABS((julianday("date") - julianday(?)) * 86400) ASC LIMIT 1
    `;

    const result = await database.getFirstSync<UserMetricsEncryptedReturnType>(query, [userId, targetDate]);

    if (!result || !result.weight) {
        return undefined;
    }

    return parseFloat(await decryptDatabaseValue(result.weight));
};

export const getClosestHeightUserMetric = async (
    // TODO: remove this userId
    userId: number = 1,
    targetDate: string = getCurrentTimestampISOString()
): Promise<MetricsForUserType['height'] | undefined> => {
    const query = `
        SELECT "id", "height" FROM "UserMetrics" 
        WHERE "userId" = ? 
        AND "height" IS NOT NULL 
        AND "height" <> '' 
        AND ("deletedAt" IS NULL OR "deletedAt" = '') 
        ORDER BY ABS((julianday("date") - julianday(?)) * 86400) ASC LIMIT 1
    `;

    const result = await database.getFirstSync<UserMetricsEncryptedReturnType>(query, [userId, targetDate]);

    if (!result || !result.height) {
        return undefined;
    }

    return parseFloat(await decryptDatabaseValue(result.height));
};

export const getClosestFatPercentageUserMetric = async (
    // TODO: remove this userId
    userId: number = 1,
    targetDate: string = getCurrentTimestampISOString()
): Promise<MetricsForUserType['fatPercentage'] | undefined> => {
    const query = `
        SELECT "id", "fatPercentage" FROM "UserMetrics" 
        WHERE "userId" = ? 
        AND "fatPercentage" IS NOT NULL 
        AND "fatPercentage" <> '' 
        AND ("deletedAt" IS NULL OR "deletedAt" = '') 
        ORDER BY ABS((julianday("date") - julianday(?)) * 86400) ASC LIMIT 1
    `;

    const result = await database.getFirstSync<UserMetricsEncryptedReturnType>(query, [userId, targetDate]);

    if (!result || !result.fatPercentage) {
        return undefined;
    }

    return parseFloat(await decryptDatabaseValue(result.fatPercentage));
};

export const getClosestEatingPhaseUserMetric = async (
    // TODO: remove this userId
    userId: number = 1,
    targetDate: string = getCurrentTimestampISOString()
): Promise<MetricsForUserType['eatingPhase'] | undefined> => {
    const query = `
        SELECT "id", "eatingPhase" FROM "UserMetrics" 
        WHERE "userId" = ? 
        AND "eatingPhase" IS NOT NULL 
        AND "eatingPhase" <> '' 
        AND ("deletedAt" IS NULL OR "deletedAt" = '') 
        ORDER BY ABS((julianday("date") - julianday(?)) * 86400) ASC LIMIT 1
    `;

    const result = await database.getFirstSync<UserMetricsEncryptedReturnType>(query, [userId, targetDate]);

    if (!result) {
        return undefined;
    }

    return result.eatingPhase;
};

export const getAllLatestMetricsForUser = async (
    // TODO: remove this userId
    userId: number = 1,
    targetDate: string = getCurrentTimestampISOString()
): Promise<MetricsForUserType | null> => {
    try {
        const closestMetrics: MetricsForUserType = {
            date: targetDate,
            eatingPhase: undefined,
            fatPercentage: undefined,
            height: undefined,
            latestId: -1,
            source: USER_METRICS_SOURCES.USER_INPUT,
            weight: undefined,
        };

        // Call each individual function to fetch each metric
        const [weight, height, fatPercentage, eatingPhase] = await Promise.all([
            getClosestWeightUserMetric(userId, targetDate),
            getClosestHeightUserMetric(userId, targetDate),
            getClosestFatPercentageUserMetric(userId, targetDate),
            getClosestEatingPhaseUserMetric(userId, targetDate),
        ]);

        if (weight !== undefined) {
            closestMetrics.weight = weight;
        }

        if (height !== undefined) {
            closestMetrics.height = height;
        }

        if (fatPercentage !== undefined) {
            closestMetrics.fatPercentage = fatPercentage;
        }

        if (eatingPhase !== undefined) {
            closestMetrics.eatingPhase = eatingPhase;
        }

        // If none of the metrics were found, return null
        const hasMetrics = [weight, height, fatPercentage, eatingPhase].some((metric) => metric !== undefined);
        if (!hasMetrics) {
            return null;
        }

        return closestMetrics;
    } catch (error) {
        throw error;
    }
};

export const getUserMetrics = async (id: number): Promise<undefined | UserMetricsDecryptedReturnType> => {
    try {
        const result = database.getFirstSync<UserMetricsEncryptedReturnType>(
            'SELECT * FROM "UserMetrics" WHERE "id" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [id]
        );

        if (result) {
            return {
                ...result,
                fatPercentage: parseFloat(await decryptDatabaseValue(result.fatPercentage)) || 0,
                height: parseFloat(await decryptDatabaseValue(result.height)) || 0,
                weight: parseFloat(await decryptDatabaseValue(result.weight)) || 0,
            } as unknown as UserMetricsDecryptedReturnType;
        }

        return undefined;
    } catch (error) {
        throw error;
    }
};

export const getUserMetricsPaginated = async (offset = 0, limit = 20): Promise<UserMetricsDecryptedReturnType[]> => {
    try {
        const results = database.getAllSync<UserMetricsEncryptedReturnType>(`
            SELECT * FROM "UserMetrics"
            WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')
            ORDER BY "date" DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        return (await Promise.all(results.map(async (row) => {
            try {
                return {
                    ...row,
                    fatPercentage: parseFloat(await decryptDatabaseValue(row.fatPercentage)) || 0,
                    height: parseFloat(await decryptDatabaseValue(row.height)) || 0,
                    weight: parseFloat(await decryptDatabaseValue(row.weight)) || 0,
                } as unknown as UserMetricsDecryptedReturnType;
            } catch (decryptionError) {
                await deleteUserMetrics(row.id!);
                console.error('Error decrypting data for row:', row, decryptionError);
                return undefined;
            }
        }))).filter((row) => row !== undefined) as UserMetricsDecryptedReturnType[];
    } catch (error) {
        throw error;
    }
};

export const getUserMetricsBetweenDates = async (startDate: string, endDate: string): Promise<UserMetricsDecryptedReturnType[]> => {
    try {
        const results = database.getAllSync<UserMetricsEncryptedReturnType>(`
            SELECT * FROM "UserMetrics"
            WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\') AND "date" BETWEEN ? AND ?
            ORDER BY "date" DESC
        `, [startDate, endDate]);

        return (await Promise.all(results.map(async (row) => {
            try {
                return {
                    ...row,
                    fatPercentage: parseFloat(await decryptDatabaseValue(row.fatPercentage)) || 0,
                    height: parseFloat(await decryptDatabaseValue(row.height)) || 0,
                    weight: parseFloat(await decryptDatabaseValue(row.weight)) || 0,
                } as unknown as UserMetricsDecryptedReturnType;
            } catch (decryptionError) {
                await deleteUserMetrics(row.id!);
                console.error('Error decrypting data for row:', row, decryptionError);
                return undefined;
            }
        }))).filter((row) => row !== undefined) as UserMetricsDecryptedReturnType[];
    } catch (error) {
        throw error;
    }
};

export const getUserMetricsFromDate = async (startDate: string): Promise<UserMetricsDecryptedReturnType[]> => {
    try {
        const todayDate = getCurrentTimestampISOString();

        const results = database.getAllSync<UserMetricsEncryptedReturnType>(`
            SELECT * FROM "UserMetrics"
            WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\') AND "date" BETWEEN ? AND ?
            ORDER BY "date" DESC
        `, [startDate, todayDate]);

        return (await Promise.all(results.map(async (row) => {
            try {
                return {
                    ...row,
                    fatPercentage: parseFloat(await decryptDatabaseValue(row.fatPercentage)) || 0,
                    height: parseFloat(await decryptDatabaseValue(row.height)) || 0,
                    weight: parseFloat(await decryptDatabaseValue(row.weight)) || 0,
                } as unknown as UserMetricsDecryptedReturnType;
            } catch (decryptionError) {
                await deleteUserMetrics(row.id!);
                console.error('Error decrypting data for row:', row, decryptionError);
                return undefined;
            }
        }))).filter((row) => row !== undefined) as UserMetricsDecryptedReturnType[];
    } catch (error) {
        throw error;
    }
};

export const getTotalUserMetricsCount = async (): Promise<number> => {
    try {
        const result = database.getFirstSync<{ count: number }>(`
            SELECT COUNT(*) as count FROM "UserMetrics"
            WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')
        `);
        return result?.count ?? 0;
    } catch (error) {
        throw error;
    }
};

export const getAllUserMetrics = async (): Promise<UserMetricsDecryptedReturnType[]> => {
    try {
        const results = database.getAllSync<UserMetricsEncryptedReturnType>(
            'SELECT * FROM "UserMetrics" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')'
        );

        return await Promise.all(results.map(async (row) => {
            return {
                ...row,
                fatPercentage: parseFloat(await decryptDatabaseValue(row.fatPercentage)) || 0,
                height: parseFloat(await decryptDatabaseValue(row.height)) || 0,
                weight: parseFloat(await decryptDatabaseValue(row.weight)) || 0,
            } as unknown as UserMetricsDecryptedReturnType;
        }));
    } catch (error) {
        throw error;
    }
};

export const getAllUserNutrition = async (): Promise<UserNutritionDecryptedReturnType[]> => {
    try {
        const results = database.getAllSync<UserNutritionEncryptedReturnType>(
            'SELECT * FROM "UserNutrition" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')'
        );

        return await Promise.all(results.map(async (row) => {
            return {
                ...row,
                alcohol: parseFloat(await decryptDatabaseValue(row.alcohol)) || 0,
                calories: parseFloat(await decryptDatabaseValue(row.calories)) || 0,
                carbohydrate: parseFloat(await decryptDatabaseValue(row.carbohydrate)) || 0,
                fat: parseFloat(await decryptDatabaseValue(row.fat)) || 0,
                fiber: parseFloat(await decryptDatabaseValue(row.fiber)) || 0,
                grams: parseFloat(await decryptDatabaseValue(row.grams)) || 0,
                mealType: await decryptDatabaseValue(row.mealType),
                monounsaturatedFat: parseFloat(await decryptDatabaseValue(row.monounsaturatedFat)) || 0,
                name: await decryptDatabaseValue(row.name),
                polyunsaturatedFat: parseFloat(await decryptDatabaseValue(row.polyunsaturatedFat)) || 0,
                protein: parseFloat(await decryptDatabaseValue(row.protein)) || 0,
                saturatedFat: parseFloat(await decryptDatabaseValue(row.saturatedFat)) || 0,
                sugar: parseFloat(await decryptDatabaseValue(row.sugar)) || 0,
                transFat: parseFloat(await decryptDatabaseValue(row.transFat)) || 0,
                unsaturatedFat: parseFloat(await decryptDatabaseValue(row.unsaturatedFat)) || 0,
            } as unknown as UserNutritionDecryptedReturnType;
        }));
    } catch (error) {
        throw error;
    }
};

export const getUserMetricsByDataId = async (dataId: string): Promise<undefined | UserMetricsDecryptedReturnType> => {
    try {
        const result = database.getFirstSync<UserMetricsEncryptedReturnType>(
            'SELECT * FROM "UserMetrics" WHERE "dataId" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [dataId]
        );

        if (!result) {
            return undefined;
        }

        try {
            return {
                ...result,
                fatPercentage: parseFloat(await decryptDatabaseValue(result.fatPercentage)) || 0,
                height: parseFloat(await decryptDatabaseValue(result.height)) || 0,
                weight: parseFloat(await decryptDatabaseValue(result.weight)) || 0,
            } as unknown as UserMetricsDecryptedReturnType;
        } catch (decryptionError) {
            await deleteUserMetrics(result.id!);
            console.error('Error decrypting data for row:', result, decryptionError);
            return undefined;
        }
    } catch (error) {
        throw error;
    }
};

export const getLatestUserMetrics = async (): Promise<undefined | UserMetricsDecryptedReturnType> => {
    try {
        const result = database.getFirstSync<UserMetricsEncryptedReturnType>('SELECT * FROM "UserMetrics" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\') ORDER BY "id" DESC LIMIT 1');

        if (result) {
            return {
                ...result,
                fatPercentage: parseFloat(await decryptDatabaseValue(result?.fatPercentage)) || 0,
                height: parseFloat(await decryptDatabaseValue(result?.height)) || 0,
                weight: parseFloat(await decryptDatabaseValue(result?.weight)) || 0,
            };
        }
    } catch (error) {
        throw error;
    }
};

export const getLatestUser = async (): Promise<undefined | UserWithMetricsType> => {
    try {
        const user = database.getFirstSync<UserReturnType>('SELECT * FROM "User" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\') ORDER BY "id" DESC LIMIT 1') ?? undefined;

        if (user) {
            const metrics = await getAllLatestMetricsForUser(user.id!) || {};
            return { ...user, metrics } as UserWithMetricsType;
        }

        return undefined;
    } catch (error) {
        throw error;
    }
};

export const getAllExercises = async (): Promise<ExerciseReturnType[]> => {
    try {
        return database.getAllSync<ExerciseReturnType>('SELECT * FROM "Exercise" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')');
    } catch (error) {
        throw error;
    }
};

export const getExercisesPaginated = async (offset = 0, limit = 20): Promise<ExerciseReturnType[]> => {
    try {
        return database.getAllSync<ExerciseReturnType>(`
            SELECT * FROM "Exercise"
            WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')
            ORDER BY "id" DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);
    } catch (error) {
        throw error;
    }
};

export const getTotalExercisesCount = async (): Promise<number> => {
    try {
        const result = database.getFirstSync<{ count: number }>(`
            SELECT COUNT(*) as count FROM "Exercise"
            WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')
        `);
        return result?.count ?? 0;
    } catch (error) {
        throw error;
    }
};

export const getAllWorkouts = async (): Promise<WorkoutReturnType[]> => {
    try {
        const result = database.getAllSync<WorkoutReturnType>('SELECT * FROM "Workout" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')');

        return result.map((workout) => ({
            ...workout,
        }));
    } catch (error) {
        throw error;
    }
};

export const getAllWorkoutsWithTrashed = async (): Promise<WorkoutReturnType[]> => {
    try {
        const result = database.getAllSync<WorkoutReturnType>('SELECT * FROM "Workout"');

        return result.map((workout) => ({
            ...workout,
        }));
    } catch (error) {
        throw error;
    }
};

export const getRecurringWorkouts = async (): Promise<undefined | WorkoutReturnType[]> => {
    try {
        const result = database.getAllSync<WorkoutReturnType>(
            'SELECT * FROM "Workout" WHERE "recurringOnWeek" IS NOT NULL AND ("deletedAt" IS NULL OR "deletedAt" = \'\') ORDER BY "date" ASC'
        );

        return result.map((workout) => ({
            ...workout,
        }));
    } catch (error) {
        throw error;
    }
};

export const getWorkouts = async (): Promise<undefined | WorkoutReturnType[]> => {
    try {
        const result = database.getAllSync<WorkoutReturnType>(
            'SELECT * FROM "Workout" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')'
        );

        return result.map((workout) => ({
            ...workout,
        }));
    } catch (error) {
        throw error;
    }
};

export const getWorkoutById = async (id: number): Promise<undefined | WorkoutReturnType> => {
    try {
        const result = database.getFirstSync<WorkoutReturnType>('SELECT * FROM "Workout" WHERE "id" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')', [id]) ?? undefined;

        return {
            ...result,
        } as WorkoutReturnType;
    } catch (error) {
        throw error;
    }
};

export const getSetsByExerciseId = async (exerciseId: number): Promise<SetReturnType[]> => {
    try {
        return database.getAllSync<SetReturnType>('SELECT * FROM "Set" WHERE "exerciseId" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')', [exerciseId]);
    } catch (error) {
        throw error;
    }
};

export const getSetById = async (setId: number): Promise<null | SetReturnType | undefined> => {
    try {
        return database.getFirstSync<SetReturnType>(
            'SELECT * FROM "Set" WHERE "id" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [setId]
        );
    } catch (error) {
        throw error;
    }
};

export const getSetsByIds = async (setIds: number[]): Promise<SetReturnType[]> => {
    try {
        return database.getAllSync<SetReturnType>(`
            SELECT * FROM "Set"
            WHERE "id" IN (${setIds.join(',')})
            AND ("deletedAt" IS NULL OR "deletedAt" = \'\')
        `);
    } catch (error) {
        throw error;
    }
};

export const getSetsByWorkoutId = async (workoutId: number): Promise<SetReturnType[]> => {
    try {
        const sets = database.getAllSync<SetReturnType>(
            'SELECT * FROM "Set" WHERE "workoutId" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\') ORDER BY "setOrder" ASC',
            [workoutId]
        );
        return sets;
    } catch (error) {
        console.error('Error in getSetsByWorkoutId:', error);
        throw error;
    }
};

export const getSetsByIdsAndExerciseId = async (setIds: number[], exerciseId: number): Promise<SetReturnType[]> => {
    let sets: SetReturnType[];
    try {
        sets = database.getAllSync<SetReturnType>(`
            SELECT * FROM "Set"
            WHERE "id" IN (${setIds.join(',')})
            AND ("deletedAt" IS NULL OR "deletedAt" = '')
        `);
    } catch (error) {
        throw error;
    }
    return sets.filter((set) => set.exerciseId === exerciseId);
};

export const getExerciseById = async (id: number): Promise<ExerciseReturnType | undefined> => {
    try {
        return database.getFirstSync<ExerciseReturnType>('SELECT * FROM "Exercise" WHERE "id" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')', [id]) ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getWorkoutEvent = async (id: number): Promise<undefined | WorkoutEventReturnType> => {
    try {
        const result = database.getFirstSync<WorkoutEventReturnType>('SELECT * FROM "WorkoutEvent" WHERE "id" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')', [id]);

        return result ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getWorkoutEvents = async (): Promise<WorkoutEventReturnType[]> => {
    try {
        return database.getAllSync<WorkoutEventReturnType>('SELECT * FROM "WorkoutEvent" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')');
    } catch (error) {
        throw error;
    }
};

export const getWorkoutEventsByWorkoutId = async (workoutId: number): Promise<WorkoutEventReturnType[]> => {
    try {
        return database.getAllSync<WorkoutEventReturnType>(`
            SELECT * FROM "WorkoutEvent"
            WHERE "workoutId" = ?
            AND ("deletedAt" IS NULL OR "deletedAt" = \'\')
        `, [workoutId]);
    } catch (error) {
        throw error;
    }
};

export const getRecentWorkoutsByWorkoutId = async (workoutId: number): Promise<WorkoutEventReturnType[]> => {
    try {
        return database.getAllSync<WorkoutEventReturnType>(`
            SELECT *
            FROM "WorkoutEvent"
            WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')
            AND "workoutId" = ?
            AND "status" = ?
        `, [workoutId, COMPLETED_STATUS]);
    } catch (error) {
        throw error;
    }
};

export const getUpcomingWorkoutsByWorkoutId = async (workoutId: number): Promise<WorkoutEventReturnType[]> => {
    const todayDate = getCurrentTimestampISOString();
    try {
        return database.getAllSync<WorkoutEventReturnType>(`
            SELECT * FROM "WorkoutEvent"
            WHERE "workoutId" = ?
            AND "status" = ?
            AND "date" > ?
            AND ("deletedAt" IS NULL OR "deletedAt" = \'\')
        `, [workoutId, SCHEDULED_STATUS, todayDate]);
    } catch (error) {
        throw error;
    }
};

export const getUpcomingWorkouts = async (): Promise<WorkoutEventReturnType[]> => {
    const todayDate = getCurrentTimestampISOString();
    try {
        return database.getAllSync<WorkoutEventReturnType>(`
            SELECT * FROM "WorkoutEvent"
            WHERE "status" = ?
            AND "date" > ?
            AND ("deletedAt" IS NULL OR "deletedAt" = '')
        `, [SCHEDULED_STATUS, todayDate]);
    } catch (error) {
        throw error;
    }
};

export const getTotalUpcomingWorkoutsCount = async (): Promise<number> => {
    const todayDate = getCurrentTimestampISOString();
    try {
        const result = database.getFirstSync<{ count: number }>(
            'SELECT COUNT(*) as count FROM "WorkoutEvent" WHERE "status" = ? AND "date" > ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [SCHEDULED_STATUS, todayDate]
        );
        return result?.count ?? 0;
    } catch (error) {
        throw error;
    }
};

export const getUpcomingWorkoutsPaginated = async (offset: number, limit: number): Promise<WorkoutEventReturnType[]> => {
    const todayDate = new Date()
        .toISOString()
        .split('T')[0];
    try {
        return database.getAllSync<WorkoutEventReturnType>(`
            SELECT * FROM "WorkoutEvent"
            WHERE "status" = ?
            AND DATE("date") >= DATE(?)
            ORDER BY "date" ASC
            LIMIT ? OFFSET ?
        `, [SCHEDULED_STATUS, todayDate, limit, offset]);
    } catch (error) {
        throw error;
    }
};

export const getRecentWorkouts = async (): Promise<WorkoutEventReturnType[]> => {
    try {
        return database.getAllSync<WorkoutEventReturnType>(`
            SELECT * FROM "WorkoutEvent"
            WHERE "status" = ?
            AND ("deletedAt" IS NULL OR "deletedAt" = '')
        `, [COMPLETED_STATUS]);
    } catch (error) {
        throw error;
    }
};

export const getRecentWorkoutById = async (id: number): Promise<undefined | WorkoutEventReturnType> => {
    try {
        return database.getFirstSync<WorkoutEventReturnType>('SELECT * FROM "WorkoutEvent" WHERE "id" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')', [id]) ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getTotalRecentWorkoutsCount = async (): Promise<number> => {
    try {
        const result = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM "WorkoutEvent" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\') AND "status" = "completed"');
        return result?.count ?? 0;
    } catch (error) {
        throw error;
    }
};

export const getRecentWorkoutsBetweenDates = async (startDate: string, endDate: string): Promise<WorkoutEventReturnType[]> => {
    try {
        return database.getAllSync<WorkoutEventReturnType>(`
            SELECT * FROM "WorkoutEvent"
            WHERE "status" = ?
            AND "date" BETWEEN ? AND ?
            AND ("deletedAt" IS NULL OR "deletedAt" = '')
        `, [COMPLETED_STATUS, startDate, endDate]);
    } catch (error) {
        throw error;
    }
};

export const getRecentWorkoutsFromDate = async (startDate: string): Promise<WorkoutEventReturnType[]> => {
    try {
        return database.getAllSync<WorkoutEventReturnType>(`
            SELECT * FROM "WorkoutEvent"
            WHERE "status" = ?
            AND "date" >= ?
            AND ("deletedAt" IS NULL OR "deletedAt" = '')
        `, [COMPLETED_STATUS, startDate]);
    } catch (error) {
        throw error;
    }
};

export const getRecentWorkoutsPaginated = async (offset: number, limit: number): Promise<WorkoutEventReturnType[]> => {
    try {
        return database.getAllSync<WorkoutEventReturnType>(
            'SELECT * FROM "WorkoutEvent" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\') AND "status" = "completed" ORDER BY "date" DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );
    } catch (error) {
        throw error;
    }
};

export const getWorkoutByIdWithTrashed = async (id: number): Promise<undefined | WorkoutReturnType> => {
    try {
        const result = database.getFirstSync<WorkoutReturnType>('SELECT * FROM "Workout" WHERE "id" = ?', [id]) ?? undefined;

        return {
            ...result,
        } as WorkoutReturnType;
    } catch (error) {
        throw error;
    }
};

export const getWorkoutDetails = async (
    workoutId: number
): Promise<undefined | { exercisesWithSets: ExerciseWithSetsType[]; workout: WorkoutReturnType; }> => {
    try {
        const workout = database.getFirstSync<WorkoutReturnType>('SELECT * FROM "Workout" WHERE "id" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')', [workoutId]);
        if (!workout) {
            return undefined;
        }

        const exercisesWithSets = await getExercisesWithSetsByWorkoutId(workoutId);

        return {
            exercisesWithSets,
            workout,
        };
    } catch (error) {
        throw error;
    }
};

export const getExercisesWithSetsByWorkoutId = async (
    workoutId: number
): Promise<(ExerciseReturnType & { sets: SetReturnType[] })[]> => {
    try {
        // Step 1: Get all sets associated with the workout
        const sets = database.getAllSync<SetReturnType>(
            'SELECT * FROM "Set" WHERE "workoutId" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\') ORDER BY "setOrder" ASC',
            [workoutId]
        );

        // Step 2: Map sets to their respective exercises
        const exerciseSetsMap: { [key: number]: SetReturnType[] } = {};
        for (const set of sets) {
            if (!exerciseSetsMap[set.exerciseId]) {
                exerciseSetsMap[set.exerciseId] = [];
            }

            exerciseSetsMap[set.exerciseId].push(set);
        }

        // Step 3: Get the unique exercise IDs
        const exerciseIds = Object.keys(exerciseSetsMap).map((id) => parseInt(id, 10));

        if (exerciseIds.length === 0) {
            return [];
        }

        // Step 4: Fetch the exercises using the exercise IDs
        const exercises = database.getAllSync<ExerciseReturnType>(
            `SELECT * FROM "Exercise" WHERE "id" IN (${exerciseIds.join(',')}) AND ("deletedAt" IS NULL OR "deletedAt" = \'\')`
        );

        // Step 5: Combine exercises with their sets
        const exercisesWithSets = exercises.map((exercise) => ({
            ...exercise,
            sets: exerciseSetsMap[exercise.id!] || [],
        }));

        return exercisesWithSets;
    } catch (error) {
        console.error('Error in getExercisesWithSetsByWorkoutId:', error);
        throw error;
    }
};

export const getWorkoutWithExercisesRepsAndSetsDetails = async (workoutId: number): Promise<undefined | WorkoutWithExercisesRepsAndSetsDetailsReturnType> => {
    const workout = database.getFirstSync<WorkoutReturnType>('SELECT * FROM "Workout" WHERE "id" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')', [workoutId]);

    if (!workout) {
        return undefined;
    }

    const exercises = await getExercisesWithSetsByWorkoutId(workoutId);

    return {
        exercises,
        id: workout.id,
        title: workout.title,
    };
};

export const getTotalWorkoutsCount = async (): Promise<number> => {
    try {
        const result = database.getFirstSync<{ count: number }>(
            'SELECT COUNT(*) as count FROM "Workout" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')'
        );

        return result?.count ?? 0;
    } catch (error) {
        throw error;
    }
};

export const getWorkoutsPaginated = async (offset: number, limit: number, loadDeleted = true): Promise<WorkoutReturnType[]> => {
    try {
        const result = database.getAllSync<WorkoutReturnType>(
            `SELECT * FROM "Workout" ORDER BY "id" DESC LIMIT ? OFFSET ? ${!loadDeleted ? 'AND ("deletedAt" IS NULL OR "deletedAt" = \'\')' : ''}`,
            [limit, offset]
        );

        return result.map((workout) => ({
            ...workout,
        }));
    } catch (error) {
        throw error;
    }
};

export const getUserNutrition = async (id: number): Promise<undefined | UserNutritionDecryptedReturnType> => {
    try {
        const result = database.getFirstSync<UserNutritionEncryptedReturnType>(
            'SELECT * FROM "UserNutrition" WHERE "id" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [id]
        );

        let decryptedResult = {} as UserNutritionDecryptedReturnType;
        if (result) {
            decryptedResult = {
                ...result,
                alcohol: parseFloat(await decryptDatabaseValue(result.alcohol)) || 0,
                calories: parseFloat(await decryptDatabaseValue(result.calories)) || 0,
                carbohydrate: parseFloat(await decryptDatabaseValue(result.carbohydrate)) || 0,
                fat: parseFloat(await decryptDatabaseValue(result.fat)) || 0,
                fiber: parseFloat(await decryptDatabaseValue(result.fiber)) || 0,
                grams: parseFloat(await decryptDatabaseValue(result.grams)) || 0,
                mealType: parseFloat(await decryptDatabaseValue(result.mealType)) || 0,
                monounsaturatedFat: parseFloat(await decryptDatabaseValue(result.monounsaturatedFat)) || 0,
                name: await decryptDatabaseValue(result.name) || '',
                polyunsaturatedFat: parseFloat(await decryptDatabaseValue(result.polyunsaturatedFat)) || 0,
                protein: parseFloat(await decryptDatabaseValue(result.protein)) || 0,
                saturatedFat: parseFloat(await decryptDatabaseValue(result.saturatedFat)) || 0,
                sugar: parseFloat(await decryptDatabaseValue(result.sugar)) || 0,
                transFat: parseFloat(await decryptDatabaseValue(result.transFat)) || 0,
                unsaturatedFat: parseFloat(await decryptDatabaseValue(result.unsaturatedFat)) || 0,
            };
        }

        return decryptedResult ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getLatestUserNutritionByUserId = async (userId: number): Promise<undefined | UserNutritionDecryptedReturnType> => {
    try {
        const result = database.getFirstSync<UserNutritionEncryptedReturnType>(
            'SELECT * FROM "UserNutrition" WHERE "userId" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\') ORDER BY "id" DESC LIMIT 1',
            [userId]
        );

        if (!result) {
            return undefined;
        }

        return {
            ...result,
            alcohol: parseFloat(await decryptDatabaseValue(result.alcohol)) || 0,
            calories: parseFloat(await decryptDatabaseValue(result.calories)) || 0,
            carbohydrate: parseFloat(await decryptDatabaseValue(result.carbohydrate)) || 0,
            fat: parseFloat(await decryptDatabaseValue(result.fat)) || 0,
            fiber: parseFloat(await decryptDatabaseValue(result.fiber)) || 0,
            grams: parseFloat(await decryptDatabaseValue(result.grams)) || 0,
            mealType: await decryptDatabaseValue(result.mealType),
            monounsaturatedFat: parseFloat(await decryptDatabaseValue(result.monounsaturatedFat)) || 0,
            name: await decryptDatabaseValue(result.name),
            polyunsaturatedFat: parseFloat(await decryptDatabaseValue(result.polyunsaturatedFat)) || 0,
            protein: parseFloat(await decryptDatabaseValue(result.protein)) || 0,
            saturatedFat: parseFloat(await decryptDatabaseValue(result.saturatedFat)) || 0,
            sugar: parseFloat(await decryptDatabaseValue(result.sugar)) || 0,
            transFat: parseFloat(await decryptDatabaseValue(result.transFat)) || 0,
            unsaturatedFat: parseFloat(await decryptDatabaseValue(result.unsaturatedFat)) || 0,
        } as unknown as UserNutritionDecryptedReturnType;
    } catch (error) {
        throw error;
    }
};

export const getAllUserNutritionByUserId = async (userId: number): Promise<UserNutritionDecryptedReturnType[]> => {
    try {
        const results = database.getAllSync<UserNutritionEncryptedReturnType>(
            'SELECT * FROM "UserNutrition" WHERE "userId" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [userId]
        );

        return (await Promise.all(results.map(async (row) => {
            try {
                return {
                    ...row,
                    alcohol: parseFloat(await decryptDatabaseValue(row.alcohol)) || 0,
                    calories: parseFloat(await decryptDatabaseValue(row.calories)) || 0,
                    carbohydrate: parseFloat(await decryptDatabaseValue(row.carbohydrate)) || 0,
                    fat: parseFloat(await decryptDatabaseValue(row.fat)) || 0,
                    fiber: parseFloat(await decryptDatabaseValue(row.fiber)) || 0,
                    grams: parseFloat(await decryptDatabaseValue(row.grams)) || 0,
                    mealType: await decryptDatabaseValue(row.mealType) || '',
                    monounsaturatedFat: parseFloat(await decryptDatabaseValue(row.monounsaturatedFat)) || 0,
                    name: await decryptDatabaseValue(row.name) || '',
                    polyunsaturatedFat: parseFloat(await decryptDatabaseValue(row.polyunsaturatedFat)) || 0,
                    protein: parseFloat(await decryptDatabaseValue(row.protein)) || 0,
                    saturatedFat: parseFloat(await decryptDatabaseValue(row.saturatedFat)) || 0,
                    sugar: parseFloat(await decryptDatabaseValue(row.sugar)) || 0,
                    transFat: parseFloat(await decryptDatabaseValue(row.transFat)) || 0,
                    unsaturatedFat: parseFloat(await decryptDatabaseValue(row.unsaturatedFat)) || 0,
                } as unknown as UserNutritionDecryptedReturnType;
            } catch (decryptionError) {
                await deleteUserNutrition(row.id!);
                console.error('Error decrypting data for row:', row, decryptionError);
                return undefined;
            }
        }))).filter((row) => row !== undefined) as UserNutritionDecryptedReturnType[];
    } catch (error) {
        throw error;
    }
};

export const getAllUserNutritionBySource = async (source: string): Promise<UserNutritionDecryptedReturnType[]> => {
    try {
        const results = database.getAllSync<UserNutritionEncryptedReturnType>(
            'SELECT * FROM "UserNutrition" WHERE "source" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [source]
        );

        return (await Promise.all(results.map(async (row) => {
            try {
                return {
                    ...row,
                    alcohol: parseFloat(await decryptDatabaseValue(row.alcohol)) || 0,
                    calories: parseFloat(await decryptDatabaseValue(row.calories)) || 0,
                    carbohydrate: parseFloat(await decryptDatabaseValue(row.carbohydrate)) || 0,
                    fat: parseFloat(await decryptDatabaseValue(row.fat)) || 0,
                    fiber: parseFloat(await decryptDatabaseValue(row.fiber)) || 0,
                    grams: parseFloat(await decryptDatabaseValue(row.grams)) || 0,
                    mealType: await decryptDatabaseValue(row.mealType) || '',
                    monounsaturatedFat: parseFloat(await decryptDatabaseValue(row.monounsaturatedFat)) || 0,
                    name: await decryptDatabaseValue(row.name) || '',
                    polyunsaturatedFat: parseFloat(await decryptDatabaseValue(row.polyunsaturatedFat)) || 0,
                    protein: parseFloat(await decryptDatabaseValue(row.protein)) || 0,
                    saturatedFat: parseFloat(await decryptDatabaseValue(row.saturatedFat)) || 0,
                    sugar: parseFloat(await decryptDatabaseValue(row.sugar)) || 0,
                    transFat: parseFloat(await decryptDatabaseValue(row.transFat)) || 0,
                    unsaturatedFat: parseFloat(await decryptDatabaseValue(row.unsaturatedFat)) || 0,
                } as unknown as UserNutritionDecryptedReturnType;
            } catch (decryptionError) {
                await deleteUserNutrition(row.id!);
                console.error('Error decrypting data for row:', row, decryptionError);
                return undefined;
            }
        }))).filter((row) => row !== undefined) as UserNutritionDecryptedReturnType[];
    } catch (error) {
        throw error;
    }
};

export const getUserNutritionByDataId = async (dataId: string): Promise<undefined | UserNutritionDecryptedReturnType> => {
    try {
        const result = database.getFirstSync<UserNutritionEncryptedReturnType>(
            'SELECT * FROM "UserNutrition" WHERE "dataId" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [dataId]
        );

        if (!result) {
            return undefined;
        }

        try {
            return {
                ...result,
                alcohol: parseFloat(await decryptDatabaseValue(result.alcohol)) || 0,
                calories: parseFloat(await decryptDatabaseValue(result.calories)) || 0,
                carbohydrate: parseFloat(await decryptDatabaseValue(result.carbohydrate)) || 0,
                fat: parseFloat(await decryptDatabaseValue(result.fat)) || 0,
                fiber: parseFloat(await decryptDatabaseValue(result.fiber)) || 0,
                grams: parseFloat(await decryptDatabaseValue(result.grams)) || 0,
                mealType: await decryptDatabaseValue(result.mealType) || '',
                monounsaturatedFat: parseFloat(await decryptDatabaseValue(result.monounsaturatedFat)) || 0,
                name: await decryptDatabaseValue(result.name) || '',
                polyunsaturatedFat: parseFloat(await decryptDatabaseValue(result.polyunsaturatedFat)) || 0,
                protein: parseFloat(await decryptDatabaseValue(result.protein)) || 0,
                saturatedFat: parseFloat(await decryptDatabaseValue(result.saturatedFat)) || 0,
                sugar: parseFloat(await decryptDatabaseValue(result.sugar)) || 0,
                transFat: parseFloat(await decryptDatabaseValue(result.transFat)) || 0,
                unsaturatedFat: parseFloat(await decryptDatabaseValue(result.unsaturatedFat)) || 0,
            } as unknown as UserNutritionDecryptedReturnType;
        } catch (decryptionError) {
            await deleteUserNutrition(result.id!);
            console.error('Error decrypting data for row:', result, decryptionError);
            return undefined;
        }
    } catch (error) {
        throw error;
    }
};

export const getUserNutritionPaginated = async (offset = 0, limit = 20, order: 'ASC' | 'DESC' = 'ASC'): Promise<UserNutritionDecryptedReturnType[]> => {
    try {
        const results = database.getAllSync<UserNutritionEncryptedReturnType>(`
            SELECT * FROM "UserNutrition"
            WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')
            ORDER BY "date" ${order}
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        return (await Promise.all(results.map(async (row) => {
            try {
                return {
                    ...row,
                    alcohol: parseFloat(await decryptDatabaseValue(row.alcohol)) || 0,
                    calories: parseFloat(await decryptDatabaseValue(row.calories)) || 0,
                    carbohydrate: parseFloat(await decryptDatabaseValue(row.carbohydrate)) || 0,
                    fat: parseFloat(await decryptDatabaseValue(row.fat)) || 0,
                    fiber: parseFloat(await decryptDatabaseValue(row.fiber)) || 0,
                    grams: parseFloat(await decryptDatabaseValue(row.grams)) || 0,
                    mealType: await decryptDatabaseValue(row.mealType) || '',
                    monounsaturatedFat: parseFloat(await decryptDatabaseValue(row.monounsaturatedFat)) || 0,
                    name: await decryptDatabaseValue(row.name) || '',
                    polyunsaturatedFat: parseFloat(await decryptDatabaseValue(row.polyunsaturatedFat)) || 0,
                    protein: parseFloat(await decryptDatabaseValue(row.protein)) || 0,
                    saturatedFat: parseFloat(await decryptDatabaseValue(row.saturatedFat)) || 0,
                    sugar: parseFloat(await decryptDatabaseValue(row.sugar)) || 0,
                    transFat: parseFloat(await decryptDatabaseValue(row.transFat)) || 0,
                    unsaturatedFat: parseFloat(await decryptDatabaseValue(row.unsaturatedFat)) || 0,
                } as unknown as UserNutritionDecryptedReturnType;
            } catch (decryptionError) {
                await deleteUserNutrition(row.id!);
                console.error('Error decrypting data for row:', row, decryptionError);
                return undefined;
            }
        }))).filter((row) => row !== undefined) as UserNutritionDecryptedReturnType[];
    } catch (error) {
        throw error;
    }
};

export const getUserNutritionBetweenDates = async (startDate: string, endDate: string): Promise<UserNutritionDecryptedReturnType[]> => {
    try {
        const results = database.getAllSync<UserNutritionEncryptedReturnType>(`
            SELECT * FROM "UserNutrition"
            WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')
            AND "date" BETWEEN ? AND ?
            ORDER BY "date" ASC
        `, [startDate, endDate]);

        return (await Promise.all(results.map(async (row) => {
            try {
                return {
                    ...row,
                    alcohol: parseFloat(await decryptDatabaseValue(row.alcohol)) || 0,
                    calories: parseFloat(await decryptDatabaseValue(row.calories)) || 0,
                    carbohydrate: parseFloat(await decryptDatabaseValue(row.carbohydrate)) || 0,
                    fat: parseFloat(await decryptDatabaseValue(row.fat)) || 0,
                    fiber: parseFloat(await decryptDatabaseValue(row.fiber)) || 0,
                    grams: parseFloat(await decryptDatabaseValue(row.grams)) || 0,
                    mealType: await decryptDatabaseValue(row.mealType) || '',
                    monounsaturatedFat: parseFloat(await decryptDatabaseValue(row.monounsaturatedFat)) || 0,
                    name: await decryptDatabaseValue(row.name) || '',
                    polyunsaturatedFat: parseFloat(await decryptDatabaseValue(row.polyunsaturatedFat)) || 0,
                    protein: parseFloat(await decryptDatabaseValue(row.protein)) || 0,
                    saturatedFat: parseFloat(await decryptDatabaseValue(row.saturatedFat)) || 0,
                    sugar: parseFloat(await decryptDatabaseValue(row.sugar)) || 0,
                    transFat: parseFloat(await decryptDatabaseValue(row.transFat)) || 0,
                    unsaturatedFat: parseFloat(await decryptDatabaseValue(row.unsaturatedFat)) || 0,
                } as unknown as UserNutritionDecryptedReturnType;
            } catch (decryptionError) {
                await deleteUserNutrition(row.id!);
                console.error('Error decrypting data for row:', row, decryptionError);
                return undefined;
            }
        }))).filter((row) => row !== undefined) as UserNutritionDecryptedReturnType[];
    } catch (error) {
        throw error;
    }
};

export const getUserNutritionOnDate = async (date: string): Promise<UserNutritionDecryptedReturnType[]> => {
    return getUserNutritionBetweenDates(
        getStartOfDayTimestampISOString(date),
        getEndOfDayTimestampISOString(date)
    );
};

export const getUserNutritionFromDate = async (startDate: string): Promise<UserNutritionDecryptedReturnType[]> => {
    try {
        const todayDate = getCurrentTimestampISOString();

        const results = database.getAllSync<UserNutritionEncryptedReturnType>(`
            SELECT * FROM "UserNutrition"
            WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')
            AND "date" BETWEEN ? AND ?
            ORDER BY "date" ASC
        `, [startDate, todayDate]);

        return (await Promise.all(results.map(async (row) => {
            try {
                return {
                    ...row,
                    alcohol: parseFloat(await decryptDatabaseValue(row.alcohol)) || 0,
                    calories: parseFloat(await decryptDatabaseValue(row.calories)) || 0,
                    carbohydrate: parseFloat(await decryptDatabaseValue(row.carbohydrate)) || 0,
                    fat: parseFloat(await decryptDatabaseValue(row.fat)) || 0,
                    fiber: parseFloat(await decryptDatabaseValue(row.fiber)) || 0,
                    grams: parseFloat(await decryptDatabaseValue(row.grams)) || 0,
                    mealType: await decryptDatabaseValue(row.mealType) || '',
                    monounsaturatedFat: parseFloat(await decryptDatabaseValue(row.monounsaturatedFat)) || 0,
                    name: await decryptDatabaseValue(row.name) || '',
                    polyunsaturatedFat: parseFloat(await decryptDatabaseValue(row.polyunsaturatedFat)) || 0,
                    protein: parseFloat(await decryptDatabaseValue(row.protein)) || 0,
                    saturatedFat: parseFloat(await decryptDatabaseValue(row.saturatedFat)) || 0,
                    sugar: parseFloat(await decryptDatabaseValue(row.sugar)) || 0,
                    transFat: parseFloat(await decryptDatabaseValue(row.transFat)) || 0,
                    unsaturatedFat: parseFloat(await decryptDatabaseValue(row.unsaturatedFat)) || 0,
                } as unknown as UserNutritionDecryptedReturnType;
            } catch (decryptionError) {
                await deleteUserNutrition(row.id!);
                console.error('Error decrypting data for row:', row, decryptionError);
                return undefined;
            }
        }))).filter((row) => row !== undefined) as UserNutritionDecryptedReturnType[];
    } catch (error) {
        throw error;
    }
};

export const getTotalUserNutritionCount = async (): Promise<number> => {
    try {
        const result = database.getFirstSync<{ count: number }>(`
            SELECT COUNT(*) as count FROM "UserNutrition"
            WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')
        `);
        return result?.count ?? 0;
    } catch (error) {
        throw error;
    }
};

export const getFood = async (id: number): Promise<FoodReturnType | undefined> => {
    try {
        return database.getFirstSync<FoodReturnType>('SELECT * FROM "Food" WHERE "id" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')', [id]) ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getAllFavoriteFoods = async (): Promise<FoodReturnType[] | undefined> => {
    try {
        return database.getAllSync<FoodReturnType>('SELECT * FROM "Food" WHERE "isFavorite" = 1 AND ("deletedAt" IS NULL OR "deletedAt" = \'\')');
    } catch (error) {
        console.log(error);
    }

    return undefined;
};

export const getAllFoodsByIds = async (ids: number[]): Promise<FoodReturnType[] | undefined> => {
    try {
        return database.getAllSync<FoodReturnType>(`
            SELECT * FROM "Food"
            WHERE "id" IN (${ids.join(',')})
            AND ("deletedAt" IS NULL OR "deletedAt" = '')
        `);
    } catch (error) {
        throw error;
    }
};

export const getFitnessGoals = async (id: number): Promise<FitnessGoalsReturnType | undefined> => {
    try {
        return database.getFirstSync<FitnessGoalsReturnType>('SELECT * FROM "FitnessGoals" WHERE "id" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')', [id]) ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getLatestFitnessGoals = async (): Promise<FitnessGoalsReturnType | null> => {
    try {
        return database.getFirstSync<FitnessGoalsReturnType>(
            'SELECT * FROM "FitnessGoals" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\') ORDER BY "id" DESC LIMIT 1'
        );
    } catch (error) {
        throw error;
    }
};

export const getFitnessGoalsPaginated = async (offset: number, limit: number): Promise<FitnessGoalsReturnType[]> => {
    try {
        return database.getAllSync<FitnessGoalsReturnType>(
            'SELECT * FROM "FitnessGoals" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\') ORDER BY "id" DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );
    } catch (error) {
        throw error;
    }
};

export const getTotalFitnessGoalsCount = async (): Promise<number> => {
    try {
        const result = database.getFirstSync<{ count: number }>(
            'SELECT COUNT(*) as count FROM "FitnessGoals" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')'
        );

        return result?.count ?? 0;
    } catch (error) {
        throw error;
    }
};

export const getMigration = async (id: number): Promise<MigrationReturnType | undefined> => {
    try {
        return database.getFirstSync<MigrationReturnType>('SELECT * FROM "Migration" WHERE "id" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')', [id]) ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getAllMigrations = async (): Promise<MigrationReturnType[] | null> => {
    try {
        return database.getFirstSync<MigrationReturnType[]>('SELECT * FROM "Migration" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')');
    } catch (error) {
        throw error;
    }
};

export const checkIfMigrationExists = async (migration: string): Promise<boolean> => {
    try {
        const result = database.getFirstSync<{ count: number }>(
            'SELECT COUNT(*) as count FROM "Migration" WHERE "migration" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [migration]
        );

        return !!result?.count;
    } catch (error) {
        throw error;
    }
};

export const getFoodByNameAndMacros = async (
    name: string,
    calories: number,
    protein: number,
    totalCarbohydrate: number,
    totalFat: number
): Promise<FoodReturnType | null> => {
    try {
        return database.getFirstSync<FoodReturnType>(
            'SELECT * FROM "Food" WHERE "name" = ? AND "calories" = ? AND "protein" = ? AND "totalCarbohydrate" = ? AND "totalFat" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [name, calories, protein, totalCarbohydrate, totalFat]
        );
    } catch (error) {
        throw error;
    }
};

export const searchFoodByName = async (searchTerm: string): Promise<FoodReturnType[] | null> => {
    try {
        const query = `
            SELECT * FROM "Food"
            WHERE "name" LIKE ? 
            AND ("deletedAt" IS NULL OR "deletedAt" = '')
        `;
        const searchPattern = `%${searchTerm}%`;
        return database.getAllSync<FoodReturnType>(query, [searchPattern]);
    } catch (error) {
        throw error;
    }
};

export const getFoodByProductCode = async (productCode: string): Promise<FoodReturnType | null> => {
    try {
        return database.getFirstSync<FoodReturnType>(
            'SELECT * FROM "Food" WHERE "productCode" = ? AND ("deletedAt" IS NULL OR "deletedAt" = \'\')',
            [productCode]
        );
    } catch (error) {
        console.log(error);
    }

    return null;
};

// Update functions

export const updateUserMeasurements = async (id: number, userMeasurements: UserMeasurementsInsertType): Promise<number> => {
    const existingUserMeasurements = await getUserMeasurements(id);

    try {
        database.runSync(
            'UPDATE "UserMeasurements" SET "createdAt" = ?, "dataId" = ?, "date" = ?, "deletedAt" = ?, "measurements" = ?, "source" = ?, "userId" = ? WHERE "id" = ?',
            [
                userMeasurements.createdAt || existingUserMeasurements?.createdAt || getCurrentTimestampISOString(),
                userMeasurements.dataId || existingUserMeasurements?.dataId || generateHash(),
                userMeasurements.date || existingUserMeasurements?.date || getCurrentTimestampISOString(),
                userMeasurements.deletedAt || existingUserMeasurements?.deletedAt || '',
                JSON.stringify(userMeasurements.measurements || existingUserMeasurements?.measurements || {}),
                userMeasurements.source || existingUserMeasurements?.source || USER_METRICS_SOURCES.USER_INPUT,
                userMeasurements.userId || existingUserMeasurements?.userId || 1,
                id,
            ]
        );

        return id;
    } catch (error) {
        throw error;
    }
};

export const updateExercise = async (id: number, exercise: ExerciseInsertType): Promise<number> => {
    const existingExercise = await getExerciseById(id);

    database.runSync(
        'UPDATE "Exercise" SET "name" = ?, "muscleGroup" = ?, "type" = ?, "description" = ?, "image" = ? WHERE "id" = ?',
        [
            exercise.name || existingExercise?.name || '',
            exercise.muscleGroup || existingExercise?.muscleGroup || '',
            exercise.type || existingExercise?.type || '',
            exercise.description || existingExercise?.description || '',
            exercise.image || existingExercise?.image || '',
            id,
        ]
    );

    return id;
};

export const updateSet = async (id: number, set: SetInsertType): Promise<number> => {
    const existingSet = await getSetById(id);

    database.runSync(
        'UPDATE "Set" SET "reps" = ?, "weight" = ?, "restTime" = ?, "exerciseId" = ?, "isDropSet" = ?, "difficultyLevel" = ?, "workoutId" = ?, "setOrder" = ?, "supersetName" = ? WHERE "id" = ?',
        [
            set.reps || existingSet?.reps || 0,
            set.weight || existingSet?.weight || 0,
            set.restTime || existingSet?.restTime || 0,
            set.exerciseId || existingSet?.exerciseId || 0,
            // set.isDropSet ? 1 : (existingSet?.isDropSet ? 1 : 0),
            set.isDropSet ?? existingSet?.isDropSet ?? 0,
            set.difficultyLevel || existingSet?.difficultyLevel || 5,
            set.workoutId || existingSet?.workoutId || 0,
            set.setOrder || existingSet?.setOrder || 0,
            set.supersetName || existingSet?.supersetName || '',
            id,
        ]
    );

    return id;
};

export const updateSetting = async (id: number, value: string): Promise<number> => {
    try {
        database.runSync('UPDATE "Setting" SET "value" = ? WHERE "id" = ?', [value, id]);
        return 1;
    } catch (error) {
        throw error;
    }
};

export const updateOneRepMax = async (id: number, weight: number): Promise<number> => {
    try {
        database.runSync('UPDATE "OneRepMax" SET "weight" = ? WHERE "id" = ?', [weight, id]);
        return id;
    } catch (error) {
        throw error;
    }
};

const updateUser = async (id: number, user: UserInsertType): Promise<number> => {
    const existingUser = await getUser(id);

    try {
        database.runSync(
            'UPDATE "User" SET "name" = ?, "birthday" = ?, "fitnessGoals" = ?, "activityLevel" = ?, "gender" = ?, "liftingExperience" = ? WHERE "id" = ?',
            [
                user.name || existingUser?.name || '',
                user.birthday || existingUser?.birthday || '',
                user.fitnessGoals || existingUser?.fitnessGoals || '',
                user.activityLevel || existingUser?.activityLevel || '',
                user.gender || existingUser?.gender || '',
                user.liftingExperience || existingUser?.liftingExperience || '',
                id,
            ]
        );

        return id;
    } catch (error) {
        throw error;
    }
};

export const updateUserMetrics = async (id: number, userMetrics: UserMetricsInsertType): Promise<number> => {
    const existingUserMetrics = await getUserMetrics(id);

    try {
        database.runSync(
            'UPDATE "UserMetrics" SET "weight" = ?, "height" = ?, "fatPercentage" = ?, "eatingPhase" = ?, "dataId" = ?, "userId" = ?, "date" = ? WHERE "id" = ?',
            [
                await encryptDatabaseValue(userMetrics.weight?.toString() || existingUserMetrics?.weight?.toString() || ''),
                await encryptDatabaseValue(userMetrics.height?.toString() || existingUserMetrics?.height?.toString() || ''),
                await encryptDatabaseValue(userMetrics.fatPercentage?.toString() || existingUserMetrics?.fatPercentage?.toString() || ''),
                userMetrics.eatingPhase || existingUserMetrics?.eatingPhase || EATING_PHASES.MAINTENANCE,
                userMetrics.dataId || existingUserMetrics?.dataId || generateHash(),
                userMetrics.userId || existingUserMetrics?.userId || 0,
                userMetrics.date || existingUserMetrics?.date || '',
                id,
            ]
        );

        return userMetrics.userId || existingUserMetrics?.userId || 0;
    } catch (error) {
        throw error;
    }
};

export const updateWorkout = async (id: number, workout: WorkoutInsertType): Promise<number> => {
    const existingWorkout = await getWorkoutById(id);

    try {
        database.runSync(
            'UPDATE "Workout" SET "title" = ?, "recurringOnWeek" = ?, "volumeCalculationType" = ?, "description" = ? WHERE "id" = ?',
            [
                workout.title || existingWorkout?.title || '',
                // don't use the exiting one because recurringOnWeek can be removed from a workout
                workout.recurringOnWeek || '',
                workout.volumeCalculationType || existingWorkout?.volumeCalculationType || '',
                workout.description || existingWorkout?.description || '',
                id,
            ]
        );

        return id;
    } catch (error) {
        throw error;
    }
};

export const updateUserNutrition = async (id: number, userNutrition: UserNutritionInsertType): Promise<number> => {
    const existingUserNutrition = await getUserNutrition(id);

    if (!userNutrition.userId) {
        const user = await getLatestUser();
        if (user) {
            userNutrition.userId = user.id!;
        } else {
            console.error('No user found to add metrics to');
            return 0;
        }
    }

    try {
        database.runSync(
            'UPDATE "UserNutrition" SET "name" = ?, "mealType" = ?, "calories" = ?, "protein" = ?, "alcohol" = ?, "carbohydrate" = ?, "sugar" = ?, "fiber" = ?, "fat" = ?, "monounsaturatedFat" = ?, "polyunsaturatedFat" = ?, "saturatedFat" = ?, "transFat" = ?, "unsaturatedFat" = ?, "grams" = ?, "userId" = ?, "date" = ?, "type" = ?, "source" = ? WHERE "id" = ?',
            [
                await encryptDatabaseValue(userNutrition.name || existingUserNutrition?.name || ''),
                await encryptDatabaseValue(userNutrition.mealType?.toString() || existingUserNutrition?.mealType?.toString() || ''),
                await encryptDatabaseValue(userNutrition.calories?.toString() || existingUserNutrition?.calories?.toString() || ''),
                await encryptDatabaseValue(userNutrition.protein?.toString() || existingUserNutrition?.protein?.toString() || ''),
                await encryptDatabaseValue(userNutrition.alcohol?.toString() || existingUserNutrition?.alcohol?.toString() || ''),
                await encryptDatabaseValue(userNutrition.carbohydrate?.toString() || existingUserNutrition?.carbohydrate?.toString() || ''),
                await encryptDatabaseValue(userNutrition.sugar?.toString() || existingUserNutrition?.sugar?.toString() || ''),
                await encryptDatabaseValue(userNutrition.fiber?.toString() || existingUserNutrition?.fiber?.toString() || ''),
                await encryptDatabaseValue(userNutrition.fat?.toString() || existingUserNutrition?.fat?.toString() || ''),
                await encryptDatabaseValue(userNutrition.monounsaturatedFat?.toString() || existingUserNutrition?.monounsaturatedFat?.toString() || ''),
                await encryptDatabaseValue(userNutrition.polyunsaturatedFat?.toString() || existingUserNutrition?.polyunsaturatedFat?.toString() || ''),
                await encryptDatabaseValue(userNutrition.saturatedFat?.toString() || existingUserNutrition?.saturatedFat?.toString() || ''),
                await encryptDatabaseValue(userNutrition.transFat?.toString() || existingUserNutrition?.transFat?.toString() || ''),
                await encryptDatabaseValue(userNutrition.unsaturatedFat?.toString() || existingUserNutrition?.unsaturatedFat?.toString() || ''),
                await encryptDatabaseValue(userNutrition.grams?.toString() || existingUserNutrition?.grams?.toString() || ''),
                userNutrition.userId,
                userNutrition.date || existingUserNutrition?.date || getCurrentTimestampISOString(),
                userNutrition.type || existingUserNutrition?.type || NUTRITION_TYPES.MEAL,
                userNutrition.source || existingUserNutrition?.source || USER_METRICS_SOURCES.USER_INPUT,
                id,
            ]
        );

        return userNutrition.userId;
    } catch (error) {
        throw error;
    }
};

export const updateWorkoutEvent = async (
    id: number,
    workoutEvent: WorkoutEventInsertType
): Promise<number> => {
    const existingWorkoutEvent = await getWorkoutEvent(id);
    if (!existingWorkoutEvent) {
        throw new Error(`WorkoutEvent with id ${id} not found`);
    }

    try {
        database.runSync(`
            UPDATE "WorkoutEvent"
            SET "date" = ?, "duration" = ?, "bodyWeight" = ?, "fatPercentage" = ?, "eatingPhase" = ?, "workoutId" = ?, "title" = ?, "status" = ?, "exerciseData" = ?, "exhaustionLevel" = ?, "workoutScore" = ?, "workoutVolume" = ?, "recurringOnWeek" = ?, "description" = ?, "calories" = ?, "carbohydrate" = ?, "fat" = ?, "protein" = ?, "alcohol" = ?, "fiber" = ?, "createdAt" = ?, "deletedAt" = ?
            WHERE "id" = ?
        `,
        [
            workoutEvent.date,
            workoutEvent.duration || existingWorkoutEvent.duration || 0,
            workoutEvent.bodyWeight || existingWorkoutEvent.bodyWeight || 0,
            workoutEvent.fatPercentage || existingWorkoutEvent.fatPercentage || 0,
            workoutEvent.eatingPhase || existingWorkoutEvent.eatingPhase || EATING_PHASES.MAINTENANCE,
            workoutEvent.workoutId,
            workoutEvent.title || existingWorkoutEvent.title || '',
            workoutEvent.status || existingWorkoutEvent.status || COMPLETED_STATUS,
            workoutEvent.exerciseData || existingWorkoutEvent.exerciseData || '[]',
            workoutEvent.exhaustionLevel || existingWorkoutEvent.exhaustionLevel || 5,
            workoutEvent.workoutScore || existingWorkoutEvent.workoutScore || 5,
            workoutEvent.workoutVolume || existingWorkoutEvent.workoutVolume || '',
            workoutEvent.recurringOnWeek || existingWorkoutEvent.recurringOnWeek || '',
            workoutEvent.description || existingWorkoutEvent.description || '',
            workoutEvent.calories || existingWorkoutEvent.calories || 0,
            workoutEvent.carbohydrate || existingWorkoutEvent.carbohydrate || 0,
            workoutEvent.fat || existingWorkoutEvent.fat || 0,
            workoutEvent.protein || existingWorkoutEvent.protein || 0,
            workoutEvent.alcohol || existingWorkoutEvent.alcohol || 0,
            workoutEvent.fiber || existingWorkoutEvent.fiber || 0,
            workoutEvent.createdAt || existingWorkoutEvent.createdAt || getCurrentTimestampISOString(),
            workoutEvent.deletedAt || existingWorkoutEvent.deletedAt || null,
            id,
        ]
        );

        return id;
    } catch (error) {
        console.error('Error in updateWorkoutEvent:', error);
        throw new Error('Failed to update workout event');
    }
};

export const updateFood = async (id: number, food: FoodInsertType): Promise<number> => {
    const existingFood = await getFood(id);

    try {
        database.runSync(
            'UPDATE "Food" SET "name" = ?, "calories" = ?, "protein" = ?, "alcohol" = ?, "totalCarbohydrate" = ?, "sugar" = ?, "fiber" = ?, "totalFat" = ?, "createdAt" = ?, "deletedAt" = ?, "isFavorite" = ?, "dataId" = ? WHERE "id" = ?',
            [
                food.name || existingFood?.name || '',
                food.calories || existingFood?.calories || 0,
                food.protein || existingFood?.protein || 0,
                food.alcohol || existingFood?.alcohol || 0,
                food.totalCarbohydrate || existingFood?.totalCarbohydrate || 0,
                food.sugar || existingFood?.sugar || 0,
                food.fiber || existingFood?.fiber || 0,
                food.totalFat || existingFood?.totalFat || 0,
                food.createdAt || existingFood?.createdAt || 0,
                food.deletedAt || existingFood?.deletedAt || 0,
                food.isFavorite ?? existingFood?.isFavorite ?? 0,
                // food.isFavorite ? 1 : (existingFood?.isFavorite ? 1 : 0),
                food.dataId || existingFood?.dataId || generateHash(),
                id,
            ]
        );

        return id;
    } catch (error) {
        throw error;
    }
};

export const updateFitnessGoals = async (id: number, fitnessGoals: FitnessGoalsInsertType): Promise<number> => {
    const existingFitnessGoals = await getFitnessGoals(id);

    try {
        database.runSync(
            'UPDATE "FitnessGoals" SET "calories" = ?, "protein" = ?, "alcohol" = ?, "totalCarbohydrate" = ?, "sugar" = ?, "fiber" = ?, "totalFat" = ?, "weight" = ?, "bodyFat" = ?, "bmi" = ?, "ffmi" = ?, "createdAt" = ? WHERE "id" = ?',
            [
                fitnessGoals.calories || existingFitnessGoals?.calories || 0,
                fitnessGoals.protein || existingFitnessGoals?.protein || 0,
                fitnessGoals.alcohol || existingFitnessGoals?.alcohol || 0,
                fitnessGoals.totalCarbohydrate || existingFitnessGoals?.totalCarbohydrate || 0,
                fitnessGoals.sugar || existingFitnessGoals?.sugar || 0,
                fitnessGoals.fiber || existingFitnessGoals?.fiber || 0,
                fitnessGoals.totalFat || existingFitnessGoals?.totalFat || 0,
                fitnessGoals.weight || existingFitnessGoals?.weight || 0,
                fitnessGoals.bodyFat || existingFitnessGoals?.bodyFat || 0,
                fitnessGoals.bmi || existingFitnessGoals?.bmi || 0,
                fitnessGoals.ffmi || existingFitnessGoals?.ffmi || 0,
                fitnessGoals.createdAt || existingFitnessGoals?.createdAt || getCurrentTimestampISOString(),
            ]);

        return id;
    } catch (error) {
        throw error;
    }
};

// Delete functions

export const deleteUserMeasurements = async (id: number): Promise<void> => {
    try {
        database.runSync('DELETE FROM "UserMeasurements" WHERE "id" = ?', [id]);
    } catch (error) {
        throw error;
    }
};

export const deleteSetOnly = async (id: number): Promise<void> => {
    database.runSync('DELETE FROM "Set" WHERE "id" = ?', [id]);
};

export const deleteUserNutrition = async (id: number): Promise<void> => {
    try {
        database.runSync('DELETE FROM "UserNutrition" WHERE "id" = ?', [id]);
    } catch (error) {
        throw error;
    }
};

export const deleteUserMetrics = async (id: number): Promise<void> => {
    try {
        database.runSync(
            'DELETE FROM "UserMetrics" WHERE "id" = ?',
            [id]
        );
    } catch (error) {
        throw error;
    }
};

export const deleteHealthConnectUserNutritionBetweenDates = async (startDate: string, endDate: string) => {
    try {
        await database.runSync(
            `DELETE FROM "UserNutrition"
             WHERE "source" = ? AND "date" BETWEEN ? AND ?`,
            [USER_METRICS_SOURCES.HEALTH_CONNECT, startDate, endDate]
        );
    } catch (error) {
        throw error;
    }
};

export const deleteHealthConnectUserMetricsBetweenDates = async (startDate: string, endDate: string) => {
    try {
        await database.runSync(
            `DELETE FROM "UserMetrics"
             WHERE "source" = ? AND "date" BETWEEN ? AND ?`,
            [USER_METRICS_SOURCES.HEALTH_CONNECT, startDate, endDate]
        );
    } catch (error) {
        throw error;
    }
};

export const deleteSetting = async (type: string): Promise<void> => {
    try {
        database.runSync('DELETE FROM "Setting" WHERE "type" = ?', [type]);
    } catch (error) {
        throw error;
    }
};

export const deleteSet = async (id: number): Promise<void> => {
    database.runSync('DELETE FROM "Set" WHERE "id" = ?', [id]);
};

export const deleteExercise = async (id: number): Promise<void> => {
    try {
        database.runSync('DELETE FROM "Exercise" WHERE "id" = ?', [id]);
    } catch (error) {
        throw error;
    }
};

export const deleteWorkoutEvent = async (id: number): Promise<void> => {
    try {
        database.runSync('DELETE FROM "WorkoutEvent" WHERE "id" = ?', [id]);
    } catch (error) {
        throw error;
    }
};

export const deleteWorkout = async (id: number): Promise<void> => {
    try {
        database.runSync('DELETE FROM "Workout" WHERE "id" = ?', [id]);
    } catch (error) {
        throw error;
    }
};

export const deleteAllUserMetricsFromHealthConnect = async (): Promise<void> => {
    try {
        database.runSync('DELETE FROM "UserMetrics" WHERE "source" = ?', [USER_METRICS_SOURCES.HEALTH_CONNECT]);
    } catch (error) {
        throw error;
    }
};

export const deleteAllUserNutritionFromHealthConnect = async (): Promise<void> => {
    try {
        database.runSync('DELETE FROM "UserNutrition" WHERE "source" = ?', [USER_METRICS_SOURCES.HEALTH_CONNECT]);
    } catch (error) {
        throw error;
    }
};

export const deleteChatById = async (id: number): Promise<void> => {
    try {
        database.runSync('DELETE FROM "Chat" WHERE "id" = ?', [id]);
    } catch (error) {
        throw error;
    }
};

export const deleteFood = async (id: number): Promise<void> => {
    try {
        database.runSync('DELETE FROM "Food" WHERE "id" = ?', [id]);
    } catch (error) {
        throw error;
    }
};

export const deleteFitnessGoals = async (id: number): Promise<void> => {
    try {
        database.runSync('DELETE FROM "FitnessGoals" WHERE "id" = ?', [id]);
    } catch (error) {
        throw error;
    }
};

// Misc functions

export const countExercises = async (): Promise<number> => {
    try {
        const result = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM "Exercise"');
        return result?.count ?? 0;
    } catch (error) {
        console.error('Error counting exercises:', error);
        throw error;
    }
};

export const countChatMessages = async (): Promise<number> => {
    try {
        const result = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM "Chat"');
        return result?.count ?? 0;
    } catch (error) {
        console.error('Error counting chat messages:', error);
        throw error;
    }
};

export const processWorkoutPlan = async (workoutPlan: WorkoutPlan): Promise<void> => {
    const existingExercises = await getAllExercises();
    const exerciseMap: { [name: string]: ExerciseReturnType } = {};

    // Map existing exercises by normalized name for quick lookup
    for (const exercise of existingExercises) {
        if (exercise.name) {
            exerciseMap[normalizeName(exercise.name)] = exercise;
        }
    }

    for (const workout of workoutPlan.workoutPlan) {
        const newWorkout: WorkoutInsertType = {
            createdAt: getCurrentTimestampISOString(),
            description: workout.description || '',
            title: workout.title,
            volumeCalculationType: VOLUME_CALCULATION_TYPES.NONE,
        };

        // Create the workout and get the workoutId
        const workoutId = await addWorkout(newWorkout);

        let setOrder = 0; // Initialize set order for the workout

        for (const planExercise of workout.exercises) {
            let exercise: ExerciseReturnType | undefined;
            const normalizedExerciseName = normalizeName(planExercise.name);

            // Check if the exercise already exists; if not, create it
            if (exerciseMap[normalizedExerciseName]) {
                exercise = exerciseMap[normalizedExerciseName];
            } else {
                const exerciseId = await addExercise({
                    createdAt: getCurrentTimestampISOString(),
                    description: '',
                    image: '',
                    muscleGroup: '',
                    name: planExercise.name,
                    type: '',
                });
                exercise = await getExerciseById(exerciseId);

                if (exercise) {
                    exerciseMap[normalizedExerciseName] = exercise;
                }
            }

            // Calculate weight based on one-rep max percentage
            const oneRepMax = await getOneRepMax(exercise?.id!);
            const oneRepMaxWeight = oneRepMax ? oneRepMax.weight : 60; // Default to 60 if no one-rep max
            const oneRepMaxPercentage = planExercise.oneRepMaxPercentage || 60; // Default to 60%
            const calculatedWeight = oneRepMaxWeight * (oneRepMaxPercentage / 100);

            const reps = planExercise.reps ?? 12; // Default to 12 reps
            const sets = planExercise.sets ?? 3; // Default to 3 sets
            const restTime = planExercise.restTime ?? 60; // Default to 60 seconds rest

            // Add sets for the exercise
            for (let i = 0; i < sets; i++) {
                const set: SetInsertType = {
                    createdAt: getCurrentTimestampISOString(),
                    exerciseId: exercise?.id!,
                    isDropSet: false,
                    reps,
                    restTime,
                    setOrder: setOrder++,
                    supersetName: '',
                    weight: calculatedWeight,
                    workoutId: workoutId,
                };

                await addSet(set);
            }
        }
    }
};

export const clearDatabase = async (): Promise<void> => {
    try {
        database.runSync('DELETE FROM "Exercise"');
        database.runSync('DELETE FROM "Set"');
        database.runSync('DELETE FROM "Workout"');
        database.runSync('DELETE FROM "User"');
        database.runSync('DELETE FROM "UserMetrics"');
        database.runSync('DELETE FROM "Chat"');
        database.runSync('DELETE FROM "WorkoutEvent"');
        database.runSync('DELETE FROM "WorkoutExercise"');
        // database.runSync('DELETE FROM "Setting"');
        // database.runSync('DELETE FROM "Bio"');
    } catch (error) {
        console.error('Error clearing database:', error);
        throw error;
    }
};

export const getTableNames = async (): Promise<string[]> => {
    try {
        const query = 'SELECT name FROM sqlite_master WHERE type=\'table\'';
        const result = database.getAllSync(query);
        return result.map((table: any) => table.name);
    } catch (error) {
        console.error('Error getting table names:', error);
        throw error;
    }
};

export const getAllDataFromTables = async (tableNames: string[]): Promise<string> => {
    try {
        const dbData: any = {};

        for (const tableName of tableNames) {
            const query = `SELECT * FROM "${tableName}"`;
            dbData[tableName] = database.getAllSync(query);
        }

        return JSON.stringify(dbData, null, 2);
    } catch (error) {
        console.error('Error getting all data from tables:', error);
        throw error;
    }
};

export const dumpDatabase = async (encryptionPhrase?: string): Promise<string> => {
    try {
        const tableNamesQuery = 'SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\';';
        const tableNamesResult = database.getAllSync(tableNamesQuery);
        const tableNames = tableNamesResult.map((table: any) => table.name);

        const dbData: any = {};

        for (const tableName of tableNames) {
            let query = `SELECT * FROM "${tableName}"`;
            if (tableName === 'Setting') {
                query = `SELECT * FROM "${tableName}" WHERE "type" NOT IN ('${OPENAI_API_KEY_TYPE}', '${GEMINI_API_KEY_TYPE}')`;
            }

            const tableData = database.getAllSync(query);

            // Decrypt data if necessary
            if (tableName === 'UserMetrics' || tableName === 'UserNutrition') {
                dbData[tableName] = await Promise.all(tableData.map(async (row: unknown) => {
                    if (tableName === 'UserMetrics') {
                        (row as UserMetricsDecryptedReturnType).weight = parseFloat(await decryptDatabaseValue((row as UserMetricsEncryptedReturnType).weight));
                        (row as UserMetricsDecryptedReturnType).height = parseFloat(await decryptDatabaseValue((row as UserMetricsEncryptedReturnType).height));
                        (row as UserMetricsDecryptedReturnType).fatPercentage = parseFloat(await decryptDatabaseValue((row as UserMetricsEncryptedReturnType).fatPercentage));
                    }

                    if (tableName === 'UserNutrition') {
                        (row as UserNutritionDecryptedReturnType).calories = parseFloat(await decryptDatabaseValue((row as UserNutritionEncryptedReturnType).calories));
                        (row as UserNutritionDecryptedReturnType).protein = parseFloat(await decryptDatabaseValue((row as UserNutritionEncryptedReturnType).protein));
                        (row as UserNutritionDecryptedReturnType).carbohydrate = parseFloat(await decryptDatabaseValue((row as UserNutritionEncryptedReturnType).carbohydrate));
                        (row as UserNutritionDecryptedReturnType).sugar = parseFloat(await decryptDatabaseValue((row as UserNutritionEncryptedReturnType).sugar));
                        (row as UserNutritionDecryptedReturnType).fiber = parseFloat(await decryptDatabaseValue((row as UserNutritionEncryptedReturnType).fiber));
                        (row as UserNutritionDecryptedReturnType).fat = parseFloat(await decryptDatabaseValue((row as UserNutritionEncryptedReturnType).fat));
                        (row as UserNutritionDecryptedReturnType).alcohol = parseFloat(await decryptDatabaseValue((row as UserNutritionEncryptedReturnType).alcohol));
                        (row as UserNutritionDecryptedReturnType).monounsaturatedFat = parseFloat(await decryptDatabaseValue((row as UserNutritionEncryptedReturnType).monounsaturatedFat));
                        (row as UserNutritionDecryptedReturnType).polyunsaturatedFat = parseFloat(await decryptDatabaseValue((row as UserNutritionEncryptedReturnType).polyunsaturatedFat));
                        (row as UserNutritionDecryptedReturnType).saturatedFat = parseFloat(await decryptDatabaseValue((row as UserNutritionEncryptedReturnType).saturatedFat));
                        (row as UserNutritionDecryptedReturnType).transFat = parseFloat(await decryptDatabaseValue((row as UserNutritionEncryptedReturnType).transFat));
                        (row as UserNutritionDecryptedReturnType).unsaturatedFat = parseFloat(await decryptDatabaseValue((row as UserNutritionEncryptedReturnType).unsaturatedFat));
                        (row as UserNutritionDecryptedReturnType).name = await decryptDatabaseValue((row as UserNutritionEncryptedReturnType).name);
                        (row as UserNutritionDecryptedReturnType).mealType = parseFloat(await decryptDatabaseValue((row as UserNutritionEncryptedReturnType).mealType));
                        (row as UserNutritionDecryptedReturnType).grams = parseFloat(await decryptDatabaseValue((row as UserNutritionEncryptedReturnType).grams));
                    }

                    return row;
                }));
            } else {
                dbData[tableName] = tableData;
            }
        }

        let jsonData = JSON.stringify(dbData);
        if (encryptionPhrase) {
            jsonData = await encrypt(jsonData, encryptionPhrase);
        }

        return jsonData;
    } catch (error) {
        console.error('Error dumping database:', error);
        throw error;
    }
};

export const restoreDatabase = async (dump: string, decryptionPhrase?: string): Promise<void> => {
    console.log('Restoring database...');
    try {
        if (decryptionPhrase) {
            dump = await decrypt(dump, decryptionPhrase);
        }

        const dbData: Record<string, Record<string, null | number | string>[]> = JSON.parse(dump);
        database.runSync('PRAGMA foreign_keys = OFF;');

        for (const tableName of Object.keys(dbData)) {
            const tableData: Record<string, null | number | string>[] = dbData[tableName];
            if (tableName === 'Versioning') {
                continue;
            }

            if (!(await tableExists(tableName))) {
                console.log(`Table ${tableName} does not exist, creating it...`);
                continue;
            }

            if (['Chat', 'Setting', 'UserMeasurements', 'UserMetrics', 'UserNutrition'].includes(tableName)) {
                database.runSync(`DELETE FROM "${tableName}";`);
                database.runSync(`DELETE FROM sqlite_sequence WHERE name = "${tableName}";`);
            } else {
                database.runSync(`DELETE FROM "${tableName}";`);
            }

            for (const row of tableData) {
                // console.log('THE ROW:', row);
                const columns = Object.keys(row)
                    .map((column) => `"${column}"`)
                    .join(', ');

                if (!columns) {
                    console.error(`No columns found for table ${tableName}`);
                    continue;
                }

                if (tableName === 'UserMetrics' || tableName === 'UserNutrition') {
                    if (tableName === 'UserMetrics') {
                        if (row.weight) {
                            row.weight = await encryptDatabaseValue(row.weight?.toString() || '');
                        }

                        if (row.height) {
                            row.height = await encryptDatabaseValue(row.height?.toString() || '');
                        }

                        if (row.fatPercentage) {
                            row.fatPercentage = await encryptDatabaseValue(row.fatPercentage?.toString() || '');
                        }
                    } else if (tableName === 'UserNutrition') {
                        if (row.calories) {
                            row.calories = await encryptDatabaseValue(row.calories?.toString() || '');
                        }

                        if (row.protein) {
                            row.protein = await encryptDatabaseValue(row.protein?.toString() || '');
                        }

                        if (row.alcohol) {
                            row.alcohol = await encryptDatabaseValue(row.alcohol?.toString() || '');
                        }

                        if (row.carbohydrate) {
                            row.carbohydrate = await encryptDatabaseValue(row.carbohydrate?.toString() || '');
                        }

                        if (row.sugar) {
                            row.sugar = await encryptDatabaseValue(row.sugar?.toString() || '');
                        }

                        if (row.fiber) {
                            row.fiber = await encryptDatabaseValue(row.fiber?.toString() || '');
                        }

                        if (row.fat) {
                            row.fat = await encryptDatabaseValue(row.fat?.toString() || '');
                        }

                        if (row.monounsaturatedFat) {
                            row.monounsaturatedFat = await encryptDatabaseValue(row.monounsaturatedFat?.toString() || '');
                        }

                        if (row.polyunsaturatedFat) {
                            row.polyunsaturatedFat = await encryptDatabaseValue(row.polyunsaturatedFat?.toString() || '');
                        }

                        if (row.saturatedFat) {
                            row.saturatedFat = await encryptDatabaseValue(row.saturatedFat?.toString() || '');
                        }

                        if (row.transFat) {
                            row.transFat = await encryptDatabaseValue(row.transFat?.toString() || '');
                        }

                        if (row.unsaturatedFat) {
                            row.unsaturatedFat = await encryptDatabaseValue(row.unsaturatedFat?.toString() || '');
                        }

                        if (row.name) {
                            row.name = await encryptDatabaseValue(row.name?.toString() || '');
                        }

                        if (row.mealType) {
                            row.mealType = await encryptDatabaseValue(row.mealType?.toString() || '');
                        }

                        if (row.grams) {
                            row.grams = await encryptDatabaseValue(row.grams?.toString() || '');
                        }
                    }
                }

                const values = Object.values(row).map((value: null | number | string | undefined) => {
                    if (typeof value === 'string') {
                        return `'${value.replace(/'/g, "''")}'`;
                    } else if (value === null || value === undefined) {
                        return 'NULL';
                    } else {
                        return value;
                    }
                })
                    .join(', ');

                if (!values) {
                    console.error(`No values found for table ${tableName}`);
                    continue;
                }

                const query = `INSERT INTO "${tableName}" (${columns}) VALUES (${values})`;

                // if (tableName === 'Set') {
                //     console.log(`Running query: ${query}`);
                // }
                // console.log(`Inserting row into table ${tableName}`);
                database.runSync(query);
            }
        }

        database.runSync('PRAGMA foreign_keys = ON;');
    } catch (error) {
        console.error('Error restoring database:', error);
        throw error;
    }

    console.log('Database restored successfully.');
};

// Migrations

const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
    try {
        const result = await database.getAllSync<{ name: string }>(
            `PRAGMA table_info("${tableName}");`
        );
        return result.some((column) => column.name.toLowerCase() === columnName.toLowerCase());
    } catch (error) {
        console.error(`Error checking if column "${columnName}" exists in table "${tableName}":`, error);
        throw error;
    }
};

const tableExists = async (tableName: string): Promise<boolean> => {
    try {
        const result = await database.getFirstSync<{ name: string }>(
            'SELECT name FROM sqlite_master WHERE type=\'table\' AND name=?;',
            [tableName]
        );

        return !!result;
    } catch (error) {
        console.error(`Error checking if table "${tableName}" exists:`, error);
        throw error;
    }
};

export const addUserMeasurementsTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersion();
    if (currentVersion && currentVersion < packageJson.version) {
        if (!(await tableExists('UserMeasurements'))) {
            await database.execAsync(`
                CREATE TABLE "UserMeasurements" (
                    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                    "dataId" TEXT,
                    "measurements" TEXT,
                    "userId" INTEGER,
                    "date" TEXT,
                    "source" TEXT,
                    "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP,
                    "deletedAt" TEXT
                );
            `);
        }
    }
};

export const createNewWorkoutTables = async (): Promise<void> => {
    const currentVersion = await getLatestVersion();

    if (!(await tableExists('WorkoutExercise'))) {
        return;
    }

    // Check if migration is needed
    if (currentVersion && currentVersion < packageJson.version) {
        try {
            console.log('Starting migration for workout tables.');

            // 1. Read all current workout data with exercises and sets
            const workouts = await database.getAllSync(`
                SELECT * FROM "Workout" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')
            `) as WorkoutReturnType[];

            const workoutExercises = await database.getAllSync(`
                SELECT * FROM "WorkoutExercise" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')
            `) as {
                createdAt?: string;
                deletedAt?: string;
                exerciseId: number;
                id: number;
                order: number;
                setIds: number[];
                workoutId: number;
            }[];

            const sets = await database.getAllSync(`
                SELECT * FROM "Set" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')
            `) as SetReturnType[];

            // Check for duplicate set IDs
            const setIds = sets.map((set) => set.id);
            const uniqueSetIds = new Set(setIds);
            if (uniqueSetIds.size !== setIds.length) {
                throw new Error('Duplicate set.id values detected.');
            }

            // Map sets to their respective exercises and workouts
            const workoutData = workouts.map((workout) => {
                const exercises = workoutExercises
                    .filter((we) => we.workoutId === workout.id)
                    .map((we, exerciseIndex) => {
                        const exerciseSets = sets
                            .filter((set) => we.setIds.includes(set.id))
                            .map((set, setIndex) => ({
                                ...set,
                                setOrder: exerciseIndex + setIndex,
                                supersetName: '',
                                workoutId: workout.id,
                            }));
                        return { ...we, sets: exerciseSets };
                    });
                return { ...workout, exercises };
            });

            console.log('Retrieved existing workout data for migration.');

            // 2. Apply schema changes

            // a. Add 'workoutId' column to 'Set' table if it doesn't exist
            const hasWorkoutId = await columnExists('Set', 'workoutId');
            if (!hasWorkoutId) {
                await database.runSync('ALTER TABLE "Set" ADD COLUMN "workoutId" INTEGER DEFAULT 0;');
                console.log('Added "workoutId" column to "Set" table.');
            }

            // b. Add 'setOrder' column to 'Set' table if it doesn't exist
            const hasSetOrder = await columnExists('Set', 'setOrder');
            if (!hasSetOrder) {
                await database.runSync('ALTER TABLE "Set" ADD COLUMN "setOrder" INTEGER DEFAULT 0;');
                console.log('Added "setOrder" column to "Set" table.');
            }

            // c. Add 'supersetName' column to 'Set' table if it doesn't exist
            const hasSupersetName = await columnExists('Set', 'supersetName');
            if (!hasSupersetName) {
                await database.runSync('ALTER TABLE "Set" ADD COLUMN "supersetName" TEXT DEFAULT "";');
                console.log('Added "supersetName" column to "Set" table.');
            }

            // d. Remove 'workoutExerciseIds' column from 'Workout' table if it exists
            const hasWorkoutExerciseIds = await columnExists('Workout', 'workoutExerciseIds');
            if (hasWorkoutExerciseIds) {
                // SQLite does not support DROP COLUMN directly. Perform the following steps:
                // a. Create a new temporary table without the 'workoutExerciseIds' column.
                await database.runSync(`
                    CREATE TABLE IF NOT EXISTS "Workout_temp" (
                        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                        "title" TEXT,
                        "description" TEXT,
                        "volumeCalculationType" TEXT,
                        "recurringOnWeek" TEXT,
                        "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP,
                        "deletedAt" TEXT
                    );
                `);
                console.log('Created temporary "Workout_temp" table without "workoutExerciseIds".');

                // b. Copy data from the original 'Workout' table to the temporary table.
                await database.runSync(`
                    INSERT INTO "Workout_temp" ("id", "title", "description", "volumeCalculationType", "recurringOnWeek", "createdAt", "deletedAt")
                    SELECT "id", "title", "description", "volumeCalculationType", "recurringOnWeek", "createdAt", "deletedAt"
                    FROM "Workout";
                `);
                console.log('Copied data from "Workout" to "Workout_temp".');

                // c. Drop the original 'Workout' table.
                await database.runSync('DROP TABLE "Workout";');
                console.log('Dropped original "Workout" table.');

                // d. Drop the original 'WorkoutExercise' table.
                if (await tableExists('WorkoutExercise')) {
                    await database.runSync('DROP TABLE "WorkoutExercise";');
                    console.log('Dropped original "WorkoutExercise" table.');
                }

                // e. Rename the temporary table to 'Workout'.
                await database.runSync('ALTER TABLE "Workout_temp" RENAME TO "Workout";');
                console.log('Renamed "Workout_temp" to "Workout".');
            }

            // 3. Clear existing data in the Set and Workout tables
            await database.runSync('DELETE FROM "Set";');
            await database.runSync('DELETE FROM "Workout";');
            console.log("Cleared existing data from 'Set' and 'Workout' tables.");

            // a. Reset autoincrement for 'Set' table
            await database.runSync('DELETE FROM sqlite_sequence WHERE name="Set";');

            // b. Reset autoincrement for 'Workout' table
            await database.runSync('DELETE FROM sqlite_sequence WHERE name="Workout";');
            console.log('Reset autoincrement for "Set" and "Workout" tables.');

            // 4. Insert data back with the new structure and keep track of new workout and set IDs
            const workoutIdMapping: Record<number, number> = {}; // Map old workoutId -> new workoutId
            const setIdMapping: Record<number, number> = {}; // Map old setId -> new setId

            for (const workout of workoutData) {
                const workoutResult = await database.runSync(
                    'INSERT INTO "Workout" ("id", "title", "description", "volumeCalculationType", "recurringOnWeek", "createdAt", "deletedAt") VALUES (?, ?, ?, ?, ?, ?, ?)',
                    workout.id,
                    workout.title,
                    workout.description || '',
                    workout.volumeCalculationType,
                    workout.recurringOnWeek || '',
                    workout.createdAt || getCurrentTimestampISOString(),
                    workout.deletedAt || ''
                );

                // Map old workoutId to new workoutId
                workoutIdMapping[workout.id] = workoutResult.lastInsertRowId;

                let setOrder = 0;
                for (const exercise of workout.exercises) {
                    setOrder += 1;
                    for (const set of exercise.sets) {
                        const setResult = await database.runSync(
                            `INSERT INTO "Set" (
                                "id", 
                                "reps", 
                                "weight", 
                                "restTime", 
                                "exerciseId", 
                                "difficultyLevel", 
                                "isDropSet", 
                                "createdAt", 
                                "deletedAt", 
                                "workoutId", 
                                "setOrder", 
                                "supersetName"
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET 
                                "reps"=excluded."reps",
                                "weight"=excluded."weight",
                                "restTime"=excluded."restTime",
                                "exerciseId"=excluded."exerciseId",
                                "difficultyLevel"=excluded."difficultyLevel",
                                "isDropSet"=excluded."isDropSet",
                                "createdAt"=excluded."createdAt",
                                "deletedAt"=excluded."deletedAt",
                                "workoutId"=excluded."workoutId",
                                "setOrder"=excluded."setOrder",
                                "supersetName"=excluded."supersetName";`,
                            set.id,
                            set.reps,
                            set.weight,
                            set.restTime,
                            set.exerciseId,
                            set.difficultyLevel || 5,
                            set.isDropSet || false,
                            set.createdAt || getCurrentTimestampISOString(),
                            set.deletedAt || null,
                            workoutResult.lastInsertRowId,
                            setOrder++,
                            set.supersetName
                        );

                        setIdMapping[set.id] = setResult.lastInsertRowId;
                    }
                }
            }
            console.log("Reinserted data into 'Workout' and 'Set' tables with the new structure.");

            // 5. Update `WorkoutEvent` table to reflect new `workoutId` and update `exerciseData`
            const workoutEvents = await database.getAllSync(`
                SELECT * FROM "WorkoutEvent" WHERE ("deletedAt" IS NULL OR "deletedAt" = \'\')
            `) as WorkoutEventReturnType[];

            for (const event of workoutEvents) {
                const newWorkoutId = workoutIdMapping[event.workoutId];
                if (newWorkoutId) {
                    // Update workoutId in WorkoutEvent table
                    await database.runSync(
                        'UPDATE "WorkoutEvent" SET "workoutId" = ? WHERE "id" = ?',
                        newWorkoutId,
                        event.id
                    );

                    // Update exerciseData field
                    const exerciseData = JSON.parse(event.exerciseData || '[]') as ExerciseVolumeType[];
                    const updatedExerciseData = exerciseData.map((exercise) => ({
                        ...exercise,
                        // exerciseId: exercise.exerciseId,
                        sets: exercise.sets.map((set) => ({
                            ...set,
                            setId: setIdMapping[set.setId],
                            workoutId: newWorkoutId,
                        })),
                    }));

                    // Save updated exerciseData back to WorkoutEvent table
                    await database.runSync(
                        'UPDATE "WorkoutEvent" SET "exerciseData" = ? WHERE "id" = ?',
                        JSON.stringify(updatedExerciseData),
                        event.id
                    );
                }
            }
            console.log('Updated "WorkoutEvent" table with new workout IDs and updated exerciseData.');
        } catch (error) {
            console.error('Error in migrateWorkoutTables:', error);
            throw error;
        }
    } else {
        console.log('No migration needed for workout tables.');
    }
};

export const addMealTypeGramsToUserNutritionTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersion();
    if (currentVersion && currentVersion < packageJson.version) {
        if (!(await columnExists('UserNutrition', 'mealType'))) {
            await database.execAsync('ALTER TABLE "UserNutrition" ADD COLUMN "mealType" TEXT NULLABLE');
        }

        if (!(await columnExists('UserNutrition', 'grams'))) {
            await database.execAsync('ALTER TABLE "UserNutrition" ADD COLUMN "grams" TEXT NULLABLE');
        }
    }
};

export const addAlcoholMacroToUserNutritionTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersion();
    if (currentVersion && currentVersion < packageJson.version) {
        if (!(await columnExists('UserNutrition', 'alcohol'))) {
            await database.execAsync('ALTER TABLE "UserNutrition" ADD COLUMN "alcohol" TEXT NULLABLE');
        }
    }
};

export const addAlcoholAndFiberMacroToWorkoutEventTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersion();
    if (currentVersion && currentVersion < packageJson.version) {
        if (!(await columnExists('WorkoutEvent', 'alcohol'))) {
            await database.execAsync('ALTER TABLE "WorkoutEvent" ADD COLUMN "alcohol" REAL DEFAULT 0');
        }

        if (!(await columnExists('WorkoutEvent', 'fiber'))) {
            await database.execAsync('ALTER TABLE "WorkoutEvent" ADD COLUMN "fiber" REAL DEFAULT 0');
        }
    }
};

export const addMacrosToWorkoutEventTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersion();
    if (currentVersion && currentVersion < packageJson.version) {
        if (!(await columnExists('WorkoutEvent', 'protein'))) {
            await database.execAsync('ALTER TABLE "WorkoutEvent" ADD COLUMN "protein" REAL DEFAULT 0');
        }

        if (!(await columnExists('WorkoutEvent', 'carbohydrate'))) {
            await database.execAsync('ALTER TABLE "WorkoutEvent" ADD COLUMN "carbohydrate" REAL DEFAULT 0');
        }

        if (!(await columnExists('WorkoutEvent', 'fat'))) {
            await database.execAsync('ALTER TABLE "WorkoutEvent" ADD COLUMN "fat" REAL DEFAULT 0');
        }

        if (!(await columnExists('WorkoutEvent', 'calories'))) {
            await database.execAsync('ALTER TABLE "WorkoutEvent" ADD COLUMN "calories" REAL DEFAULT 0');
        }
    }
};

export const addIsFavoriteToFoodTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersion();
    if (currentVersion && currentVersion < packageJson.version) {
        if (!(await columnExists('Food', 'isFavorite'))) {
            await database.execAsync('ALTER TABLE "Food" ADD COLUMN "isFavorite" INTEGER DEFAULT 0');
        }
    }
};

export const createFoodTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersion();
    if (currentVersion && currentVersion < packageJson.version) {
        if (!(await tableExists('Food'))) {
            await database.execAsync(`
                CREATE TABLE "Food" (
                    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                    "dataId" TEXT,
                    "name" TEXT,
                    "calories" REAL,
                    "protein" REAL,
                    "alcohol" REAL,
                    "totalCarbohydrate" REAL,
                    "sugar" REAL,
                    "fiber" REAL,
                    "totalFat" REAL,
                    "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP,
                    "deletedAt" TEXT,
                    "servingSize" REAL,
                    "brand" TEXT NULLABLE,
                    "productCode" TEXT NULLABLE,
                    "zinc" REAL NULLABLE DEFAULT 0,
                    "vitaminK" REAL NULLABLE DEFAULT 0,
                    "vitaminC" REAL NULLABLE DEFAULT 0,
                    "vitaminB12" REAL NULLABLE DEFAULT 0,
                    "vitaminA" REAL NULLABLE DEFAULT 0,
                    "unsaturatedFat" REAL NULLABLE DEFAULT 0,
                    "vitaminE" REAL NULLABLE DEFAULT 0,
                    "thiamin" REAL NULLABLE DEFAULT 0,
                    "selenium" REAL NULLABLE DEFAULT 0,
                    "polyunsaturatedFat" REAL NULLABLE DEFAULT 0,
                    "vitaminB6" REAL NULLABLE DEFAULT 0,
                    "pantothenicAcid" REAL NULLABLE DEFAULT 0,
                    "niacin" REAL NULLABLE DEFAULT 0,
                    "monounsaturatedFat" REAL NULLABLE DEFAULT 0,
                    "calcium" REAL NULLABLE DEFAULT 0,
                    "iodine" REAL NULLABLE DEFAULT 0,
                    "molybdenum" REAL NULLABLE DEFAULT 0,
                    "vitaminD" REAL NULLABLE DEFAULT 0,
                    "manganese" REAL NULLABLE DEFAULT 0,
                    "magnesium" REAL NULLABLE DEFAULT 0,
                    "transFat" REAL NULLABLE DEFAULT 0,
                    "folicAcid" REAL NULLABLE DEFAULT 0,
                    "copper" REAL NULLABLE DEFAULT 0,
                    "iron" REAL NULLABLE DEFAULT 0,
                    "saturatedFat" REAL NULLABLE DEFAULT 0,
                    "chromium" REAL NULLABLE DEFAULT 0,
                    "caffeine" REAL NULLABLE DEFAULT 0,
                    "cholesterol" REAL NULLABLE DEFAULT 0,
                    "phosphorus" REAL NULLABLE DEFAULT 0,
                    "chloride" REAL NULLABLE DEFAULT 0,
                    "folate" REAL NULLABLE DEFAULT 0,
                    "biotin" REAL NULLABLE DEFAULT 0,
                    "sodium" REAL NULLABLE DEFAULT 0,
                    "riboflavin" REAL NULLABLE DEFAULT 0,
                    "potassium" REAL NULLABLE DEFAULT 0,
                );
            `);
        }
    }
};

export const createFitnessGoalsTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersion();
    if (currentVersion && currentVersion < packageJson.version) {
        if (!(await tableExists('FitnessGoals'))) {
            await database.execAsync(`
                CREATE TABLE "FitnessGoals" (
                    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                    "calories" REAL,
                    "protein" REAL,
                    "alcohol" REAL,
                    "totalCarbohydrate" REAL,
                    "sugar" REAL,
                    "fiber" REAL,
                    "totalFat" REAL,
                    "weight" REAL,
                    "bodyFat" REAL,
                    "bmi" REAL,
                    "ffmi" REAL,
                    "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP,
                    "deletedAt" TEXT
                );
            `);
        }
    }
};

export const createMigrationsTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersion();
    if (currentVersion && currentVersion < packageJson.version) {
        if (!(await tableExists('Migrations'))) {
            await database.execAsync(`
                CREATE TABLE "Migrations" (
                    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                    "migration" TEXT,
                    "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP,
                    "deletedAt" TEXT NULLABLE
                );
            `);
        }

        await createMigration('createMigrationsTable');
    }
};

// Functions that are exactly the same

const commonFunctions = getCommonFunctions({
    addChatRaw,
    addExercise,
    addSet,
    addSetting,
    addUserMetrics,
    addUserNutrition,
    addWorkout,
    addWorkoutEvent,
    countChatMessages,
    countExercises,
    getAllExercises,
    getAllWorkoutsWithTrashed,
    getExerciseById,
    getSetById,
    getSetsByWorkoutId,
    getUser,
    getWorkoutByIdWithTrashed,
    updateSet,
    updateWorkout,
});

export const {
    addChat,
    createFirstChat,
    getExercisesWithSetsFromWorkout,
    processPastNutrition,
    processRecentWorkouts,
    processUserMetrics,
    seedInitialData,
    updateWorkoutSetsVolume,
} = commonFunctions;
