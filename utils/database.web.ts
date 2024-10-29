import { VOLUME_CALCULATION_TYPES } from '@/constants/exercises';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { COMPLETED_STATUS, SCHEDULED_STATUS } from '@/constants/storage';
import packageJson from '@/package.json';
import { getCommonFunctions } from '@/utils/databaseCommon';
import { getCurrentTimestamp } from '@/utils/date';
import { decrypt, encrypt } from '@/utils/encryption';
import { generateHash, normalizeName } from '@/utils/string';
import {
    ActivityLevelType,
    BioInsertType,
    BioReturnType,
    ChatInsertType,
    ChatReturnType,
    ExerciseInsertType,
    ExerciseReturnType,
    ExperienceLevelType,
    MetricsForUserType,
    OneRepMaxInsertType,
    OneRepMaxReturnType,
    SetInsertType,
    SetReturnType,
    SettingsInsertType,
    SettingsReturnType,
    UserInsertType,
    UserMeasurementsInsertType,
    UserMeasurementsReturnType,
    UserMetricsDecryptedReturnType,
    UserMetricsInsertType,
    UserNutritionDecryptedReturnType,
    UserNutritionInsertType,
    UserReturnType,
    UserWithMetricsType,
    VersioningInsertType,
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
import Dexie from 'dexie';

interface IDatabase {
    bio: {
        add: (bio: BioInsertType) => Promise<number>;
        clear: () => Promise<void>;
        toArray: () => Promise<BioReturnType[]>;
        where: (query: any) => any;
    };
    bulkAdd?: (data: any) => Promise<void>;
    chats: {
        add: (chat: ChatInsertType) => Promise<number>;
        clear: () => Promise<void>;
        orderBy: (field: string) => any;
        toArray: () => Promise<ChatReturnType[]>;
    };
    exercises: {
        add: (exercise: ExerciseInsertType) => Promise<number>;
        clear: () => Promise<void>;
        count: () => Promise<number>;
        get: (id: number) => Promise<ExerciseReturnType | undefined>;
        toArray: () => Promise<ExerciseReturnType[]>;
        update: (id: number, exercise: ExerciseInsertType) => Promise<number>;
    };
    oneRepMaxes: {
        add: (oneRepMax: OneRepMaxInsertType) => Promise<number>;
        clear: () => Promise<void>;
        update: (id: number, oneRepMax: OneRepMaxInsertType) => Promise<number>;
        where: (query: any) => any;
    };
    sets: {
        add: (set: SetInsertType) => Promise<number>;
        clear: () => Promise<void>;
        where: (query: any) => any;
    };
    settings: {
        add: (setting: SettingsInsertType) => Promise<number>;
        clear: () => Promise<void>;
        put: (setting: SettingsInsertType) => Promise<number>;
        where: (query: any) => any;
    };
    tables: { name: string }[];
    userMetrics: {
        add: (metric: UserMetricsInsertType) => Promise<number>;
        clear: () => Promise<void>;
        toArray: () => Promise<UserMetricsDecryptedReturnType[]>;
        where: (query: any) => any;
    };
    users: {
        add: (user: UserInsertType) => Promise<number>;
        clear: () => Promise<void>;
        get: (id: number) => Promise<UserReturnType | undefined>;
        orderBy: (field: string) => any;
        put: (user: UserInsertType) => Promise<number>;
    };
    workoutEvents: {
        add: (workoutEvent: WorkoutEventInsertType) => Promise<number>;
        clear: () => Promise<void>;
        filter: (callback: (event: WorkoutEventReturnType) => boolean) => any;
        toArray: () => Promise<WorkoutEventReturnType[]>;
        where: (query: any) => any;
    };
    workoutExercises: {
        // add: (workoutExercise: WorkoutExerciseInsertType) => Promise<number>;
        clear: () => Promise<void>;
        where: (query: any) => any;
    };
    workouts: {
        // add: (workout: WorkoutInsertType) => Promise<number>;
        clear: () => Promise<void>;
        // get: (id: number) => Promise<WorkoutReturnType | undefined>;
        // toArray: () => Promise<WorkoutReturnType[]>;
        // update: (id: number, workout: WorkoutInsertType) => Promise<number>;
    };
}

type WorkoutExerciseInsertTypeWithStrValues = { setIds: string } & Omit<WorkoutExerciseInsertType, 'setIds'>;

type WorkoutExerciseReturnTypeWithStrValues = { setIds: string } & Omit<WorkoutExerciseReturnType, 'setIds'>;

type WorkoutInsertTypeWithStrValues = { workoutExerciseIds: string } & Omit<WorkoutInsertType, 'workoutExerciseIds'>;

export class WorkoutLoggerDatabase extends Dexie implements IDatabase {
    bio!: Dexie.Table<BioReturnType, number, BioInsertType>;
    chats!: Dexie.Table<ChatReturnType, number, ChatInsertType>;
    exercises!: Dexie.Table<ExerciseReturnType, number, ExerciseInsertType>;
    oneRepMaxes!: Dexie.Table<OneRepMaxReturnType, number, OneRepMaxInsertType>;
    sets!: Dexie.Table<SetReturnType, number, SetInsertType>;
    settings!: Dexie.Table<SettingsReturnType, number, SettingsInsertType>;
    userMeasurements!: Dexie.Table<({ measurements: string } & Omit<UserMeasurementsReturnType, 'measurements'>), number, { measurements: string } & Omit<UserMeasurementsInsertType, 'measurements'>>;
    userMetrics!: Dexie.Table<UserMetricsDecryptedReturnType, number, UserMetricsInsertType>;
    userNutrition!: Dexie.Table<UserNutritionDecryptedReturnType, number, UserNutritionInsertType>;
    users!: Dexie.Table<UserReturnType, number, UserInsertType>;
    versioning!: Dexie.Table<VersioningReturnType, number, VersioningInsertType>;
    workoutEvents!: Dexie.Table<WorkoutEventReturnType, number, WorkoutEventInsertType>;
    workoutExercises!: Dexie.Table<WorkoutExerciseReturnTypeWithStrValues, number, WorkoutExerciseInsertTypeWithStrValues>;
    workouts!: Dexie.Table<WorkoutReturnType, number, WorkoutInsertTypeWithStrValues>;

    constructor() {
        super('WorkoutLoggerDatabase');
        this.version(1).stores({
            bio: [
                '++id',
                'value',
                'createdAt',
                'deletedAt',
            ].join(', '),
            chats: [
                '++id',
                'message',
                'sender',
                'type',
                'misc',
                'createdAt',
                'deletedAt',
            ].join(', '),
            exercises: [
                '++id',
                'name',
                'muscleGroup',
                'type',
                'description',
                'image',
                'createdAt',
                'deletedAt',
            ].join(', '),
            oneRepMaxes: [
                '++id',
                'exerciseId',
                'weight',
                'createdAt',
                'deletedAt',
            ].join(', '),
            sets: [
                '++id',
                'reps',
                'weight',
                'restTime',
                'isDropSet',
                'difficultyLevel',
                'exerciseId',
                'createdAt',
                'deletedAt',
            ].join(', '),
            settings: [
                '++id',
                '&type',
                'value',
                'createdAt',
                'deletedAt',
            ].join(', '),
            userMeasurements: [
                '++id',
                'dataId',
                'date',
                'measurements',
                'source',
                'userId',
                'createdAt',
                'deletedAt',
            ].join(', '),
            userMetrics: [
                '++id',
                'userId',
                'weight',
                'height',
                'fatPercentage',
                'eatingPhase',
                'dataId',
                'date',
                'source',
                'createdAt',
                'deletedAt',
            ].join(', '),
            userNutrition: [
                '++id',
                'userId',
                'dataId',
                'name',
                'calories',
                'protein',
                'carbohydrate',
                'sugar',
                'alcohol',
                'fiber',
                'fat',
                'monounsaturatedFat',
                'polyunsaturatedFat',
                'saturatedFat',
                'transFat',
                'unsaturatedFat',
                'date',
                'type',
                'source',
                'createdAt',
                'deletedAt',
            ].join(', '),
            users: [
                '++id',
                'name',
                'birthday',
                'fitnessGoals',
                'activityLevel',
                'liftingExperience',
                'gender',
                'createdAt',
                'deletedAt',
            ].join(', '),
            versioning: [
                '++id',
                'version',
            ].join(', '),
            workoutEvents: [
                '++id',
                'date',
                'duration',
                '[workoutId+date]',
                'workoutId',
                'status',
                'title',
                'bodyWeight',
                'fatPercentage',
                'eatingPhase',
                'exhaustionLevel',
                'workoutScore',
                'workoutVolume',
                'exerciseData',
                'recurringOnWeek',
                'description',
                'createdAt',
                'deletedAt',
                'protein',
                'carbohydrate',
                'fat',
                'calories',
                'alcohol',
                'fiber',
            ].join(', '),
            workoutExercises: [
                '++id',
                'workoutId',
                'exerciseId',
                'setIds',
                'order',
                'createdAt',
                'deletedAt',
            ].join(', '),
            workouts: [
                '++id',
                'title',
                'description',
                'workoutExerciseIds',
                'recurringOnWeek',
                'volumeCalculationType',
                'createdAt',
                'deletedAt',
            ].join(', '),
        });

        this.on('populate', () => this.populate());
    }

    private async populate() {
        // Seed initial data if needed
        // seedInitialData();
    }
}

const database = new WorkoutLoggerDatabase();

export const listenToDatabaseChanges = (callback: () => void) => {
    return callback;
};

// Create functions

export const addUserMeasurements = async (userMeasurements: UserMeasurementsInsertType): Promise<number> => {
    const createdAt = userMeasurements.createdAt || getCurrentTimestamp();
    return database.userMeasurements.add({
        ...userMeasurements,
        createdAt,
        measurements: JSON.stringify(userMeasurements.measurements),
    });
};

export const addVersioning = async (version: string): Promise<null | number> => {
    try {
        const existingVersion = await getVersioningByVersioning(version);

        if (existingVersion) {
            return existingVersion.id;
        } else {
            return await database.versioning.add({ version });
        }
    } catch (error) {
        throw error;
    }
};

export const addWorkoutWithExercises = async (workout: WorkoutInsertType, workoutExercises: WorkoutExerciseInsertType[], existingWorkoutId?: number): Promise<number> => {
    let workoutId;

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

    await database.workouts.update(workoutId, {
        workoutExerciseIds: JSON.stringify(workoutExerciseIds),
    });

    return workoutId;
};

export const addWorkout = async (workout: WorkoutInsertType): Promise<number> => {
    const createdAt = workout.createdAt || getCurrentTimestamp();
    return database.workouts.add({
        ...workout,
        createdAt,
        workoutExerciseIds: JSON.stringify(workout.workoutExerciseIds),
    });
};

export const addWorkoutExercise = async (workoutExercise: WorkoutExerciseInsertType): Promise<number> => {
    const createdAt = workoutExercise.createdAt || getCurrentTimestamp();
    return database.workoutExercises.add({
        ...workoutExercise,
        createdAt,
        setIds: JSON.stringify(workoutExercise.setIds),
    });
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
                        id: set.id,
                        isDropSet: set.isDropSet,
                        reps: set.reps,
                        restTime: set.restTime,
                        setId: set.id,
                        weight: set.weight,
                    } as Omit<SetReturnType, 'exerciseId'>;
                }),
            };
        }));
    }

    return database.workoutEvents.add({
        ...workoutEvent,
        bodyWeight: user?.metrics.weight || 0,
        createdAt,
        eatingPhase: user?.metrics.eatingPhase || '',
        exerciseData,
        fatPercentage: user?.metrics.fatPercentage || 0,
    });
};

export const addOneRepMax = async (exerciseId: number, weight: number, createdAt?: string): Promise<number> => {
    const createdTimestamp = createdAt || getCurrentTimestamp();
    return database.oneRepMaxes.add({ createdAt: createdTimestamp, exerciseId, weight });
};

export const addBio = async (value: string, createdAt?: string): Promise<number> => {
    const createdTimestamp = createdAt || getCurrentTimestamp();
    return database.bio.add({ createdAt: createdTimestamp, value });
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
    return database.settings.add({ createdAt: createdTimestamp, type, value });
};

export const addExercise = async (exercise: ExerciseInsertType): Promise<number> => {
    const createdAt = exercise.createdAt || getCurrentTimestamp();
    return database.exercises.add({ ...exercise, createdAt });
};

export const addSet = async (set: SetInsertType): Promise<number> => {
    const createdAt = set.createdAt || getCurrentTimestamp();
    return database.sets.add({ ...set, createdAt });
};

export const addOrUpdateUser = async (user: UserInsertType, userMetrics?: UserMetricsInsertType): Promise<number> => {
    const existingUser = await getUser();
    if (existingUser) {
        const result = updateUser(existingUser.id, {
            ...existingUser,
            ...user,
        });

        if (userMetrics) {
            await addUserMetrics({ ...userMetrics, userId: existingUser.id! });
        }

        return result;
    }

    return addUser(user, userMetrics);
};

const addUser = async (user: UserInsertType, userMetrics?: UserMetricsInsertType): Promise<number> => {
    const createdAt = user.createdAt || getCurrentTimestamp();
    const userId = await database.users.add({ ...user, createdAt });

    if (userMetrics) {
        await addUserMetrics({ ...userMetrics, userId });
    }

    return userId;
};

export const addUserMetrics = async (userMetrics: UserMetricsInsertType): Promise<number> => {
    const createdAt = userMetrics.createdAt || getCurrentTimestamp();
    if (userMetrics.dataId) {
        const existingUserMetrics = await getUserMetricsByDataId(userMetrics.dataId);

        if (existingUserMetrics) {
            return updateUserMetrics(existingUserMetrics.id, {
                ...existingUserMetrics,
                ...userMetrics,
            });
        }
    }

    if (!userMetrics.userId) {
        const user = await getLatestUser();
        if (user) {
            userMetrics.userId = user.id!;
        } else {
            console.error('No user found to add metrics to');
            return 0;
        }
    }

    return database.userMetrics.add({ ...userMetrics, createdAt });
};

const addChatRaw = async (chat: ChatInsertType): Promise<number> => {
    const createdAt = chat.createdAt || getCurrentTimestamp();
    return database.chats.add({ ...chat, createdAt });
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

    return database.userNutrition.add({
        ...userNutrition,
        createdAt,
    });
};

// Get functions

export const getUserMeasurements = async (id: number): Promise<UserMeasurementsReturnType | undefined> => {
    const result = await database.userMeasurements
        .where({ id })
        .filter((userMeasurements) => userMeasurements.deletedAt === null || userMeasurements.deletedAt === undefined)
        .first();

    if (result) {
        return {
            ...result,
            measurements: JSON.parse(result.measurements),
        } as UserMeasurementsReturnType;
    }

    return undefined;
};

export const getUserMeasurementsBetweenDates = async (startDate: string, endDate: string): Promise<({ measurements: string } & UserMeasurementsReturnType)[]> => {
    const result = await database.userMeasurements
        .where('date')
        .between(startDate, endDate, true, true)
        .filter((userMeasurements) => userMeasurements.deletedAt === null || userMeasurements.deletedAt === undefined)
        .toArray();

    return result.map((userMeasurements) => ({
        ...userMeasurements,
        measurements: JSON.parse(userMeasurements.measurements),
    }));
};

export const getUserMeasurementsFromDate = async (startDate: string): Promise<({ measurements: string } & UserMeasurementsReturnType)[]> => {
    const todayDate = new Date().toISOString();

    const result = await database.userMeasurements
        .where('date')
        .between(startDate, todayDate, true, true)
        .filter((userMeasurements) => userMeasurements.deletedAt === null || userMeasurements.deletedAt === undefined)
        .toArray();

    return result.map((userMeasurements) => ({
        ...userMeasurements,
        measurements: JSON.parse(userMeasurements.measurements),
    }));
};

export const getUserMeasurementsPaginated = async (offset = 0, limit = 20): Promise<UserMeasurementsReturnType[]> => {
    const result = await database.userMeasurements
        .orderBy('id')
        .filter((userMeasurements) => userMeasurements.deletedAt === null || userMeasurements.deletedAt === undefined)
        .offset(limit * offset)
        .limit(limit)
        .toArray();

    return result.map((userMeasurements) => ({
        ...userMeasurements,
        measurements: JSON.parse(userMeasurements.measurements),
    }));
};

export const getTotalUserMeasurementsCount = async (): Promise<number> => {
    return database.userMeasurements.count();
};

export const getLatestVersion = async (): Promise<string | undefined> => {
    const version = await database.versioning
        .orderBy('id')
        .last();

    return version?.version;
};

export const getVersioningByVersioning = async (version: string): Promise<VersioningReturnType | undefined> => {
    return database.versioning
        .where({ version })
        .first();
};

export const getOneRepMax = async (exerciseId: number): Promise<OneRepMaxReturnType | undefined> => {
    return database.oneRepMaxes
        .where({ exerciseId })
        .filter((oneRepMax) => oneRepMax.deletedAt === null || oneRepMax.deletedAt === undefined)
        .first();
};

export const getBio = async (id: number): Promise<BioReturnType | undefined> => {
    return database.bio
        .where({ id })
        .filter((bio) => bio.deletedAt === null || bio.deletedAt === undefined)
        .first();
};

export const getAllBio = async (): Promise<BioReturnType[]> => {
    return database.bio
        .filter((bio) => bio.deletedAt === null || bio.deletedAt === undefined)
        .toArray();
};

export const getSetting = async (type: string): Promise<SettingsReturnType | undefined> => {
    return database.settings
        .where({ type })
        .filter((setting) => setting.deletedAt === null || setting.deletedAt === undefined)
        .first();
};

export const getAllSettings = async (): Promise<SettingsReturnType[]> => {
    return database.settings
        .filter((setting) => setting.deletedAt === null || setting.deletedAt === undefined)
        .toArray();
};

export const getAllChats = async (): Promise<ChatReturnType[]> => {
    return database.chats
        .filter((chat) => chat.deletedAt === null || chat.deletedAt === undefined)
        .toArray();
};

export const getChatsPaginated = async (offset = 0, limit = 20): Promise<ChatReturnType[]> => {
    return database.chats
        .orderBy('id')
        .filter((chat) => chat.deletedAt === null || chat.deletedAt === undefined)
        .reverse()
        .offset(limit * offset)
        .limit(limit)
        .toArray();
};

export const getUser = async (id?: number): Promise<UserWithMetricsType | undefined> => {
    if (!id) {
        return getLatestUser();
    }

    const user = await database.users
        .where({ id })
        .filter((user) => user.deletedAt === null || user.deletedAt === undefined)
        .first();

    if (user) {
        const metrics = await getAllLatestMetricsForUser(user.id!) || {};
        return { ...user, metrics } as UserWithMetricsType;
    }

    return undefined;
};

export const getAllUsers = async (): Promise<UserReturnType[]> => {
    return database.users
        .filter((user) => user.deletedAt === null || user.deletedAt === undefined)
        .toArray();
};

export const getAllLatestMetricsForUser = async (userId: number): Promise<MetricsForUserType | undefined> => {
    const metrics = await database.userMetrics
        .orderBy('date')
        .filter((userMetrics) => (userMetrics.deletedAt === null || userMetrics.deletedAt === undefined) && userMetrics.userId === userId)
        .toArray();

    if (metrics.length === 0) {
        return undefined;
    }

    const latestMetrics: MetricsForUserType = {
        date: getCurrentTimestamp(),
        eatingPhase: undefined,
        fatPercentage: undefined,
        height: undefined,
        latestId: -1,
        source: USER_METRICS_SOURCES.USER_INPUT,
        weight: undefined,
    };

    const ids: number[] = [];
    metrics.forEach((metric) => {
        if (metric.eatingPhase && !latestMetrics.eatingPhase) {
            latestMetrics.eatingPhase = metric.eatingPhase;
            ids.push(metric.id!);
        }

        if (metric.fatPercentage !== undefined && latestMetrics.fatPercentage === undefined) {
            const newFatPercentage = parseFloat(String(metric.fatPercentage));

            if (!isNaN(newFatPercentage)) {
                latestMetrics.fatPercentage = newFatPercentage;
            }

            ids.push(metric.id!);
        }

        if (metric.height !== undefined && latestMetrics.height === undefined) {
            const newHeight = parseFloat(String(metric.height));

            if (!isNaN(newHeight)) {
                latestMetrics.height = newHeight;
            }

            ids.push(metric.id!);
        }

        if (metric.weight !== undefined && latestMetrics.weight === undefined) {
            const newWeight = parseFloat(String(metric.weight));

            if (!isNaN(newWeight)) {
                latestMetrics.weight = newWeight;
            }

            ids.push(metric.id!);
        }
    });

    latestMetrics.latestId = Math.max(...ids);
    if (latestMetrics.latestId === -1) {
        return undefined;
    }

    return latestMetrics;
};

export const getAllUserMetricsByUserId = async (userId: number): Promise<UserMetricsDecryptedReturnType[]> => {
    const results = await database.userMetrics
        .where({ userId })
        .filter((userMetrics) => userMetrics.deletedAt === null || userMetrics.deletedAt === undefined)
        .toArray();

    return results.map((userMetrics) => ({
        ...userMetrics,
        fatPercentage: parseFloat(String(userMetrics.fatPercentage)),
        height: parseFloat(String(userMetrics.height)),
        weight: parseFloat(String(userMetrics.weight))
    }));
};

export const getUserMetrics = async (id: number): Promise<UserMetricsDecryptedReturnType | undefined> => {
    const userMetrics = await database.userMetrics
        .where({ id })
        .filter((userMetrics) => userMetrics.deletedAt === null || userMetrics.deletedAt === undefined)
        .first();

    if (userMetrics) {
        return {
            ...userMetrics,
            fatPercentage: parseFloat(String(userMetrics.fatPercentage)),
            height: parseFloat(String(userMetrics.height)),
            weight: parseFloat(String(userMetrics.weight))
        };
    }
    return undefined;
};

export const getUserMetricsPaginated = async (offset = 0, limit = 20): Promise<UserMetricsDecryptedReturnType[]> => {
    const results = await database.userMetrics
        .orderBy('date')
        .reverse()
        .filter((userMetrics) => userMetrics.deletedAt === null || userMetrics.deletedAt === undefined)
        .offset(offset)
        .limit(limit)
        .toArray();

    return results.map((userMetrics) => ({
        ...userMetrics,
        fatPercentage: parseFloat(String(userMetrics.fatPercentage)),
        height: parseFloat(String(userMetrics.height)),
        weight: parseFloat(String(userMetrics.weight))
    }));
};

export const getUserMetricsBetweenDates = async (startDate: string, endDate: string): Promise<UserMetricsDecryptedReturnType[]> => {
    const results = await database.userMetrics
        .where('date')
        .between(startDate, endDate, true, true)
        .filter((userMetrics) => userMetrics.deletedAt === null || userMetrics.deletedAt === undefined)
        .toArray();

    return results.map((userMetrics) => ({
        ...userMetrics,
        fatPercentage: parseFloat(String(userMetrics.fatPercentage)),
        height: parseFloat(String(userMetrics.height)),
        weight: parseFloat(String(userMetrics.weight))
    }));
};

export const getUserMetricsFromDate = async (startDate: string): Promise<UserMetricsDecryptedReturnType[]> => {
    const todayDate = new Date().toISOString();

    const results = await database.userMetrics
        .where('date')
        .between(startDate, todayDate, true, true)
        .and((userMetrics) => userMetrics.deletedAt === null || userMetrics.deletedAt === undefined)
        // .reverse()
        .toArray();

    return results.map((userMetrics) => ({
        ...userMetrics,
        fatPercentage: parseFloat(String(userMetrics.fatPercentage)),
        height: parseFloat(String(userMetrics.height)),
        weight: parseFloat(String(userMetrics.weight))
    }));
};

export const getTotalUserMetricsCount = async (): Promise<number> => {
    return database.userMetrics.count();
};

export const getAllUserMetrics = async (): Promise<UserMetricsDecryptedReturnType[]> => {
    const results = await database.userMetrics
        .filter((userMetrics) => userMetrics.deletedAt === null || userMetrics.deletedAt === undefined)
        .toArray();

    return results.map((userMetrics) => ({
        ...userMetrics,
        fatPercentage: parseFloat(String(userMetrics.fatPercentage)),
        height: parseFloat(String(userMetrics.height)),
        weight: parseFloat(String(userMetrics.weight))
    }));
};

export const getAllUserNutrition = async (): Promise<UserNutritionDecryptedReturnType[]> => {
    const results = await database.userNutrition
        .filter((userNutrition) => userNutrition.deletedAt === null || userNutrition.deletedAt === undefined)
        .toArray();

    return results.map((userNutrition) => ({
        ...userNutrition,
        calories: parseFloat(String(userNutrition.calories)),
        carbohydrate: parseFloat(String(userNutrition.carbohydrate)),
        fat: parseFloat(String(userNutrition.fat)),
        fiber: parseFloat(String(userNutrition.fiber)),
        monounsaturatedFat: parseFloat(String(userNutrition.monounsaturatedFat)),
        polyunsaturatedFat: parseFloat(String(userNutrition.polyunsaturatedFat)),
        protein: parseFloat(String(userNutrition.protein)),
        saturatedFat: parseFloat(String(userNutrition.saturatedFat)),
        sugar: parseFloat(String(userNutrition.sugar)),
        transFat: parseFloat(String(userNutrition.transFat)),
        unsaturatedFat: parseFloat(String(userNutrition.unsaturatedFat))
    }));
};

export const getUserMetricsByDataId = async (dataId: string): Promise<UserMetricsDecryptedReturnType | undefined> => {
    const userMetrics = await database.userMetrics
        .where({ dataId })
        .filter((userMetrics) => userMetrics.deletedAt === null || userMetrics.deletedAt === undefined)
        .first();

    if (userMetrics) {
        return {
            ...userMetrics,
            fatPercentage: parseFloat(String(userMetrics.fatPercentage)),
            height: parseFloat(String(userMetrics.height)),
            weight: parseFloat(String(userMetrics.weight))
        };
    }
    return undefined;
};

export const getLatestUserMetrics = async (): Promise<UserMetricsDecryptedReturnType | undefined> => {
    const userMetrics = await database.userMetrics
        .orderBy('id')
        .filter((userMetrics) => userMetrics.deletedAt === null || userMetrics.deletedAt === undefined)
        .last();

    if (userMetrics) {
        return {
            ...userMetrics,
            fatPercentage: parseFloat(String(userMetrics.fatPercentage)),
            height: parseFloat(String(userMetrics.height)),
            weight: parseFloat(String(userMetrics.weight))
        };
    }
    return undefined;
};

export const getLatestUser = async (): Promise<UserWithMetricsType | undefined> => {
    const user = await database.users
        .orderBy('id')
        .filter((user) => user.deletedAt === null || user.deletedAt === undefined)
        .last();

    if (user) {
        const metrics = await getAllLatestMetricsForUser(user.id!) || {};
        return { ...user, metrics } as UserWithMetricsType;
    }

    return undefined;
};

export const getAllExercises = async (): Promise<ExerciseReturnType[]> => {
    return database.exercises
        .filter((exercise) => exercise.deletedAt === null || exercise.deletedAt === undefined)
        .toArray();
};

export const getExercisesPaginated = async (offset = 0, limit = 20): Promise<ExerciseReturnType[]> => {
    return database.exercises
        .orderBy('id')
        .reverse()
        .filter((exercise) => exercise.deletedAt === null || exercise.deletedAt === undefined)
        .offset(offset)
        .limit(limit)
        .toArray();
};

export const getTotalExercisesCount = async (): Promise<number> => {
    return database.exercises.count();
};

export const getExercisesByWorkoutExerciseIds = async (workoutExerciseIds: number[]): Promise<ExerciseReturnType[]> => {
    const workoutExercises = await database.workoutExercises
        .where('id')
        .anyOf(workoutExerciseIds)
        .filter((workoutExercise) => workoutExercise.deletedAt === null || workoutExercise.deletedAt === undefined)
        .toArray();

    const exerciseIds = workoutExercises.map((workoutExercise) => workoutExercise.exerciseId);

    return database.exercises
        .where('id')
        .anyOf(exerciseIds)
        .filter((exercise) => exercise.deletedAt === null || exercise.deletedAt === undefined)
        .toArray();
};

export const getAllWorkouts = async (): Promise<WorkoutReturnType[]> => {
    const result = await database.workouts
        .filter((workout) => workout.deletedAt === null || workout.deletedAt === undefined)
        .toArray();

    return result.map((workout) => ({
        ...workout,
        workoutExerciseIds: JSON.parse(workout.workoutExerciseIds as unknown as string || '[]') as number[],
    }));
};

export const getAllWorkoutsWithTrashed = async (): Promise<WorkoutReturnType[]> => {
    const result = await database.workouts.toArray();

    return result.map((workout) => ({
        ...workout,
        // TODO: maybe have a type for saving and for getting
        workoutExerciseIds: JSON.parse(workout.workoutExerciseIds as unknown as string || '[]') as number[],
    }));
};

export const getRecurringWorkouts = async (): Promise<WorkoutReturnType[] | undefined> => {
    const result = await database.workouts
        .filter((workout) => Boolean(workout.recurringOnWeek))
        .toArray();

    return result.map((workout) => ({
        ...workout,
        workoutExerciseIds: JSON.parse(workout.workoutExerciseIds as unknown as string || '[]') as number[],
    }));
};

export const getWorkouts = async (): Promise<WorkoutReturnType[] | undefined> => {
    const result = await database.workouts
        .filter((workout) => workout.deletedAt === null || workout.deletedAt === undefined)
        .toArray();

    return result.map((workout) => ({
        ...workout,
        workoutExerciseIds: JSON.parse(workout.workoutExerciseIds as unknown as string || '[]') as number[],
    }));
};

export const getWorkoutById = async (id: number): Promise<WorkoutReturnType | undefined> => {
    const result = await database.workouts
        .where({ id })
        .filter((workout) => workout.deletedAt === null || workout.deletedAt === undefined)
        .first();

    return {
        ...result,
        workoutExerciseIds: JSON.parse(result?.workoutExerciseIds as unknown as string || '[]') as number[],
    } as WorkoutReturnType;
};

export const getWorkoutByIdWithTrashed = async (id: number): Promise<WorkoutReturnType | undefined> => {
    const result = await database.workouts
        .where({ id })
        .first();

    return {
        ...result,
        workoutExerciseIds: JSON.parse(result?.workoutExerciseIds as unknown as string || '[]') as number[],
    } as WorkoutReturnType;
};

export const getSetsByExerciseId = async (exerciseId: number): Promise<SetReturnType[]> => {
    return database.sets
        .where({ exerciseId })
        .filter((set) => set.deletedAt === null || set.deletedAt === undefined)
        .toArray();
};

export const getSetById = async (setId: number): Promise<SetReturnType | null | undefined> => {
    return database.sets
        .where({ id: setId })
        .filter((set) => set.deletedAt === null || set.deletedAt === undefined)
        .first();
};

export const getSetsByIds = async (setIds: number[]): Promise<SetReturnType[]> => {
    return database.sets
        .where('id').anyOf(setIds)
        .filter((set) => set.deletedAt === null || set.deletedAt === undefined)
        .toArray();
};

export const getSetsByIdsAndExerciseId = async (setIds: number[], exerciseId: number): Promise<SetReturnType[]> => {
    const sets: SetReturnType[] = await database.sets
        .where('id').anyOf(setIds)
        .filter((set) => set.deletedAt === null || set.deletedAt === undefined)
        .toArray();

    return sets.filter((set) => set.exerciseId === exerciseId);
};

export const getExerciseById = async (id: number): Promise<ExerciseReturnType | undefined> => {
    return database.exercises
        .where({ id })
        .filter((exercise) => exercise.deletedAt === null || exercise.deletedAt === undefined)
        .first();
};

export const getExercisesForWorkout = async (workoutId: number): Promise<ExerciseReturnType[]> => {
    const workoutExercises = await database.workoutExercises
        .where({ workoutId })
        .filter((workoutExercise) => workoutExercise.deletedAt === null || workoutExercise.deletedAt === undefined)
        .toArray();
    const exerciseIds = workoutExercises.map((workoutExercise) => workoutExercise.exerciseId);
    return database.exercises
        .where('id').anyOf(exerciseIds)
        .filter((exercise) => exercise.deletedAt === null || exercise.deletedAt === undefined)
        .toArray();
};

export const getWorkoutEvent = async (id: number): Promise<WorkoutEventReturnType | undefined> => {
    return database.workoutEvents
        .where({ id })
        .filter((workoutEvent) => workoutEvent.deletedAt === null || workoutEvent.deletedAt === undefined)
        .first();
};

export const getWorkoutEvents = async (): Promise<WorkoutEventReturnType[]> => {
    return database.workoutEvents
        .filter((workoutEvent) => workoutEvent.deletedAt === null || workoutEvent.deletedAt === undefined)
        .toArray();
};

export const getWorkoutEventsByExerciseId = async (exerciseId: number): Promise<WorkoutEventReturnType[]> => {
    const workoutExercises = await database.workoutExercises
        .where({ exerciseId })
        .filter((workoutExercise) => workoutExercise.deletedAt === null || workoutExercise.deletedAt === undefined)
        .toArray();
    const workoutIds = workoutExercises.map((workoutExercise) => workoutExercise.workoutId);

    return database.workoutEvents
        .where('workoutId')
        .anyOf(workoutIds)
        .filter((workoutEvent) => workoutEvent.deletedAt === null || workoutEvent.deletedAt === undefined)
        .toArray();
};

export const getWorkoutEventsByWorkoutId = async (workoutId: number): Promise<WorkoutEventReturnType[]> => {
    return database.workoutEvents
        .where('workoutId')
        .equals(workoutId)
        .filter((workoutEvent) => workoutEvent.deletedAt === null || workoutEvent.deletedAt === undefined)
        .toArray();
};

export const getRecentWorkoutsByWorkoutId = async (workoutId: number): Promise<WorkoutEventReturnType[]> => {
    return database.workoutEvents
        .where('workoutId')
        .anyOf(workoutId)
        .filter((workoutEvent) => workoutEvent.status === COMPLETED_STATUS && (workoutEvent.deletedAt === null || workoutEvent.deletedAt === undefined))
        .toArray();
};

export const getUpcomingWorkoutsByWorkoutId = async (workoutId: number): Promise<WorkoutEventReturnType[]> => {
    const todayDate = new Date().toISOString();
    return database.workoutEvents
        .where('workoutId')
        .anyOf(workoutId)
        .filter((workoutEvent) =>
            workoutEvent.status === SCHEDULED_STATUS && (workoutEvent.deletedAt === null || workoutEvent.deletedAt === undefined) && workoutEvent.date > todayDate
        )
        .toArray();
};

export const getUpcomingWorkouts = async (): Promise<WorkoutEventReturnType[]> => {
    const todayDate = new Date().toISOString();
    return database.workoutEvents
        .where('status')
        .equals(SCHEDULED_STATUS)
        .filter((workoutEvent) =>
            (workoutEvent.deletedAt === null || workoutEvent.deletedAt === undefined) && workoutEvent.date > todayDate
        )
        .toArray();
};

export const getTotalUpcomingWorkoutsCount = async (): Promise<number> => {
    const todayDate = new Date().toISOString();
    return database.workoutEvents
        .where('status')
        .equals(SCHEDULED_STATUS)
        .filter((workoutEvent) =>
            (workoutEvent.deletedAt === null || workoutEvent.deletedAt === undefined) && workoutEvent.date > todayDate
        )
        .count();
};

export const getUpcomingWorkoutsPaginated = async (offset: number, limit: number): Promise<WorkoutEventReturnType[]> => {
    const todayDate = new Date().toISOString().split('T')[0];

    return database.workoutEvents
        .where('status')
        .equals(SCHEDULED_STATUS)
        .filter((workoutEvent) => {
            const workoutEventDate = workoutEvent.date.split('T')[0];
            return (
                (workoutEvent.deletedAt === null || workoutEvent.deletedAt === undefined)
                && workoutEventDate >= todayDate
            );
        })
        .offset(offset)
        .limit(limit)
        .toArray();
};

export const getRecentWorkouts = async (): Promise<WorkoutEventReturnType[]> => {
    return database.workoutEvents
        .where('status').equals(COMPLETED_STATUS)
        .filter((workoutEvent) => workoutEvent.deletedAt === null || workoutEvent.deletedAt === undefined)
        .toArray();
};

export const getRecentWorkoutById = async (id: number): Promise<WorkoutEventReturnType | undefined> => {
    return database.workoutEvents
        .where({ id })
        .filter((workoutEvent) => workoutEvent.deletedAt === null || workoutEvent.deletedAt === undefined)
        .first();
};

export const getTotalRecentWorkoutsCount = async (): Promise<number> => {
    return database.workoutEvents
        .where('status')
        .equals(COMPLETED_STATUS)
        .count();
};

export const getRecentWorkoutsBetweenDates = async (startDate: string, endDate: string): Promise<WorkoutEventReturnType[]> => {
    return database.workoutEvents
        .where('date')
        .between(startDate, endDate, true, true)
        .filter((workoutEvent) => workoutEvent.deletedAt === null || workoutEvent.deletedAt === undefined)
        .toArray();
};

export const getRecentWorkoutsFromDate = async (startDate: string): Promise<WorkoutEventReturnType[]> => {
    const todayDate = new Date().toISOString();

    return database.workoutEvents
        .where('date')
        .between(startDate, todayDate, true, true)
        .filter((workoutEvent) => workoutEvent.deletedAt === null || workoutEvent.deletedAt === undefined)
        .toArray();
};

export const getRecentWorkoutsPaginated = async (offset: number, limit: number): Promise<WorkoutEventReturnType[]> => {
    const allWorkouts = await database.workoutEvents
        .where('status')
        .equals(COMPLETED_STATUS)
        .filter((workoutEvent) => workoutEvent.deletedAt === null || workoutEvent.deletedAt === undefined)
        .toArray();

    allWorkouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return allWorkouts.slice(offset, offset + limit);
};

export const getWorkoutExercisesByExerciseIds = async (exerciseIds: number[]): Promise<WorkoutExerciseReturnType[]> => {
    const result = await database.workoutExercises
        .where('exerciseId')
        .anyOf(exerciseIds)
        .filter((workoutExercise) => workoutExercise.deletedAt === null || workoutExercise.deletedAt === undefined)
        .toArray();

    return result.map((workoutExercise) => ({
        ...workoutExercise,
        // TODO: maybe have a type for saving and for getting
        setIds: JSON.parse(workoutExercise.setIds as unknown as string || '[]') as number[],
    }));
};

export const getWorkoutExercises = async (id: number): Promise<WorkoutExerciseReturnType | undefined> => {
    const result = await database.workoutExercises
        .where({ id })
        .filter((workoutExercise) => workoutExercise.deletedAt === null || workoutExercise.deletedAt === undefined)
        .first();

    if (result) {
        return {
            ...result,
            // TODO: maybe have a type for saving and for getting
            setIds: JSON.parse(result.setIds as unknown as string || '[]') as number[],
        };
    }

    return result ?? undefined;
};

export const getWorkoutExercisesByWorkoutId = async (workoutId: number): Promise<WorkoutExerciseReturnType[]> => {
    const result = await database.workoutExercises
        .where({ workoutId })
        .filter((workoutExercise) => workoutExercise.deletedAt === null || workoutExercise.deletedAt === undefined)
        .sortBy('order');

    return result.map((workoutExercise) => ({
        ...workoutExercise,
        // TODO: maybe have a type for saving and for getting
        setIds: JSON.parse(workoutExercise.setIds as unknown as string || '[]') as number[],
    }));
};

export const getWorkoutExerciseByWorkoutIdAndExerciseId = async (workoutId: number, exerciseId: number): Promise<WorkoutExerciseReturnType | undefined> => {
    const result = await database.workoutExercises
        .where({ exerciseId, workoutId })
        .filter((workoutExercise) => workoutExercise.deletedAt === null || workoutExercise.deletedAt === undefined)
        .first();

    if (result) {
        return {
            ...result,
            // TODO: maybe have a type for saving and for getting
            setIds: JSON.parse(result.setIds as unknown as string || '[]') as number[],
        };
    }

    return result ?? undefined;
};

export const getWorkoutExerciseByExerciseId = async (exerciseId: number): Promise<WorkoutExerciseReturnType[] | undefined> => {
    const result = await database.workoutExercises
        .where({ exerciseId })
        .filter((workoutExercise) => workoutExercise.deletedAt === null || workoutExercise.deletedAt === undefined)
        .toArray();

    if (!result) {
        return undefined;
    }

    return result.map((workoutExercise) => ({
        ...workoutExercise,
        // TODO: maybe have a type for saving and for getting
        setIds: JSON.parse(workoutExercise.setIds as unknown as string || '[]') as number[],
    }));
};

export const getWorkoutDetails = async (workoutId: number): Promise<{ workout: WorkoutReturnType, workoutExercises: WorkoutExerciseReturnType[] } | undefined> => {
    const workout = await database.workouts
        .where({ id: workoutId })
        .filter((workout) => workout.deletedAt === null || workout.deletedAt === undefined)
        .first();
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
};

export const getWorkoutWithExercisesRepsAndSetsDetails = async (workoutId: number): Promise<WorkoutWithExercisesRepsAndSetsDetailsReturnType | undefined> => {
    const workout = await database.workouts
        .where({ id: workoutId })
        .filter((workout) => workout.deletedAt === null || workout.deletedAt === undefined)
        .first();

    if (!workout) {
        return undefined;
    }

    return {
        exercises: await getExercisesWithSetsFromWorkout(workoutId),
        id: workout.id,
        title: workout.title,
    };
};

export const getTotalWorkoutsCount = async (): Promise<number> => {
    return database.workouts.count();
};

export const getWorkoutsPaginated = async (offset: number, limit: number): Promise<WorkoutReturnType[]> => {
    const result = await database.workouts
        .filter((workout) => workout.deletedAt === null || workout.deletedAt === undefined)
        .offset(offset)
        .limit(limit)
        .toArray();

    return result.map((workout) => ({
        ...workout,
        workoutExerciseIds: JSON.parse(workout.workoutExerciseIds as unknown as string || '[]') as number[],
    }));
};

export const getUserNutrition = async (id: number): Promise<UserNutritionDecryptedReturnType | undefined> => {
    const userNutrition = await database.userNutrition
        .where({ id })
        .filter((userNutrition) => userNutrition.deletedAt === null || userNutrition.deletedAt === undefined)
        .first();

    if (userNutrition) {
        return {
            ...userNutrition,
            calories: parseFloat(String(userNutrition.calories)),
            carbohydrate: parseFloat(String(userNutrition.carbohydrate)),
            fat: parseFloat(String(userNutrition.fat)),
            fiber: parseFloat(String(userNutrition.fiber)),
            monounsaturatedFat: parseFloat(String(userNutrition.monounsaturatedFat)),
            polyunsaturatedFat: parseFloat(String(userNutrition.polyunsaturatedFat)),
            protein: parseFloat(String(userNutrition.protein)),
            saturatedFat: parseFloat(String(userNutrition.saturatedFat)),
            sugar: parseFloat(String(userNutrition.sugar)),
            transFat: parseFloat(String(userNutrition.transFat)),
            unsaturatedFat: parseFloat(String(userNutrition.unsaturatedFat))
        };
    }
    return undefined;
};

export const getLatestUserNutritionByUserId = async (userId: number): Promise<UserNutritionDecryptedReturnType | undefined> => {
    const userNutrition = await database.userNutrition
        .where({ userId })
        .filter((userNutrition) => userNutrition.deletedAt === null || userNutrition.deletedAt === undefined)
        .first();

    if (userNutrition) {
        return {
            ...userNutrition,
            calories: parseFloat(String(userNutrition.calories)),
            carbohydrate: parseFloat(String(userNutrition.carbohydrate)),
            fat: parseFloat(String(userNutrition.fat)),
            fiber: parseFloat(String(userNutrition.fiber)),
            monounsaturatedFat: parseFloat(String(userNutrition.monounsaturatedFat)),
            polyunsaturatedFat: parseFloat(String(userNutrition.polyunsaturatedFat)),
            protein: parseFloat(String(userNutrition.protein)),
            saturatedFat: parseFloat(String(userNutrition.saturatedFat)),
            sugar: parseFloat(String(userNutrition.sugar)),
            transFat: parseFloat(String(userNutrition.transFat)),
            unsaturatedFat: parseFloat(String(userNutrition.unsaturatedFat))
        };
    }
    return undefined;
};

export const getAllUserNutritionByUserId = async (userId: number): Promise<UserNutritionDecryptedReturnType[]> => {
    const results = await database.userNutrition
        .where({ userId })
        .filter((userNutrition) => userNutrition.deletedAt === null || userNutrition.deletedAt === undefined)
        .toArray();

    return results.map((userNutrition) => ({
        ...userNutrition,
        calories: parseFloat(String(userNutrition.calories)),
        carbohydrate: parseFloat(String(userNutrition.carbohydrate)),
        fat: parseFloat(String(userNutrition.fat)),
        fiber: parseFloat(String(userNutrition.fiber)),
        monounsaturatedFat: parseFloat(String(userNutrition.monounsaturatedFat)),
        polyunsaturatedFat: parseFloat(String(userNutrition.polyunsaturatedFat)),
        protein: parseFloat(String(userNutrition.protein)),
        saturatedFat: parseFloat(String(userNutrition.saturatedFat)),
        sugar: parseFloat(String(userNutrition.sugar)),
        transFat: parseFloat(String(userNutrition.transFat)),
        unsaturatedFat: parseFloat(String(userNutrition.unsaturatedFat))
    }));
};

export const getUserNutritionByDataId = async (dataId: string): Promise<UserNutritionDecryptedReturnType | undefined> => {
    const userNutrition = await database.userNutrition
        .where({ dataId })
        .filter((userNutrition) => userNutrition.deletedAt === null || userNutrition.deletedAt === undefined)
        .first();

    if (userNutrition) {
        return {
            ...userNutrition,
            calories: parseFloat(String(userNutrition.calories)),
            carbohydrate: parseFloat(String(userNutrition.carbohydrate)),
            fat: parseFloat(String(userNutrition.fat)),
            fiber: parseFloat(String(userNutrition.fiber)),
            monounsaturatedFat: parseFloat(String(userNutrition.monounsaturatedFat)),
            polyunsaturatedFat: parseFloat(String(userNutrition.polyunsaturatedFat)),
            protein: parseFloat(String(userNutrition.protein)),
            saturatedFat: parseFloat(String(userNutrition.saturatedFat)),
            sugar: parseFloat(String(userNutrition.sugar)),
            transFat: parseFloat(String(userNutrition.transFat)),
            unsaturatedFat: parseFloat(String(userNutrition.unsaturatedFat))
        };
    }
    return undefined;
};

export const getUserNutritionPaginated = async (offset = 0, limit = 20, order: 'ASC' | 'DESC' = 'ASC'): Promise<UserNutritionDecryptedReturnType[]> => {
    const results = await database.userNutrition
        .orderBy('date')
        .reverse()
        .filter((userNutrition) => userNutrition.deletedAt === null || userNutrition.deletedAt === undefined)
        .offset(offset)
        .limit(limit)
        .toArray();

    return results.map((userNutrition) => ({
        ...userNutrition,
        calories: parseFloat(String(userNutrition.calories)),
        carbohydrate: parseFloat(String(userNutrition.carbohydrate)),
        fat: parseFloat(String(userNutrition.fat)),
        fiber: parseFloat(String(userNutrition.fiber)),
        monounsaturatedFat: parseFloat(String(userNutrition.monounsaturatedFat)),
        polyunsaturatedFat: parseFloat(String(userNutrition.polyunsaturatedFat)),
        protein: parseFloat(String(userNutrition.protein)),
        saturatedFat: parseFloat(String(userNutrition.saturatedFat)),
        sugar: parseFloat(String(userNutrition.sugar)),
        transFat: parseFloat(String(userNutrition.transFat)),
        unsaturatedFat: parseFloat(String(userNutrition.unsaturatedFat))
    }));
};

export const getUserNutritionBetweenDates = async (startDate: string, endDate: string): Promise<UserNutritionDecryptedReturnType[]> => {
    const results = await database.userNutrition
        .where('date')
        .between(startDate, endDate, true, true)
        .and((userNutrition) => userNutrition.deletedAt === null || userNutrition.deletedAt === undefined)
        .toArray();

    return results.map((userNutrition) => ({
        ...userNutrition,
        calories: parseFloat(String(userNutrition.calories)),
        carbohydrate: parseFloat(String(userNutrition.carbohydrate)),
        fat: parseFloat(String(userNutrition.fat)),
        fiber: parseFloat(String(userNutrition.fiber)),
        monounsaturatedFat: parseFloat(String(userNutrition.monounsaturatedFat)),
        polyunsaturatedFat: parseFloat(String(userNutrition.polyunsaturatedFat)),
        protein: parseFloat(String(userNutrition.protein)),
        saturatedFat: parseFloat(String(userNutrition.saturatedFat)),
        sugar: parseFloat(String(userNutrition.sugar)),
        transFat: parseFloat(String(userNutrition.transFat)),
        unsaturatedFat: parseFloat(String(userNutrition.unsaturatedFat))
    }));
};

export const getUserNutritionFromDate = async (startDate: string): Promise<UserNutritionDecryptedReturnType[]> => {
    const todayDate = new Date().toISOString();

    const results = await database.userNutrition
        .where('date')
        .between(startDate, todayDate, true, true)
        .and((userNutrition) => userNutrition.deletedAt === null || userNutrition.deletedAt === undefined)
        // .reverse()
        .toArray();

    return results.map((userNutrition) => ({
        ...userNutrition,
        calories: parseFloat(String(userNutrition.calories)),
        carbohydrate: parseFloat(String(userNutrition.carbohydrate)),
        fat: parseFloat(String(userNutrition.fat)),
        fiber: parseFloat(String(userNutrition.fiber)),
        monounsaturatedFat: parseFloat(String(userNutrition.monounsaturatedFat)),
        polyunsaturatedFat: parseFloat(String(userNutrition.polyunsaturatedFat)),
        protein: parseFloat(String(userNutrition.protein)),
        saturatedFat: parseFloat(String(userNutrition.saturatedFat)),
        sugar: parseFloat(String(userNutrition.sugar)),
        transFat: parseFloat(String(userNutrition.transFat)),
        unsaturatedFat: parseFloat(String(userNutrition.unsaturatedFat))
    }));
};

export const getTotalUserNutritionCount = async (): Promise<number> => {
    return database.userNutrition.count();
};

// Update functions

export const updateUserMeasurements = async (id: number, userMeasurements: UserMeasurementsInsertType): Promise<number> => {
    const existingUserMeasurements = await getUserMeasurements(id);

    const updatedUserMeasurements = {
        createdAt: userMeasurements.createdAt || existingUserMeasurements?.createdAt || getCurrentTimestamp(),
        dataId: userMeasurements.dataId || existingUserMeasurements?.dataId || generateHash(),
        date: userMeasurements.date || existingUserMeasurements?.date || getCurrentTimestamp(),
        deletedAt: userMeasurements.deletedAt || existingUserMeasurements?.deletedAt || '',
        measurements: JSON.stringify(userMeasurements.measurements || existingUserMeasurements?.measurements || {}),
        source: userMeasurements.source || existingUserMeasurements?.source || USER_METRICS_SOURCES.USER_INPUT,
        userId: userMeasurements.userId || existingUserMeasurements?.userId || 0,
    } as { measurements: string } & Omit<UserMeasurementsInsertType, 'measurements'>;

    return database.userMeasurements.update(id, updatedUserMeasurements);
};

export const updateExercise = async (id: number, exercise: ExerciseInsertType): Promise<number> => {
    const existingExercise = await getExerciseById(id);

    const updatedExercise = {
        description: exercise.description || existingExercise?.description || '',
        image: exercise.image || existingExercise?.image || '',
        muscleGroup: exercise.muscleGroup || existingExercise?.muscleGroup || '',
        name: exercise.name || existingExercise?.name || '',
        type: exercise.type || existingExercise?.type || ''
    };

    return database.exercises.update(id, updatedExercise);
};

export const updateSet = async (id: number, set: SetInsertType): Promise<number> => {
    const existingSet = await getSetById(id);

    const updatedSet = {
        difficultyLevel: set.difficultyLevel || existingSet?.difficultyLevel || 5,
        exerciseId: set.exerciseId || existingSet?.exerciseId || 0,
        isDropSet: Boolean(set.isDropSet || existingSet?.isDropSet),
        reps: set.reps || existingSet?.reps || 0,
        restTime: set.restTime || existingSet?.restTime || 0,
        weight: set.weight || existingSet?.weight || 0
    } as SetInsertType;

    return database.sets.update(id, updatedSet);
};

export const updateSetting = async (id: number, value: string): Promise<number> => {
    return database.settings.update(id, { value });
};

export const updateOneRepMax = async (id: number, weight: number): Promise<number> => {
    return database.oneRepMaxes.update(id, { weight });
};

const updateUser = async (id: number, user: UserInsertType): Promise<number> => {
    const existingUser = await getUser(id);

    const updatedUser = {
        activityLevel: (user.activityLevel || existingUser?.activityLevel || '') as ActivityLevelType,
        birthday: user.birthday || existingUser?.birthday || '',
        fitnessGoals: user.fitnessGoals || existingUser?.fitnessGoals || '',
        gender: user.gender || existingUser?.gender || '',
        liftingExperience: (user.liftingExperience || existingUser?.liftingExperience || '') as ExperienceLevelType,
        name: user.name || existingUser?.name || ''
    };

    return database.users.update(id, updatedUser);
};

export const updateUserMetrics = async (id: number, userMetrics: UserMetricsInsertType): Promise<number> => {
    const existingUserMetrics = await getUserMetrics(id);

    const updatedUserMetrics = {
        dataId: userMetrics.dataId || existingUserMetrics?.dataId || '',
        date: userMetrics.date || existingUserMetrics?.date || '',
        eatingPhase: userMetrics.eatingPhase || existingUserMetrics?.eatingPhase || '',
        fatPercentage: (userMetrics.fatPercentage?.toString() || existingUserMetrics?.fatPercentage?.toString() || '0'),
        height: (userMetrics.height?.toString() || existingUserMetrics?.height?.toString() || '0'),
        source: userMetrics.source || existingUserMetrics?.source || USER_METRICS_SOURCES.USER_INPUT,
        userId: userMetrics.userId || existingUserMetrics?.userId || 0,
        weight: (userMetrics.weight?.toString() || existingUserMetrics?.weight?.toString() || '0')
    } as unknown as UserMetricsInsertType;

    return database.userMetrics.update(id, updatedUserMetrics);
};

export const updateWorkout = async (id: number, workout: WorkoutInsertType): Promise<number> => {
    const existingWorkout = await getWorkoutById(id);

    const updatedWorkout = {
        description: workout.description || existingWorkout?.description || '',
        recurringOnWeek: workout.recurringOnWeek || existingWorkout?.recurringOnWeek || '' as WorkoutReturnType['recurringOnWeek'],
        title: workout.title || existingWorkout?.title || ''
    };

    return database.workouts.update(id, {
        ...updatedWorkout,
    });
};

export const updateWorkoutExercise = async (id: number, workoutExercise: WorkoutExerciseInsertType): Promise<number> => {
    const existingWorkoutExercise = await getWorkoutExercises(id);

    const updatedWorkoutExercise = {
        exerciseId: workoutExercise.exerciseId || existingWorkoutExercise?.exerciseId || 0,
        order: workoutExercise.order || existingWorkoutExercise?.order || 0,
        setIds: JSON.stringify(workoutExercise.setIds || existingWorkoutExercise?.setIds || []),
        workoutId: workoutExercise.workoutId || existingWorkoutExercise?.workoutId || 0,
    } as WorkoutExerciseInsertTypeWithStrValues;

    return database.workoutExercises.update(id, updatedWorkoutExercise);
};

export const updateWorkoutExerciseOrder = async (workoutId: number, workoutExercises: WorkoutExerciseInsertType[]): Promise<void> => {
    const updatePromises = workoutExercises.map((exercise, index) => {
        return database.workoutExercises.where({ exerciseId: exercise.exerciseId, workoutId }).modify({
            order: index,
        });
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

    const updatedUserNutrition = {
        calories: (userNutrition.calories?.toString() || existingUserNutrition?.calories?.toString() || '0'),
        carbohydrate: (userNutrition.carbohydrate?.toString() || existingUserNutrition?.carbohydrate?.toString() || '0'),
        date: userNutrition.date || existingUserNutrition?.date || '',
        fat: (userNutrition.fat?.toString() || existingUserNutrition?.fat?.toString() || '0'),
        fiber: (userNutrition.fiber?.toString() || existingUserNutrition?.fiber?.toString() || '0'),
        monounsaturatedFat: (userNutrition.monounsaturatedFat?.toString() || existingUserNutrition?.monounsaturatedFat?.toString() || '0'),
        name: (userNutrition.name || existingUserNutrition?.name || ''),
        polyunsaturatedFat: (userNutrition.polyunsaturatedFat?.toString() || existingUserNutrition?.polyunsaturatedFat?.toString() || '0'),
        protein: (userNutrition.protein?.toString() || existingUserNutrition?.protein?.toString() || '0'),
        saturatedFat: (userNutrition.saturatedFat?.toString() || existingUserNutrition?.saturatedFat?.toString() || '0'),
        source: userNutrition.source || existingUserNutrition?.source || USER_METRICS_SOURCES.USER_INPUT,
        sugar: (userNutrition.sugar?.toString() || existingUserNutrition?.sugar?.toString() || '0'),
        transFat: (userNutrition.transFat?.toString() || existingUserNutrition?.transFat?.toString() || '0'),
        type: userNutrition.type || existingUserNutrition?.type || '',
        unsaturatedFat: (userNutrition.unsaturatedFat?.toString() || existingUserNutrition?.unsaturatedFat?.toString() || '0'),
        userId: userNutrition.userId,
    } as unknown as UserNutritionInsertType;

    return database.userNutrition.update(id, updatedUserNutrition);
};

export const updateWorkoutEvent = async (id: number, workoutEvent: WorkoutEventInsertType): Promise<number> => {
    const existingWorkoutEvent = await getWorkoutEvent(id);

    if (!existingWorkoutEvent) {
        return 0;
    }

    const updatedWorkoutEvent = {
        bodyWeight: workoutEvent.bodyWeight || existingWorkoutEvent?.bodyWeight || 0,
        createdAt: workoutEvent.createdAt || existingWorkoutEvent?.createdAt || new Date().toISOString(),
        date: workoutEvent.date,
        deletedAt: workoutEvent.deletedAt || existingWorkoutEvent?.deletedAt || null,
        description: workoutEvent.description || existingWorkoutEvent?.description || '',
        duration: workoutEvent.duration || existingWorkoutEvent?.duration || 0,
        eatingPhase: workoutEvent.eatingPhase || existingWorkoutEvent?.eatingPhase || '',
        exerciseData: workoutEvent.exerciseData || existingWorkoutEvent?.exerciseData || '[]',
        exhaustionLevel: workoutEvent.exhaustionLevel || existingWorkoutEvent?.exhaustionLevel || 5,
        fatPercentage: workoutEvent.fatPercentage || existingWorkoutEvent?.fatPercentage || 0,
        recurringOnWeek: workoutEvent.recurringOnWeek || existingWorkoutEvent?.recurringOnWeek || '',
        status: workoutEvent.status || existingWorkoutEvent?.status || 'COMPLETED',
        title: workoutEvent.title || existingWorkoutEvent?.title || '',
        workoutId: workoutEvent.workoutId,
        workoutScore: workoutEvent.workoutScore || existingWorkoutEvent?.workoutScore || 5,
        workoutVolume: workoutEvent.workoutVolume || existingWorkoutEvent?.workoutVolume || ''
    } as unknown as WorkoutEventInsertType;

    return database.workoutEvents.update(id, updatedWorkoutEvent);
};

// Delete functions

export const deleteUserMeasurements = async (id: number): Promise<void> => {
    await database.userMeasurements.delete(id);
};

export const deleteSetOnly = async (id: number): Promise<void> => {
    await database.sets.delete(id);
};

export const deleteUserNutrition = async (id: number): Promise<void> => {
    await database.userNutrition.delete(id);
};

export const deleteUserMetrics = async (id: number): Promise<void> => {
    await database.userMetrics.delete(id);
};

export const deleteHealthConnectUserNutritionBetweenDates = async (startDate: string, endDate: string) => {
    await database.userNutrition
        .where('date')
        .between(startDate, endDate, true, true)
        .and((userNutrition) => userNutrition.source === USER_METRICS_SOURCES.HEALTH_CONNECT)
        .delete();
};

export const deleteHealthConnectUserMetricsBetweenDates = async (startDate: string, endDate: string) => {
    await database.userMetrics
        .where('date')
        .between(startDate, endDate, true, true)
        .and((userMetrics) => userMetrics.source === USER_METRICS_SOURCES.HEALTH_CONNECT)
        .delete();
};

export const deleteSetting = async (type: string): Promise<void> => {
    await database.settings.where({ type }).delete();
};

export const deleteSet = async (id: number): Promise<void> => {
    const workoutExercises = await database.workoutExercises
        .filter((we) => JSON.parse(we.setIds || '[]').includes(id))
        .toArray();

    for (const workoutExercise of workoutExercises) {
        workoutExercise.setIds = JSON.parse(workoutExercise.setIds || '[]').filter((setId: number) => setId !== id);
        if (workoutExercise.setIds.length === 0) {
            await database.workoutExercises.delete(workoutExercise.id!);
        } else {
            await database.workoutExercises.update(workoutExercise.id!, {
                setIds: JSON.stringify(workoutExercise.setIds || []),
            });
        }
    }

    await database.sets.delete(id);
};

export const deleteExercise = async (id: number): Promise<void> => {
    await database.exercises.delete(id);
};

export const deleteWorkoutEvent = async (id: number): Promise<void> => {
    await database.workoutEvents.delete(id);
};

export const deleteWorkout = async (id: number): Promise<void> => {
    await database.workouts.delete(id);
};

export const deleteWorkoutExercisesByExerciseId = async (exerciseId: number): Promise<void> => {
    const workoutExercises = await getWorkoutExerciseByExerciseId(exerciseId);

    if (workoutExercises) {
        for (const workoutExercise of workoutExercises) {
            // TODO: maybe have a type for saving and for getting
            for (const setId of JSON.parse(workoutExercise.setIds as unknown as string || '[]') as number[]) {
                await database.sets.delete(setId);
            }

            await database.workoutExercises.delete(workoutExercise.id!);
        }
    }
};

export const deleteWorkoutExercisesByWorkoutId = async (workoutId: number): Promise<void> => {
    await database.workoutExercises.where({ workoutId }).delete();
};

export const deleteAllUserMetricsFromHealthConnect = async (): Promise<void> => {
    await database.userMetrics.where({ source: USER_METRICS_SOURCES.HEALTH_CONNECT }).delete();
};

export const deleteAllUserNutritionFromHealthConnect = async (): Promise<void> => {
    await database.userNutrition.where({ source: USER_METRICS_SOURCES.HEALTH_CONNECT }).delete();
};

export const deleteChatById = async (id: number): Promise<void> => {
    await database.chats.delete(id);
};

// Misc functions

export const countExercises = async (): Promise<number> => {
    return database.exercises.count();
};

export const countChatMessages = async (): Promise<number> => {
    return database.chats.count();
};

export const processWorkoutPlan = async (workoutPlan: WorkoutPlan): Promise<void> => {
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
};

export const clearDatabase = async (): Promise<void> => {
    await database.transaction('rw', database.tables, async () => {
        for (const table of database.tables) {
            await table.clear();
        }
    });
};

export const getTableNames = async (): Promise<string[]> => {
    return database.tables.map((table) => table.name);
};

export const getAllDataFromTables = async (tableNames: string[]): Promise<string> => {
    const dbData: any = {};

    await database.transaction('r', tableNames, async () => {
        for (const tableName of tableNames) {
            const table = database.table(tableName);
            dbData[tableName] = await table.toArray();
        }
    });

    return JSON.stringify(dbData, null, 2);
};

const TABLE_NAMES_MAP: { [key: string]: string } = {
    Bio: 'bio',
    Chat: 'chats',
    Exercise: 'exercises',
    OneRepMax: 'oneRepMaxes',
    Set: 'sets',
    Setting: 'settings',
    User: 'users',
    UserMeasurements: 'userMeasurements',
    UserMetrics: 'userMetrics',
    UserNutrition: 'userNutrition',
    Versioning: 'versioning',
    Workout: 'workouts',
    WorkoutEvent: 'workoutEvents',
    WorkoutExercise: 'workoutExercises',
};

const getDumpTableName = (originalName: string) => {
    const reverseMap = Object.fromEntries(
        Object.entries(TABLE_NAMES_MAP).map(([key, value]) => [value, key])
    );

    return reverseMap[originalName] || originalName;
};

const getRestoreTableName = (dumpName: string) => {
    return TABLE_NAMES_MAP[dumpName] || dumpName;
};

export const dumpDatabase = async (encryptionPhrase?: string): Promise<string> => {
    try {
        const dbData: any = {};

        for (const table of database.tables) {
            const originalTableName = table.name;
            const correctTableName = getDumpTableName(originalTableName);

            let tableData: any[];
            if (correctTableName === 'Setting') {
                tableData = await database.table(originalTableName).where('type').noneOf(['OPENAI_API_KEY_TYPE', 'GEMINI_API_KEY_TYPE']).toArray();
            } else {
                tableData = await database.table(originalTableName).toArray();
            }

            dbData[correctTableName] = tableData;
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

        await database.transaction('rw', database.tables, async () => {
            for (const tableName of Object.keys(dbData)) {
                const tableData = dbData[tableName];

                const sanitizedTableName = getRestoreTableName(tableName);
                console.log(`Restoring table: ${sanitizedTableName}`);
                // Uncomment this for debugging
                // if (sanitizedTableName === 'Exercise' || sanitizedTableName === 'exercises') {
                //     continue;
                // }

                await database.table(sanitizedTableName).clear();

                for (const row of tableData) {
                    await database.table(sanitizedTableName).add(row);
                }
            }
        });

        console.log('Database restored successfully.');
    } catch (error) {
        console.error('Error restoring database:', error);
        throw error;
    }
};

// Migrations

export const addUserMeasurementsTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersion();
    if (currentVersion && currentVersion <= packageJson.version) {
        if (database.isOpen()) {
            database.close();
        }

        database.version(3).stores({
            userMeasurements: [
                '++id',
                'dataId',
                'measurements',
                'userId',
                'date',
                'source',
                'createdAt',
                'deletedAt',
            ].join(', '),
        });

        if (!database.isOpen()) {
            database.open();
        }

        await addVersioning(packageJson.version);
    }
};

export const addAlcoholMacroToUserNutritionTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersion();
    if (currentVersion && currentVersion <= packageJson.version) {
        if (database.isOpen()) {
            database.close();
        }

        database.version(5).stores({
            userNutrition: [
                '++id',
                'userId',
                'dataId',
                'name',
                'calories',
                'protein',
                'carbohydrate',
                'sugar',
                'fiber',
                'fat',
                'monounsaturatedFat',
                'polyunsaturatedFat',
                'saturatedFat',
                'transFat',
                'unsaturatedFat',
                'date',
                'type',
                'source',
                'createdAt',
                'deletedAt',
                'alcohol',
            ].join(', '),
        });

        if (!database.isOpen()) {
            database.open();
        }

        await addVersioning(packageJson.version);
    }
};

export const addAlcoholAndFiberMacroToWorkoutEventTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersion();
    if (currentVersion && currentVersion <= packageJson.version) {
        if (database.isOpen()) {
            database.close();
        }

        database.version(4).stores({
            workoutEvents: [
                '++id',
                'date',
                'duration',
                '[workoutId+date]',
                'workoutId',
                'status',
                'title',
                'bodyWeight',
                'fatPercentage',
                'eatingPhase',
                'exhaustionLevel',
                'workoutScore',
                'workoutVolume',
                'exerciseData',
                'recurringOnWeek',
                'description',
                'createdAt',
                'deletedAt',
                'protein',
                'carbohydrate',
                'fat',
                'calories',
                'fiber',
                'alcohol',
            ].join(', '),
        });

        if (!database.isOpen()) {
            database.open();
        }

        await addVersioning(packageJson.version);
    }
};

export const addMacrosToWorkoutEventTable = async (): Promise<void> => {
    const currentVersion = await getLatestVersion();
    if (currentVersion && currentVersion <= packageJson.version) {
        if (database.isOpen()) {
            database.close();
        }

        database.version(2).stores({
            workoutEvents: [
                '++id',
                'date',
                'duration',
                '[workoutId+date]',
                'workoutId',
                'status',
                'title',
                'bodyWeight',
                'fatPercentage',
                'eatingPhase',
                'exhaustionLevel',
                'workoutScore',
                'workoutVolume',
                'exerciseData',
                'recurringOnWeek',
                'description',
                'createdAt',
                'deletedAt',
                'protein',
                'carbohydrate',
                'fat',
                'calories',
            ].join(', '),
        });

        if (!database.isOpen()) {
            database.open();
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