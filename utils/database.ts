import type { DatabaseChangeEvent, SQLiteDatabase } from 'expo-sqlite';

import { VOLUME_CALCULATION_TYPES } from '@/constants/exercises';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { EATING_PHASES, NUTRITION_TYPES } from '@/constants/nutrition';
import { COMPLETED_STATUS, GEMINI_API_KEY_TYPE, OPENAI_API_KEY_TYPE, SCHEDULED_STATUS } from '@/constants/storage';
import packageJson from '@/package.json';
import { getCommonFunctions } from '@/utils/databaseCommon';
import { getCurrentTimestamp } from '@/utils/date';
import { decrypt, decryptDatabaseValue, encrypt, encryptDatabaseValue } from '@/utils/encryption';
import { generateHash, normalizeName } from '@/utils/string';
import {
    BioReturnType,
    ChatInsertType,
    ChatReturnType,
    ExerciseInsertType,
    ExerciseReturnType,
    MetricsForUserType,
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
    WorkoutExerciseInsertType,
    WorkoutExerciseReturnType,
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
            "'image' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT",
        ],
        name: 'Exercise'
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'reps' INTEGER",
            "'weight' INTEGER",
            "'restTime' INTEGER",
            "'exerciseId' INTEGER",
            "'difficultyLevel' INTEGER",
            "'isDropSet' INTEGER",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT",
        ],
        name: 'Set'
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'title' TEXT",
            "'workoutExerciseIds' TEXT",
            "'description' TEXT",
            "'volumeCalculationType' TEXT",
            "'recurringOnWeek' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT",
        ],
        name: 'Workout'
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
            "'deletedAt' TEXT",
        ],
        name: 'User'
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'message' TEXT",
            "'sender' TEXT",
            "'misc' TEXT",
            "'type' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT",
        ],
        name: 'Chat'
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
            "'eatingPhase' TEXT",
            "'workoutId' INTEGER",
            "'title' TEXT",
            "'status' TEXT",
            "'exerciseData' TEXT",
            "'recurringOnWeek' TEXT",
            "'description' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT",
            "'alcohol' REAL",
            "'protein' REAL",
            "'carbohydrate' REAL",
            "'fat' REAL",
            "'fiber' REAL",
            "'calories' REAL",
        ],
        name: 'WorkoutEvent'
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'workoutId' INTEGER",
            "'exerciseId' INTEGER",
            "'setIds' TEXT",
            "'order' INTEGER",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT",
        ],
        name: 'WorkoutExercise'
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'type' TEXT",
            "'value' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT",
        ],
        name: 'Setting'
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'value' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT",
        ],
        name: 'Bio'
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'version' INTEGER",
        ],
        name: 'Versioning'
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'dataId' TEXT",
            "'measurements' TEXT",
            "'userId' INTEGER",
            "'date' TEXT",
            "'source' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT",
        ],
        name: 'UserMeasurements'
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'exerciseId' INTEGER",
            "'weight' INTEGER",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT",
        ],
        name: 'OneRepMax'
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'userId' INTEGER",
            "'weight' TEXT",
            "'height' TEXT",
            "'fatPercentage' TEXT",
            "'eatingPhase' TEXT",
            "'dataId' TEXT",
            "'date' TEXT",
            "'source' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT",
        ],
        name: 'UserMetrics'
    },
    {
        columns: [
            "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
            "'userId' INTEGER",
            "'name' TEXT",
            "'calories' TEXT",
            "'alcohol' TEXT",
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
            "'source' TEXT",
            "'date' TEXT",
            "'createdAt' TEXT DEFAULT CURRENT_TIMESTAMP",
            "'deletedAt' TEXT",
        ],
        name: 'UserNutrition'
    }];

    const createTableStatements = tables.map(
        (table) => `CREATE TABLE IF NOT EXISTS '${table.name}' (${table.columns.join(', ')});`
    ).join('\n');

    database.execSync([
        'PRAGMA journal_mode = WAL;',
        createTableStatements
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
    const createdAt = userMeasurements.createdAt || getCurrentTimestamp();
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

export const addWorkoutWithExercises = async (
    workout: WorkoutInsertType,
    workoutExercises: WorkoutExerciseInsertType[],
    existingWorkoutId?: number
): Promise<number> => {
    let workoutId;

    try {
        if (existingWorkoutId) {
            workoutId = existingWorkoutId;
            await updateWorkout(existingWorkoutId, workout);
            await deleteWorkoutExercisesByWorkoutId(existingWorkoutId);
        } else {
            workoutId = await addWorkout(workout);
        }

        const workoutExerciseIds = [];
        for (let i = 0; i < workoutExercises.length; i++) {
            workoutExercises[i].workoutId = workoutId;
            workoutExercises[i].order = i;
            const workoutExerciseId = await addWorkoutExercise(workoutExercises[i]);
            workoutExerciseIds.push(workoutExerciseId);
        }

        const workoutExerciseIdsStr = JSON.stringify(workoutExerciseIds);
        database.runSync(
            'UPDATE "Workout" SET "workoutExerciseIds" = ? WHERE "id" = ?',
            [workoutExerciseIdsStr, workoutId]
        );

        return workoutId;
    } catch (error) {
        console.error('Error in addWorkoutWithExercises:', error);
        throw new Error('Failed to add workout with exercises');
    }
};

export const addWorkout = async (workout: WorkoutInsertType): Promise<number> => {
    const createdAt = workout.createdAt || getCurrentTimestamp();
    try {
        const workoutExerciseIdsStr = JSON.stringify(workout.workoutExerciseIds || []);
        const result = database.runSync(
            'INSERT INTO "Workout" ("title", "recurringOnWeek", "volumeCalculationType", "description", "workoutExerciseIds", "createdAt") VALUES (?, ?, ?, ?, ?, ?)',
            [
                workout.title,
                (workout.recurringOnWeek || ''),
                workout.volumeCalculationType,
                (workout.description || ''),
                workoutExerciseIdsStr,
                createdAt,
            ]
        );

        return result.lastInsertRowId;
    } catch (error) {
        throw error;
    }
};

export const addWorkoutExercise = async (workoutExercise: WorkoutExerciseInsertType): Promise<number> => {
    const createdAt = workoutExercise.createdAt || getCurrentTimestamp();
    try {
        const setIdsStr = JSON.stringify(workoutExercise.setIds);
        const result = database.runSync(`
            INSERT INTO "WorkoutExercise" ("workoutId", "exerciseId", "setIds", "order", "createdAt")
            VALUES (?, ?, ?, ?, ?)
        `, [workoutExercise.workoutId, workoutExercise.exerciseId, setIdsStr, workoutExercise.order, createdAt]);

        return result.lastInsertRowId;
    } catch (error) {
        throw error;
    }
};

export const addWorkoutEvent = async (workoutEvent: WorkoutEventInsertType): Promise<number> => {
    const createdAt = workoutEvent.createdAt || getCurrentTimestamp();
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
                        isDropSet: set.isDropSet,
                        reps: set.reps,
                        restTime: set.restTime,
                        setId: set.id,
                        weight: set.weight,
                    } as Omit<SetReturnType, 'exerciseId' | 'id'>;
                }),
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
    const createdTimestamp = createdAt || getCurrentTimestamp();
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
    const createdTimestamp = createdAt || getCurrentTimestamp();
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
    const createdTimestamp = createdAt || getCurrentTimestamp();
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
    const createdAt = exercise.createdAt || getCurrentTimestamp();
    const result = database.runSync(
        'INSERT INTO "Exercise" ("name", "muscleGroup", "type", "description", "image", "createdAt") VALUES (?, ?, ?, ?, ?, ?)',
        [exercise.name, exercise?.muscleGroup || '', exercise?.type || '', exercise?.description || '', exercise?.image || '', createdAt]
    );

    return result.lastInsertRowId;
};

export const addSet = async (set: SetInsertType): Promise<number> => {
    const createdAt = set.createdAt || getCurrentTimestamp();
    const result = database.runSync(
        'INSERT INTO "Set" ("reps", "weight", "restTime", "exerciseId", "isDropSet", "difficultyLevel", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?)',
        [set.reps, set.weight, set.restTime, set.exerciseId, set.isDropSet ? 1 : 0, set.difficultyLevel || 5, createdAt]
    );

    return result.lastInsertRowId;
};

export const addOrUpdateUser = async (user: UserInsertType, userMetrics?: UserMetricsInsertType): Promise<number> => {
    const existingUser = await getUser();
    if (existingUser) {
        const result = await updateUser(existingUser.id, {
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
    const createdAt = user.createdAt || getCurrentTimestamp();
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
    const createdAt = userMetrics.createdAt || getCurrentTimestamp();
    let userId = userMetrics.userId;

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
    const createdAt = chat.createdAt || getCurrentTimestamp();
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

export const addUserNutrition = async (userNutrition: UserNutritionInsertType): Promise<number> => {
    const createdAt = userNutrition.createdAt || getCurrentTimestamp();
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
            INSERT INTO "UserNutrition" ("userId", "name", "calories", "carbohydrate", "sugar", "fiber", "fat", "monounsaturatedFat", "polyunsaturatedFat", "saturatedFat", "transFat", "unsaturatedFat", "protein", "alcohol", "dataId", "date", "createdAt", "type", "source")
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

// Get functions

export const getUserMeasurements = async (id: number): Promise<{ measurements: string } & UserMeasurementsReturnType | undefined> => {
    try {
        const result = database.getFirstSync<{ measurements: string } & UserMeasurementsReturnType>(
            'SELECT * FROM "UserMeasurements" WHERE "id" = ? AND "deletedAt" IS NULL',
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

export const getUserMeasurementsBetweenDates = async (startDate: string, endDate: string): Promise<({ measurements: string } & UserMeasurementsReturnType)[]> => {
    try {
        const results = database.getAllSync<{ measurements: string } & UserMeasurementsReturnType>(
            'SELECT * FROM "UserMeasurements" WHERE "date" BETWEEN ? AND ? AND "deletedAt" IS NULL',
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

export const getUserMeasurementsFromDate = async (startDate: string): Promise<({ measurements: string } & UserMeasurementsReturnType)[]> => {
    try {
        const results = database.getAllSync<{ measurements: string } & UserMeasurementsReturnType>(
            'SELECT * FROM "UserMeasurements" WHERE "date" >= ? AND "deletedAt" IS NULL',
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

export const getUserMeasurementsPaginated = async (offset = 0, limit = 20): Promise<({ measurements: string } & UserMeasurementsReturnType)[]> => {
    try {
        const results = database.getAllSync<{ measurements: string } & UserMeasurementsReturnType>(
            'SELECT * FROM "UserMeasurements" WHERE "deletedAt" IS NULL ORDER BY "id" DESC LIMIT ? OFFSET ?',
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
            'SELECT COUNT(*) as count FROM "UserMeasurements" WHERE "deletedAt" IS NULL'
        );

        return result?.count || 0;
    } catch (error) {
        throw error;
    }
};

export const getLatestVersioning = async (): Promise<string | undefined> => {
    try {
        const result = database.getFirstSync<{ version: string }>('SELECT * FROM "Versioning" ORDER BY "id" DESC LIMIT 1');
        return result?.version;
    } catch (error) {
        throw error;
    }
};

export const getVersioningByVersion = async (version: string): Promise<VersioningReturnType | undefined> => {
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
            'SELECT * FROM "OneRepMax" WHERE "exerciseId" = ? AND "deletedAt" IS NULL',
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
            'SELECT * FROM "Bio" WHERE "id" = ? AND "deletedAt" IS NULL',
            [id]
        );
        return result ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getAllBio = async (): Promise<BioReturnType[]> => {
    try {
        return database.getAllSync<BioReturnType>('SELECT * FROM "Bio" WHERE "deletedAt" IS NULL');
    } catch (error) {
        throw error;
    }
};

export const getSetting = async (type: string): Promise<SettingsReturnType | undefined> => {
    try {
        const result = database.getFirstSync<SettingsReturnType>(
            'SELECT * FROM "Setting" WHERE "type" = ? AND "deletedAt" IS NULL',
            [type]
        );

        return result ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getAllSettings = async (): Promise<SettingsReturnType[]> => {
    try {
        return database.getAllSync<SettingsReturnType>('SELECT * FROM "Setting" WHERE "deletedAt" IS NULL');
    } catch (error) {
        throw error;
    }
};

export const getAllChats = async (): Promise<ChatReturnType[]> => {
    try {
        return database.getAllSync<ChatReturnType>('SELECT * FROM "Chat" WHERE "deletedAt" IS NULL');
    } catch (error) {
        throw error;
    }
};

export const getChatsPaginated = async (offset = 0, limit = 20): Promise<ChatReturnType[]> => {
    try {
        return database.getAllSync<ChatReturnType>(`
            SELECT * FROM "Chat"
            WHERE "deletedAt" IS NULL
            ORDER BY "id" DESC
            LIMIT ?
            OFFSET ?
        `, [limit, limit * offset]);
    } catch (error) {
        throw error;
    }
};

export const getUser = async (id?: number): Promise<UserWithMetricsType | undefined> => {
    if (!id) {
        return getLatestUser();
    }

    try {
        const user = database.getFirstSync<UserReturnType>('SELECT * FROM "User" WHERE "id" = ? AND "deletedAt" IS NULL', [id]) ?? undefined;

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
        return database.getAllSync<UserReturnType>('SELECT * FROM "User" WHERE "deletedAt" IS NULL');
    } catch (error) {
        throw error;
    }
};

export const getAllLatestMetricsForUser = async (userId: number): Promise<MetricsForUserType | undefined> => {
    try {
        const latestMetrics: MetricsForUserType = {
            date: getCurrentTimestamp(),
            eatingPhase: undefined,
            fatPercentage: undefined,
            height: undefined,
            latestId: -1,
            source: USER_METRICS_SOURCES.USER_INPUT,
            weight: undefined,
        };

        const queries = [
            'SELECT "id", "fatPercentage" FROM "UserMetrics" WHERE "userId" = ? AND "fatPercentage" IS NOT NULL AND "fatPercentage" <> \'\' AND "deletedAt" IS NULL ORDER BY "date" DESC LIMIT 1',
            'SELECT "id", "height" FROM "UserMetrics" WHERE "userId" = ? AND "height" IS NOT NULL AND "height" <> \'\' AND "deletedAt" IS NULL ORDER BY "date" DESC LIMIT 1',
            'SELECT "id", "weight" FROM "UserMetrics" WHERE "userId" = ? AND "weight" IS NOT NULL AND "weight" <> \'\' AND "deletedAt" IS NULL ORDER BY "date" DESC LIMIT 1',
            'SELECT "id", "eatingPhase" FROM "UserMetrics" WHERE "userId" = ? AND "eatingPhase" IS NOT NULL AND "eatingPhase" <> \'\' AND "deletedAt" IS NULL ORDER BY "date" DESC LIMIT 1',
        ];

        const ids: number[] = [];
        for (const query of queries) {
            const encryptedResult = database.getFirstSync<UserMetricsEncryptedReturnType>(query, [userId]);
            if (encryptedResult) {
                const result = {
                    ...encryptedResult,
                    fatPercentage: encryptedResult.fatPercentage ? parseFloat(await decryptDatabaseValue(encryptedResult.fatPercentage)) : undefined,
                    height: encryptedResult.height ? parseFloat(await decryptDatabaseValue(encryptedResult.height)) : undefined,
                    weight: encryptedResult.weight ? parseFloat(await decryptDatabaseValue(encryptedResult.weight)) : undefined,
                } as UserMetricsDecryptedReturnType;

                if (result.eatingPhase !== undefined && result.eatingPhase !== '') {
                    latestMetrics.eatingPhase = result.eatingPhase;
                    ids.push(result.id!);
                }

                if (result.fatPercentage !== undefined && result.fatPercentage > 0) {
                    latestMetrics.fatPercentage = result.fatPercentage;
                    ids.push(result.id!);
                }

                if (result.height !== undefined && result.height > 0) {
                    latestMetrics.height = result.height;
                    ids.push(result.id!);
                }

                if (result.weight !== undefined && result.weight > 0) {
                    latestMetrics.weight = result.weight;
                    ids.push(result.id!);
                }
            }
        }

        latestMetrics.latestId = Math.max(...ids);
        if (latestMetrics.latestId === -1) {
            return undefined;
        }

        return latestMetrics;
    } catch (error) {
        throw error;
    }
};

export const getAllUserMetricsByUserId = async (userId: number): Promise<UserMetricsDecryptedReturnType[]> => {
    try {
        const results = database.getAllSync<UserMetricsEncryptedReturnType>(
            'SELECT * FROM "UserMetrics" WHERE "userId" = ? AND "deletedAt" IS NULL',
            [userId]
        );

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

export const getUserMetrics = async (id: number): Promise<UserMetricsDecryptedReturnType | undefined> => {
    try {
        const result = database.getFirstSync<UserMetricsEncryptedReturnType>(
            'SELECT * FROM "UserMetrics" WHERE "id" = ? AND "deletedAt" IS NULL',
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
            WHERE "deletedAt" IS NULL
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
            WHERE "deletedAt" IS NULL AND "date" BETWEEN ? AND ?
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
        const todayDate = new Date().toISOString();

        const results = database.getAllSync<UserMetricsEncryptedReturnType>(`
            SELECT * FROM "UserMetrics"
            WHERE "deletedAt" IS NULL AND "date" BETWEEN ? AND ?
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
            WHERE "deletedAt" IS NULL
        `);
        return result?.count ?? 0;
    } catch (error) {
        throw error;
    }
};

export const getAllUserMetrics = async (): Promise<UserMetricsDecryptedReturnType[]> => {
    try {
        const results = database.getAllSync<UserMetricsEncryptedReturnType>(
            'SELECT * FROM "UserMetrics" WHERE "deletedAt" IS NULL'
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
            'SELECT * FROM "UserNutrition" WHERE "deletedAt" IS NULL'
        );

        return await Promise.all(results.map(async (row) => {
            return {
                ...row,
                calories: parseFloat(await decryptDatabaseValue(row.calories)) || 0,
                carbohydrate: parseFloat(await decryptDatabaseValue(row.carbohydrate)) || 0,
                fat: parseFloat(await decryptDatabaseValue(row.fat)) || 0,
                fiber: parseFloat(await decryptDatabaseValue(row.fiber)) || 0,
                alcohol: parseFloat(await decryptDatabaseValue(row.alcohol)) || 0,
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

export const getUserMetricsByDataId = async (dataId: string): Promise<UserMetricsDecryptedReturnType | undefined> => {
    try {
        const result = database.getFirstSync<UserMetricsEncryptedReturnType>(
            'SELECT * FROM "UserMetrics" WHERE "dataId" = ? AND ("deletedAt" IS NULL)',
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

export const getLatestUserMetrics = async (): Promise<UserMetricsDecryptedReturnType | undefined> => {
    try {
        const result = database.getFirstSync<UserMetricsEncryptedReturnType>('SELECT * FROM "UserMetrics" WHERE "deletedAt" IS NULL ORDER BY "id" DESC LIMIT 1');

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

export const getLatestUser = async (): Promise<UserWithMetricsType | undefined> => {
    try {
        const user = database.getFirstSync<UserReturnType>('SELECT * FROM "User" WHERE "deletedAt" IS NULL ORDER BY "id" DESC LIMIT 1') ?? undefined;

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
        return database.getAllSync<ExerciseReturnType>('SELECT * FROM "Exercise" WHERE "deletedAt" IS NULL');
    } catch (error) {
        throw error;
    }
};

export const getExercisesPaginated = async (offset = 0, limit = 20): Promise<ExerciseReturnType[]> => {
    try {
        return database.getAllSync<ExerciseReturnType>(`
            SELECT * FROM "Exercise"
            WHERE "deletedAt" IS NULL
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
            WHERE "deletedAt" IS NULL
        `);
        return result?.count ?? 0;
    } catch (error) {
        throw error;
    }
};

export const getExercisesByWorkoutExerciseIds = async (workoutExerciseIds: number[]): Promise<ExerciseReturnType[]> => {
    try {
        return database.getAllSync<ExerciseReturnType>(`
            SELECT * FROM "Exercise"
            WHERE "id" IN (
                SELECT "exerciseId" FROM "WorkoutExercise"
                WHERE "id" IN (${workoutExerciseIds.join(',')})
            )
            AND ("deletedAt" IS NULL)
        `);
    } catch (error) {
        throw error;
    }
};

export const getAllWorkouts = async (): Promise<WorkoutReturnType[]> => {
    try {
        const result = database.getAllSync<WorkoutReturnType>('SELECT * FROM "Workout" WHERE "deletedAt" IS NULL');

        return result.map((workout) => ({
            ...workout,
            workoutExerciseIds: JSON.parse(workout.workoutExerciseIds as unknown as string || '[]') as number[],
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
            // TODO: maybe have a type for saving and for getting
            workoutExerciseIds: JSON.parse(workout.workoutExerciseIds as unknown as string || '[]') as number[],
        }));
    } catch (error) {
        throw error;
    }
};

export const getRecurringWorkouts = async (): Promise<WorkoutReturnType[] | undefined> => {
    try {
        const result = database.getAllSync<WorkoutReturnType>(
            'SELECT * FROM "Workout" WHERE "recurringOnWeek" IS NOT NULL AND "deletedAt" IS NULL ORDER BY "date" ASC'
        );

        return result.map((workout) => ({
            ...workout,
            workoutExerciseIds: JSON.parse(workout.workoutExerciseIds as unknown as string || '[]') as number[],
        }));
    } catch (error) {
        throw error;
    }
};

export const getWorkouts = async (): Promise<WorkoutReturnType[] | undefined> => {
    try {
        const result = database.getAllSync<WorkoutReturnType>(
            'SELECT * FROM "Workout" WHERE "deletedAt" IS NULL'
        );

        return result.map((workout) => ({
            ...workout,
            workoutExerciseIds: JSON.parse(workout.workoutExerciseIds as unknown as string || '[]') as number[],
        }));
    } catch (error) {
        throw error;
    }
};

export const getWorkoutById = async (id: number): Promise<WorkoutReturnType | undefined> => {
    try {
        const result = database.getFirstSync<WorkoutReturnType>('SELECT * FROM "Workout" WHERE "id" = ? AND ("deletedAt" IS NULL)', [id]) ?? undefined;

        return {
            ...result,
            workoutExerciseIds: JSON.parse(result?.workoutExerciseIds as unknown as string || '[]') as number[],
        } as WorkoutReturnType;
    } catch (error) {
        throw error;
    }
};

export const getWorkoutByIdWithTrashed = async (id: number): Promise<WorkoutReturnType | undefined> => {
    try {
        const result = database.getFirstSync<WorkoutReturnType>('SELECT * FROM "Workout" WHERE "id" = ?', [id]) ?? undefined;

        return {
            ...result,
            workoutExerciseIds: JSON.parse(result?.workoutExerciseIds as unknown as string || '[]') as number[],
        } as WorkoutReturnType;
    } catch (error) {
        throw error;
    }
};

export const getSetsByExerciseId = async (exerciseId: number): Promise<SetReturnType[]> => {
    try {
        return database.getAllSync<SetReturnType>('SELECT * FROM "Set" WHERE "exerciseId" = ? AND "deletedAt" IS NULL', [exerciseId]);
    } catch (error) {
        throw error;
    }
};

export const getSetById = async (setId: number): Promise<SetReturnType | null | undefined> => {
    try {
        return database.getFirstSync<SetReturnType>(
            'SELECT * FROM "Set" WHERE "id" = ? AND "deletedAt" IS NULL',
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
            AND "deletedAt" IS NULL
        `);
    } catch (error) {
        throw error;
    }
};

export const getSetsByIdsAndExerciseId = async (setIds: number[], exerciseId: number): Promise<SetReturnType[]> => {
    let sets: SetReturnType[];
    try {
        sets = database.getAllSync<SetReturnType>(`
            SELECT * FROM "Set"
            WHERE "id" IN (${setIds.join(',')})
            AND ("deletedAt" IS NULL)
        `);
    } catch (error) {
        throw error;
    }
    return sets.filter((set) => set.exerciseId === exerciseId);
};

export const getExerciseById = async (id: number): Promise<ExerciseReturnType | undefined> => {
    try {
        return database.getFirstSync<ExerciseReturnType>('SELECT * FROM "Exercise" WHERE "id" = ? AND "deletedAt" IS NULL', [id]) ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getExercisesForWorkout = async (workoutId: number): Promise<ExerciseReturnType[]> => {
    const workoutExercises = await database.getAllSync<WorkoutExerciseReturnType>(`
        SELECT * FROM "WorkoutExercise"
        WHERE "workoutId" = ?
        AND ("deletedAt" IS NULL)
    `, [workoutId]);

    const exerciseIds = workoutExercises.map((workoutExercise) => workoutExercise.exerciseId);

    try {
        return database.getAllSync<ExerciseReturnType>(`
            SELECT * FROM "Exercise"
            WHERE "id" IN (${exerciseIds.join(',')})
            AND ("deletedAt" IS NULL)
        `);
    } catch (error) {
        throw error;
    }
};

export const getWorkoutEvent = async (id: number): Promise<WorkoutEventReturnType | undefined> => {
    try {
        const result = database.getFirstSync<WorkoutEventReturnType>('SELECT * FROM "WorkoutEvent" WHERE "id" = ? AND "deletedAt" IS NULL', [id]);

        return result ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getWorkoutEvents = async (): Promise<WorkoutEventReturnType[]> => {
    try {
        return database.getAllSync<WorkoutEventReturnType>('SELECT * FROM "WorkoutEvent" WHERE "deletedAt" IS NULL');
    } catch (error) {
        throw error;
    }
};

export const getWorkoutEventsByExerciseId = async (exerciseId: number): Promise<WorkoutEventReturnType[]> => {
    const workoutExercises = await database.getAllSync<WorkoutExerciseReturnType>(`
        SELECT * FROM "WorkoutExercise"
        WHERE "exerciseId" = ?
        AND "deletedAt" IS NULL
    `, [exerciseId]);

    const workoutIds = workoutExercises.map((workoutExercise) => workoutExercise.workoutId);

    try {
        const workoutsStr = workoutIds.join(',');
        return database.getAllSync<WorkoutEventReturnType>(`
            SELECT * FROM "WorkoutEvent"
            WHERE "workoutId" IN (${workoutsStr})
            AND "deletedAt" IS NULL
        `);
    } catch (error) {
        throw error;
    }
};

export const getWorkoutEventsByWorkoutId = async (workoutId: number): Promise<WorkoutEventReturnType[]> => {
    try {
        return database.getAllSync<WorkoutEventReturnType>(`
            SELECT * FROM "WorkoutEvent"
            WHERE "workoutId" = ?
            AND "deletedAt" IS NULL
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
            WHERE "deletedAt" IS NULL
            AND "workoutId" = ?
            AND "status" = ?
        `, [workoutId, COMPLETED_STATUS]);
    } catch (error) {
        throw error;
    }
};

export const getUpcomingWorkoutsByWorkoutId = async (workoutId: number): Promise<WorkoutEventReturnType[]> => {
    const todayDate = new Date().toISOString();
    try {
        return database.getAllSync<WorkoutEventReturnType>(`
            SELECT * FROM "WorkoutEvent"
            WHERE "workoutId" = ?
            AND "status" = ?
            AND "date" > ?
            AND "deletedAt" IS NULL
        `, [workoutId, SCHEDULED_STATUS, todayDate]);
    } catch (error) {
        throw error;
    }
};

export const getUpcomingWorkouts = async (): Promise<WorkoutEventReturnType[]> => {
    const todayDate = new Date().toISOString();
    try {
        return database.getAllSync<WorkoutEventReturnType>(`
            SELECT * FROM "WorkoutEvent"
            WHERE "status" = ?
            AND "date" > ?
            AND ("deletedAt" IS NULL)
        `, [SCHEDULED_STATUS, todayDate]);
    } catch (error) {
        throw error;
    }
};

export const getTotalUpcomingWorkoutsCount = async (): Promise<number> => {
    const todayDate = new Date().toISOString();
    try {
        const result = database.getFirstSync<{ count: number }>(
            'SELECT COUNT(*) as count FROM "WorkoutEvent" WHERE "status" = ? AND "date" > ? AND ("deletedAt" IS NULL)',
            [SCHEDULED_STATUS, todayDate]
        );
        return result?.count ?? 0;
    } catch (error) {
        throw error;
    }
};

export const getUpcomingWorkoutsPaginated = async (offset: number, limit: number): Promise<WorkoutEventReturnType[]> => {
    const todayDate = new Date().toISOString().split('T')[0];
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
            AND ("deletedAt" IS NULL)
        `, [COMPLETED_STATUS]);
    } catch (error) {
        throw error;
    }
};

export const getRecentWorkoutById = async (id: number): Promise<WorkoutEventReturnType | undefined> => {
    try {
        return database.getFirstSync<WorkoutEventReturnType>('SELECT * FROM "WorkoutEvent" WHERE "id" = ? AND ("deletedAt" IS NULL)', [id]) ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getTotalRecentWorkoutsCount = async (): Promise<number> => {
    try {
        const result = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM "WorkoutEvent" WHERE "deletedAt" IS NULL AND "status" = "completed"');
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
            AND ("deletedAt" IS NULL)
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
            AND ("deletedAt" IS NULL)
        `, [COMPLETED_STATUS, startDate]);
    } catch (error) {
        throw error;
    }
};

export const getRecentWorkoutsPaginated = async (offset: number, limit: number): Promise<WorkoutEventReturnType[]> => {
    try {
        return database.getAllSync<WorkoutEventReturnType>(
            'SELECT * FROM "WorkoutEvent" WHERE "deletedAt" IS NULL AND "status" = "completed" ORDER BY "date" DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );
    } catch (error) {
        throw error;
    }
};

export const getWorkoutExercisesByExerciseIds = async (exerciseIds: number[]): Promise<WorkoutExerciseReturnType[]> => {
    try {
        const result = database.getAllSync<WorkoutExerciseReturnType>(`
            SELECT * FROM "WorkoutExercise"
            WHERE "exerciseId" IN (${exerciseIds.join(',')})
            AND ("deletedAt" IS NULL)
        `);

        return result.map((workoutExercise) => ({
            ...workoutExercise,
            // TODO: maybe have a type for saving and for getting
            setIds: JSON.parse(workoutExercise.setIds as unknown as string || '[]') as number[],
        }));
    } catch (error) {
        throw error;
    }
};

export const getWorkoutExercises = async (id: number): Promise<WorkoutExerciseReturnType | undefined> => {
    try {
        const result = database.getFirstSync<WorkoutExerciseReturnType>('SELECT * FROM "WorkoutExercise" WHERE "workoutId" = ? AND "deletedAt" IS NULL', [id]);

        if (result) {
            return {
                ...result,
                // TODO: maybe have a type for saving and for getting
                setIds: JSON.parse(result.setIds as unknown as string || '[]') as number[],
            };
        }

        return result ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getWorkoutExercisesByWorkoutId = async (workoutId: number): Promise<WorkoutExerciseReturnType[]> => {
    try {
        const result = database.getAllSync<WorkoutExerciseReturnType>(`
            SELECT * FROM "WorkoutExercise"
            WHERE "workoutId" = ?
            AND ("deletedAt" IS NULL)
            ORDER BY "order"
        `, [workoutId]);

        return result.map((workoutExercise) => ({
            ...workoutExercise,
            // TODO: maybe have a type for saving and for getting
            setIds: JSON.parse(workoutExercise.setIds as unknown as string || '[]') as number[],
        }));
    } catch (error) {
        throw error;
    }
};

export const getWorkoutExerciseByWorkoutIdAndExerciseId = async (workoutId: number, exerciseId: number): Promise<WorkoutExerciseReturnType | undefined> => {
    try {
        const result = database.getFirstSync<WorkoutExerciseReturnType>(
            'SELECT * FROM "WorkoutExercise" WHERE "workoutId" = ? AND "exerciseId" = ? AND "deletedAt" IS NULL',
            [workoutId, exerciseId]
        );

        if (result) {
            return {
                ...result,
                // TODO: maybe have a type for saving and for getting
                setIds: JSON.parse(result.setIds as unknown as string || '[]') as number[],
            };
        }

        return result ?? undefined;
    } catch (error) {
        throw error;
    }
};

export const getWorkoutExerciseByExerciseId = async (exerciseId: number): Promise<WorkoutExerciseReturnType[] | undefined> => {
    try {
        const result = database.getAllSync<WorkoutExerciseReturnType>(
            'SELECT * FROM "WorkoutExercise" WHERE "exerciseId" = ? AND "deletedAt" IS NULL',
            [exerciseId]
        );

        if (!result) {
            return undefined;
        }

        return result.map((workoutExercise) => ({
            ...workoutExercise,
            // TODO: maybe have a type for saving and for getting
            setIds: JSON.parse(workoutExercise.setIds as unknown as string || '[]') as number[],
        }));
    } catch (error) {
        throw error;
    }
};

export const getWorkoutDetails = async (workoutId: number): Promise<{ workout: WorkoutReturnType, workoutExercises: WorkoutExerciseReturnType[] } | undefined> => {
    try {
        const workout = database.getFirstSync<WorkoutReturnType>('SELECT * FROM "Workout" WHERE "id" = ? AND ("deletedAt" IS NULL)', [workoutId]);
        if (!workout) {
            return undefined;
        }

        const workoutExercises = await getWorkoutExercisesByWorkoutId(workoutId);
        return {
            workout: {
                ...workout,
                workoutExerciseIds: JSON.parse(workout?.workoutExerciseIds as unknown as string || '[]') as number[],
            },
            workoutExercises,
        };
    } catch (error) {
        throw error;
    }
};

export const getWorkoutWithExercisesRepsAndSetsDetails = async (workoutId: number): Promise<WorkoutWithExercisesRepsAndSetsDetailsReturnType | undefined> => {
    const workout = database.getFirstSync<WorkoutReturnType>('SELECT * FROM "Workout" WHERE "id" = ? AND ("deletedAt" IS NULL)', [workoutId]);

    if (!workout) {
        return undefined;
    }

    return {
        description: workout.description,
        exercises: await getExercisesWithSetsFromWorkout(workoutId),
        id: workout.id,
        title: workout.title,
    };
};

export const getTotalWorkoutsCount = async (): Promise<number> => {
    try {
        const result = database.getFirstSync<{ count: number }>(
            'SELECT COUNT(*) as count FROM "Workout" WHERE "deletedAt" IS NULL'
        );

        return result?.count ?? 0;
    } catch (error) {
        throw error;
    }
};

export const getWorkoutsPaginated = async (offset: number, limit: number): Promise<WorkoutReturnType[]> => {
    try {
        const result = database.getAllSync<WorkoutReturnType>(
            'SELECT * FROM "Workout" ORDER BY "id" DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );

        return result.map((workout) => ({
            ...workout,
            workoutExerciseIds: JSON.parse(workout.workoutExerciseIds as unknown as string || '[]') as number[],
        }));
    } catch (error) {
        throw error;
    }
};

export const getUserNutrition = async (id: number): Promise<UserNutritionDecryptedReturnType | undefined> => {
    try {
        const result = database.getFirstSync<UserNutritionEncryptedReturnType>(
            'SELECT * FROM "UserNutrition" WHERE "id" = ? AND "deletedAt" IS NULL',
            [id]
        );

        let decryptedResult = {} as UserNutritionDecryptedReturnType;
        if (result) {
            decryptedResult = {
                ...result,
                calories: parseFloat(await decryptDatabaseValue(result.calories)) || 0,
                carbohydrate: parseFloat(await decryptDatabaseValue(result.carbohydrate)) || 0,
                fat: parseFloat(await decryptDatabaseValue(result.fat)) || 0,
                fiber: parseFloat(await decryptDatabaseValue(result.fiber)) || 0,
                alcohol: parseFloat(await decryptDatabaseValue(result.alcohol)) || 0,
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

export const getLatestUserNutritionByUserId = async (userId: number): Promise<UserNutritionDecryptedReturnType | undefined> => {
    try {
        const result = database.getFirstSync<UserNutritionEncryptedReturnType>(
            'SELECT * FROM "UserNutrition" WHERE "userId" = ? AND "deletedAt" IS NULL ORDER BY "id" DESC LIMIT 1',
            [userId]
        );

        if (!result) {
            return undefined;
        }

        return {
            ...result,
            calories: parseFloat(await decryptDatabaseValue(result.calories)) || 0,
            carbohydrate: parseFloat(await decryptDatabaseValue(result.carbohydrate)) || 0,
            fat: parseFloat(await decryptDatabaseValue(result.fat)) || 0,
            fiber: parseFloat(await decryptDatabaseValue(result.fiber)) || 0,
            alcohol: parseFloat(await decryptDatabaseValue(result.alcohol)) || 0,
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
            'SELECT * FROM "UserNutrition" WHERE "userId" = ? AND "deletedAt" IS NULL',
            [userId]
        );

        return (await Promise.all(results.map(async (row) => {
            try {
                return {
                    ...row,
                    calories: parseFloat(await decryptDatabaseValue(row.calories)) || 0,
                    carbohydrate: parseFloat(await decryptDatabaseValue(row.carbohydrate)) || 0,
                    fat: parseFloat(await decryptDatabaseValue(row.fat)) || 0,
                    fiber: parseFloat(await decryptDatabaseValue(row.fiber)) || 0,
                    alcohol: parseFloat(await decryptDatabaseValue(row.alcohol)) || 0,
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

export const getUserNutritionByDataId = async (dataId: string): Promise<UserNutritionDecryptedReturnType | undefined> => {
    try {
        const result = database.getFirstSync<UserNutritionEncryptedReturnType>(
            'SELECT * FROM "UserNutrition" WHERE "dataId" = ? AND "deletedAt" IS NULL',
            [dataId]
        );

        if (!result) {
            return undefined;
        }

        try {
            return {
                ...result,
                calories: parseFloat(await decryptDatabaseValue(result.calories)) || 0,
                carbohydrate: parseFloat(await decryptDatabaseValue(result.carbohydrate)) || 0,
                fat: parseFloat(await decryptDatabaseValue(result.fat)) || 0,
                alcohol: parseFloat(await decryptDatabaseValue(result.alcohol)) || 0,
                fiber: parseFloat(await decryptDatabaseValue(result.fiber)) || 0,
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
            WHERE "deletedAt" IS NULL
            ORDER BY "date" ${order}
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        return (await Promise.all(results.map(async (row) => {
            try {
                return {
                    ...row,
                    calories: parseFloat(await decryptDatabaseValue(row.calories)) || 0,
                    carbohydrate: parseFloat(await decryptDatabaseValue(row.carbohydrate)) || 0,
                    fat: parseFloat(await decryptDatabaseValue(row.fat)) || 0,
                    alcohol: parseFloat(await decryptDatabaseValue(row.alcohol)) || 0,
                    fiber: parseFloat(await decryptDatabaseValue(row.fiber)) || 0,
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
            WHERE "deletedAt" IS NULL
            AND "date" BETWEEN ? AND ?
            ORDER BY "date" ASC
        `, [startDate, endDate]);

        return (await Promise.all(results.map(async (row) => {
            try {
                return {
                    ...row,
                    calories: parseFloat(await decryptDatabaseValue(row.calories)) || 0,
                    carbohydrate: parseFloat(await decryptDatabaseValue(row.carbohydrate)) || 0,
                    fat: parseFloat(await decryptDatabaseValue(row.fat)) || 0,
                    fiber: parseFloat(await decryptDatabaseValue(row.fiber)) || 0,
                    alcohol: parseFloat(await decryptDatabaseValue(row.alcohol)) || 0,
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

export const getUserNutritionFromDate = async (startDate: string): Promise<UserNutritionDecryptedReturnType[]> => {
    try {
        const todayDate = new Date().toISOString();

        const results = database.getAllSync<UserNutritionEncryptedReturnType>(`
            SELECT * FROM "UserNutrition"
            WHERE "deletedAt" IS NULL
            AND "date" BETWEEN ? AND ?
            ORDER BY "date" ASC
        `, [startDate, todayDate]);

        return (await Promise.all(results.map(async (row) => {
            try {
                return {
                    ...row,
                    calories: parseFloat(await decryptDatabaseValue(row.calories)) || 0,
                    carbohydrate: parseFloat(await decryptDatabaseValue(row.carbohydrate)) || 0,
                    fat: parseFloat(await decryptDatabaseValue(row.fat)) || 0,
                    alcohol: parseFloat(await decryptDatabaseValue(row.alcohol)) || 0,
                    fiber: parseFloat(await decryptDatabaseValue(row.fiber)) || 0,
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
            WHERE "deletedAt" IS NULL
        `);
        return result?.count ?? 0;
    } catch (error) {
        throw error;
    }
};

// Update functions

export const updateUserMeasurements = async (id: number, userMeasurements: UserMeasurementsInsertType): Promise<number> => {
    const existingUserMeasurements = await getUserMeasurements(id);

    try {
        database.runSync(
            'UPDATE "UserMeasurements" SET "createdAt" = ?, "dataId" = ?, "date" = ?, "deletedAt" = ?, "measurements" = ?, "source" = ?, "userId" = ? WHERE "id" = ?',
            [
                userMeasurements.createdAt || existingUserMeasurements?.createdAt || getCurrentTimestamp(),
                userMeasurements.dataId || existingUserMeasurements?.dataId || generateHash(),
                userMeasurements.date || existingUserMeasurements?.date || getCurrentTimestamp(),
                userMeasurements.deletedAt || existingUserMeasurements?.deletedAt || '',
                JSON.stringify(userMeasurements.measurements || existingUserMeasurements?.measurements || {}),
                userMeasurements.source || existingUserMeasurements?.source || USER_METRICS_SOURCES.USER_INPUT,
                userMeasurements.userId || existingUserMeasurements?.userId || 1,
                id
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
            id
        ]
    );

    return id;
};

export const updateSet = async (id: number, set: SetInsertType): Promise<number> => {
    const existingSet = await getSetById(id);

    database.runSync(
        'UPDATE "Set" SET "reps" = ?, "weight" = ?, "restTime" = ?, "exerciseId" = ?, "isDropSet" = ?, "difficultyLevel" = ? WHERE "id" = ?',
        [
            set.reps || existingSet?.reps || 0,
            set.weight || existingSet?.weight || 0,
            set.restTime || existingSet?.restTime || 0,
            set.exerciseId || existingSet?.exerciseId || 0,
            set.isDropSet ? 1 : (existingSet?.isDropSet ? 1 : 0),
            set.difficultyLevel || existingSet?.difficultyLevel || 5,
            id
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
                id
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
                id
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
                id
            ]
        );

        return id;
    } catch (error) {
        throw error;
    }
};

export const updateWorkoutExercise = async (id: number, workoutExercise: WorkoutExerciseInsertType): Promise<number> => {
    const existingWorkoutExercise = await getWorkoutExercises(id);

    try {
        const setIdsStr = JSON.stringify(existingWorkoutExercise?.setIds || workoutExercise.setIds);
        database.runSync(
            'UPDATE "WorkoutExercise" SET "workoutId" = ?, "exerciseId" = ?, "setIds" = ?, "order" = ? WHERE "id" = ?',
            [
                workoutExercise.workoutId || existingWorkoutExercise?.workoutId || 0,
                workoutExercise.exerciseId || existingWorkoutExercise?.exerciseId || 0,
                setIdsStr,
                workoutExercise.order || existingWorkoutExercise?.order || 0,
                id
            ]
        );

        return id;
    } catch (error) {
        throw error;
    }
};

export const updateWorkoutExerciseOrder = async (workoutId: number, workoutExercises: WorkoutExerciseInsertType[]): Promise<void> => {
    const updatePromises = workoutExercises.map((exercise, index) => {
        return database.runSync(
            'UPDATE "WorkoutExercise" SET "order" = ? WHERE "workoutId" = ? AND "exerciseId" = ?',
            [index, workoutId, exercise.exerciseId]
        );
    });

    try {
        await Promise.all(updatePromises);
    } catch (error) {
        console.error('Failed to update workout exercise order:', error);
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
            'UPDATE "UserNutrition" SET "name" = ?, "calories" = ?, "protein" = ?, "alcohol" = ?, "carbohydrate" = ?, "sugar" = ?, "fiber" = ?, "fat" = ?, "monounsaturatedFat" = ?, "polyunsaturatedFat" = ?, "saturatedFat" = ?, "transFat" = ?, "unsaturatedFat" = ?, "userId" = ?, "date" = ?, "type" = ?, "source" = ? WHERE "id" = ?',
            [
                await encryptDatabaseValue(userNutrition.name || existingUserNutrition?.name || ''),
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
                userNutrition.userId,
                userNutrition.date || existingUserNutrition?.date || getCurrentTimestamp(),
                userNutrition.type || existingUserNutrition?.type || NUTRITION_TYPES.MEAL,
                userNutrition.source || existingUserNutrition?.source || USER_METRICS_SOURCES.USER_INPUT,
                id
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
            workoutEvent.createdAt || existingWorkoutEvent.createdAt || getCurrentTimestamp(),
            workoutEvent.deletedAt || existingWorkoutEvent.deletedAt || null,
            id
        ]
        );

        return id;
    } catch (error) {
        console.error('Error in updateWorkoutEvent:', error);
        throw new Error('Failed to update workout event');
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
    const workoutExercises = database.getAllSync<WorkoutExerciseReturnType>('SELECT * FROM "WorkoutExercise" WHERE instr(\',\' || setIds || \',\', \',\' || ? || \',\') > 0', [id]);

    for (const workoutExercise of workoutExercises) {
        // TODO: maybe have a type for saving and for getting
        const setIds = (JSON.parse(workoutExercise.setIds as unknown as string || '[]') as number[]).filter((setId: number) => setId !== id);

        if (setIds.length === 0) {
            database.runSync('DELETE FROM "WorkoutExercise" WHERE "id" = ?', [workoutExercise.id!]);
        } else {
            const setIdsStr = JSON.stringify(setIds);
            database.runSync('UPDATE "WorkoutExercise" SET "setIds" = ? WHERE "id" = ?', [setIdsStr, workoutExercise.id!]);
        }
    }

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

export const deleteWorkoutExercisesByExerciseId = async (exerciseId: number): Promise<void> => {
    const workoutExercises = await getWorkoutExerciseByExerciseId(exerciseId);

    if (workoutExercises) {
        for (const workoutExercise of workoutExercises) {
            // TODO: maybe have a type for saving and for getting
            for (const setId of JSON.parse(workoutExercise.setIds as unknown as string || '[]') as number[]) {
                database.runSync('DELETE FROM "Set" WHERE "id" = ?', [setId]);
            }

            database.runSync('DELETE FROM "WorkoutExercise" WHERE "id" = ?', [workoutExercise.id!]);
        }
    }
};

export const deleteWorkoutExercisesByWorkoutId = async (workoutId: number): Promise<void> => {
    database.runSync('DELETE FROM "WorkoutExercise" WHERE "workoutId" = ?', [workoutId]);
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
    try {
        const existingExercises = await getAllExercises();
        const exerciseMap: { [name: string]: ExerciseReturnType } = {};

        for (const exercise of existingExercises) {
            if (exercise.name) {
                exerciseMap[normalizeName(exercise.name)] = exercise;
            }
        }

        for (const workout of workoutPlan.workoutPlan) {
            const workoutExercises: WorkoutExerciseInsertType[] = [];

            const newWorkout: WorkoutInsertType = {
                description: workout.description || '',
                title: workout.title,
                volumeCalculationType: VOLUME_CALCULATION_TYPES.NONE,
                workoutExerciseIds: [],
            };

            for (const planExercise of workout.exercises) {
                let exercise: ExerciseReturnType | undefined;
                const normalizedExerciseName = normalizeName(planExercise.name);

                if (exerciseMap[normalizedExerciseName]) {
                    exercise = exerciseMap[normalizedExerciseName];
                } else {
                    const exerciseId = await addExercise({
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

                const oneRepMax = await getOneRepMax(exercise?.id!);
                const oneRepMaxWeight = oneRepMax ? oneRepMax.weight : 60;

                const reps = planExercise.reps ?? 12;
                const sets = planExercise.sets ?? 3;
                const restTime = planExercise.restTime ?? 60;
                const oneRepMaxPercentage = planExercise.oneRepMaxPercentage || 60;

                const setIds: number[] = [];
                for (let i = 0; i < sets; i++) {
                    const weight = oneRepMaxWeight * (oneRepMaxPercentage / 100);
                    const setId = await addSet({
                        exerciseId: exercise?.id!,
                        reps: reps,
                        restTime: restTime,
                        weight: weight,
                    });
                    setIds.push(setId);
                }

                workoutExercises.push({
                    exerciseId: exercise?.id!,
                    order: workoutExercises.length,
                    setIds,
                    workoutId: 0,
                });
            }

            await addWorkoutWithExercises(newWorkout, workoutExercises);
        }
    } catch (error) {
        console.error('Error processing workout plan:', error);
        throw error;
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
    try {
        if (decryptionPhrase) {
            dump = await decrypt(dump, decryptionPhrase);
        }

        const dbData = JSON.parse(dump);
        database.runSync('PRAGMA foreign_keys = OFF;');

        for (const tableName of Object.keys(dbData)) {
            const tableData = dbData[tableName];

            database.runSync(`DELETE FROM "${tableName}";`);

            for (const row of tableData) {
                // console.log('THE ROW:', row);
                const columns = Object.keys(row).map((element) => `"${element}"`).join(', ');
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
                    }
                }

                const values = Object.values(row).map((value: any) => {
                    if (typeof value === 'string') {
                        return `'${value.replace(/'/g, "''")}'`;
                    } else if (value === null || value === undefined) {
                        return 'NULL';
                    } else {
                        return value;
                    }
                }).join(', ');

                if (!values) {
                    console.error(`No values found for table ${tableName}`);
                    continue;
                }

                const query = `INSERT INTO "${tableName}" (${columns}) VALUES (${values})`;
                // console.log(`Running query: ${query}`);
                database.runSync(query);
            }
        }

        database.runSync('PRAGMA foreign_keys = ON;');
    } catch (error) {
        console.error('Error restoring database:', error);
        throw error;
    }
};

// Migrations

const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
    const query = `PRAGMA table_info("${tableName}");`;
    const columns = await database.getAllAsync<{ name: string }>(query, []);
    return columns.some((column) => column.name === columnName);
};

const tableExists = async (tableName: string): Promise<boolean> => {
    const query = `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}';`;
    const result = await database.getFirstAsync<{ name: string }>(query, []);
    return !!result;
};

export const addUserMeasurementsTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersioning();
    if (currentVersion && currentVersion <= packageJson.version) {
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

        await addVersioning(packageJson.version);
    }
};

export const addAlcoholMacroToUserNutritionTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersioning();
    if (currentVersion && currentVersion <= packageJson.version) {
        if (!(await columnExists('UserNutrition', 'alcohol'))) {
            await database.execAsync('ALTER TABLE "UserNutrition" ADD COLUMN "alcohol" TEXT');
        }

        await addVersioning(packageJson.version);
    }
};

export const addAlcoholAndFiberMacroToWorkoutEventTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersioning();
    if (currentVersion && currentVersion <= packageJson.version) {
        if (!(await columnExists('WorkoutEvent', 'alcohol'))) {
            await database.execAsync('ALTER TABLE "WorkoutEvent" ADD COLUMN "alcohol" REAL DEFAULT 0');
        }

        if (!(await columnExists('WorkoutEvent', 'fiber'))) {
            await database.execAsync('ALTER TABLE "WorkoutEvent" ADD COLUMN "fiber" REAL DEFAULT 0');
        }

        await addVersioning(packageJson.version);
    }
};

export const addMacrosToWorkoutEventTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersioning();
    if (currentVersion && currentVersion <= packageJson.version) {
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

        await addVersioning(packageJson.version);
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
    addWorkoutEvent,
    addWorkoutExercise,
    countChatMessages,
    countExercises,
    getAllExercises,
    getAllWorkoutsWithTrashed,
    getExerciseById,
    getExercisesByWorkoutExerciseIds,
    getSetById,
    getSetsByIds,
    getUser,
    getWorkoutByIdWithTrashed,
    getWorkoutExerciseByWorkoutIdAndExerciseId,
    getWorkoutExercisesByWorkoutId,
    updateSet,
    updateWorkout,
    updateWorkoutExercise,
    addWorkoutWithExercises,
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
