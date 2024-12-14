import {
    GRAMS,
    KILOGRAMS,
    LANGUAGE_CHOICE_TYPE,
    METRIC_SYSTEM,
    OUNCES,
    POUNDS,
    UNIT_CHOICE_TYPE,
} from '@/constants/storage';
import i18n, { EN_US } from '@/lang/lang';
import { aggregateNutritionData } from '@/utils/data';
import {
    getAllExercises,
    getExerciseById,
    getRecentWorkoutById,
    getRecentWorkouts,
    getRecentWorkoutsBetweenDates,
    getRecentWorkoutsByWorkoutId,
    getSetting,
    getUser,
    getUserMetricsBetweenDates,
    getUserNutritionBetweenDates,
    getWorkoutWithExercisesRepsAndSetsDetails,
} from '@/utils/database';
import { formatDate, getCurrentTimestampISOString } from '@/utils/date';
import { safeToFixed } from '@/utils/string';
import { UserWithMetricsType, WorkoutEventReturnType, WorkoutReturnType } from '@/utils/types';
import { getUnit } from '@/utils/unit';
import { FunctionDeclaration } from '@google/generative-ai';
import OpenAI from 'openai';

export const WORDS_SOFT_LIMIT = 100;
export const BE_CONCISE_PROMPT = `Be concise and limit your message to ${WORDS_SOFT_LIMIT} words.`;

const getMainSystemPrompt = async () => {
    const language = await getSetting(LANGUAGE_CHOICE_TYPE);

    return [
        'You are a friendly and knowledgeable personal trainer named "Chad", with a PhD in exercises and nutrition. Your goal is to help users with their workouts, provide advice, and support their fitness journey.',
        `Your responses should be in a friendly and professional tone, using the "${(language?.value || EN_US)}" language, even if the rest of the conversation was in a different language.`,
        "Feel free to use colloquial language and emojis to make the conversation more engaging and fun, but don't overdo it.",
        'Try to act as least as possible as a robot/LLM, and more like a human personal trainer.',
        'If the user asks you for something unrelated to nutrition, health and fitness, politely explain you cannot help them with that.',
        'You have access to the user data, like their fitness goals, activity level, and workout history, to provide personalized advice and insights',
    ].join('\n');
};

export const getSendChatMessageFunctions = (): (FunctionDeclaration[] | OpenAI.Chat.ChatCompletionCreateParams.Function[]) => {
    return [{
        description: "A response to a user's message.",
        name: 'generateMessage',
        parameters: {
            properties: {
                // messageToBio: {
                //     description: "A message to be saved in the user's bio.",
                //     type: 'string',
                // },
                messageToUser: {
                    description: [
                        'A message to be displayed to the user.',
                        BE_CONCISE_PROMPT,
                    ].join('\n'),
                    type: 'string',
                },
                // shouldGenerateWorkout: {
                //     description: [
                //         'Whether to generate a workout plan for the user or not. Try to infer this from the conversation.',
                //         'If true, you must let the user know that a workout is being generated for them in the "messageToUser" field.',
                //     ].join('\n'),
                //     type: 'boolean',
                // },
            },
            required: ['messageToUser'],
            type: 'object',
        },
    }];
};

export const getUserDetailsPrompt = (user: undefined | UserWithMetricsType, weightUnit = KILOGRAMS) => {
    return `The user ${user?.metrics.eatingPhase ? `is currently ${user.metrics.eatingPhase}` : 'is using this workout logger app'}`
        + `${user?.birthday ? ` and their age is ${Math.floor((new Date().getTime() - new Date(user.birthday).getTime()) / 3.15576e+10)}` : ''}`
        + `${user?.gender ? ` and their gender is ${user.gender}` : ''}.`
        + `${user?.fitnessGoals ? ` and their fitness goal is "${user.fitnessGoals}"` : ''}`
        + `${user?.activityLevel ? ` and their activity level is "${i18n.t(user.activityLevel)}"` : ''}`
        + `${user?.liftingExperience ? ` and their lifting experience is "${i18n.t(user.liftingExperience)}"` : ''}`
        + `${user?.metrics.weight ? ` and their weight is ${safeToFixed(user.metrics.weight)}${weightUnit}` : ''}.`
        + `${user?.metrics.fatPercentage ? ` and their estimated fat percentage is ${safeToFixed(user.metrics.fatPercentage)}%` : ''}.`;
};

const workoutEventsToCsvTable = async (workouts: WorkoutEventReturnType[]) => {
    if (!Array.isArray(workouts) || workouts.length === 0) {
        return '';
    }

    const { weightUnit } = await getUnit();

    const excludedFields = ['id', 'status', 'workoutId', 'title'];

    const headers = Object.keys(workouts[0]).filter((key) => !excludedFields.includes(key));

    const csvRows = [];

    csvRows.push(headers.join(','));

    for (const item of workouts) {
        const exerciseData = JSON.parse(item.exerciseData || '[]');

        const row = [];
        for (const header of headers) {
            let value = item[header as keyof WorkoutEventReturnType] !== undefined ? item[header as keyof WorkoutEventReturnType] : '';
            if (header === 'exerciseData') {
                for (const exerciseWithSets of exerciseData) {
                    const exercise = await getExerciseById(exerciseWithSets.exerciseId);
                    const sets = [];
                    for (const set of exerciseWithSets.sets) {
                        sets.push(`${set.reps}x${set.weight}${weightUnit}${set.isDropSet ? ' (drop set)' : ''}`);
                    }

                    // TODO: use translation here
                    value = `${exercise?.name || 'Unknown exercise'}: ${sets.join(', ')}`;
                }
            }

            row.push(Array.isArray(value) ? value.join(';') : value);
        }

        csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
};

export const getRecentWorkoutInsightsPrompt = async (workoutEventId: number): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> => {
    const { weightUnit } = await getUnit();
    const user = await getUser();
    const recentWorkout = await getRecentWorkoutById(workoutEventId);
    // const workoutsTable = await workoutEventsToCsvTable(recentWorkout ? [recentWorkout] : []);
    const workoutsTable = await formatRecentWorkouts(recentWorkout ? [recentWorkout] : []);

    return [
        {
            content: [
                await getMainSystemPrompt(),
                'Please provide insights about the user recent workout, like if they are doing enough volume, if they are using the correct weights, etc. Base your analysis on their goal, eating phase, and activity level.',
                BE_CONCISE_PROMPT,
                getUserDetailsPrompt(user, weightUnit),
            ].join('\n'),
            role: 'system',
        },
        {
            content: [
                'Please provide insights about my recent workouts:',
                '```json',
                JSON.stringify(workoutsTable[0] || '{}'),
                '```',
            ].join('\n'),
            role: 'user',
        },
    ];
};

export const getWorkoutInsightsPrompt = async (workoutId: number): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> => {
    const { weightUnit } = await getUnit();
    const user = await getUser();
    const workoutWithDetails = await getWorkoutWithExercisesRepsAndSetsDetails(workoutId);

    return [
        {
            content: [
                await getMainSystemPrompt(),
                'Please provide insights about the user workout, like if they are doing enough volume, if they are using the correct weights, etc. Base your analysis on their goal, eating phase, and activity level.',
                BE_CONCISE_PROMPT,
                getUserDetailsPrompt(user, weightUnit),
            ].join('\n'),
            role: 'system',
        },
        {
            content: [
                `Please provide insights about my upcoming "${workoutWithDetails?.title}" workout:`,
                '```json\n' + JSON.stringify(workoutWithDetails) + '\n```',
            ].join('\n'),
            role: 'user',
        },
    ];
};

export const getWorkoutVolumeInsightsPrompt = async (workoutId: number): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> => {
    const { weightUnit } = await getUnit();
    const user = await getUser();
    const recentWorkouts = await getRecentWorkoutsByWorkoutId(workoutId);
    const sortedWorkouts = recentWorkouts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return [
        {
            content: [
                await getMainSystemPrompt(),
                'Please provide insights about the user workout, like if they are doing enough volume, if they are using the correct weights, etc. Base your analysis on their goal, eating phase, and activity level.',
                BE_CONCISE_PROMPT,
                getUserDetailsPrompt(user, weightUnit),
            ].join('\n'),
            role: 'system',
        },
        {
            content: [
                'Please provide insights about my past workouts:',
                '```json\n' + JSON.stringify(await formatRecentWorkouts(sortedWorkouts)) + '\n```',
            ].join('\n'),
            role: 'user',
        },
    ];
};

const generateWorkoutSentences = async (workouts: WorkoutEventReturnType[]) => {
    if (workouts.length === 0) {
        return 'No workout data available.';
    }

    const { title } = workouts[0];
    const sentences = [];
    const { weightUnit } = await getUnit();

    for (const workout of workouts) {
        const exerciseData = JSON.parse(workout.exerciseData || '[]');
        let exercises = '';
        for (const exerciseWithSets of exerciseData) {
            const exercise = await getExerciseById(exerciseWithSets.exerciseId);
            const sets = [];
            for (const set of exerciseWithSets.sets) {
                sets.push(`${set.reps}x${set.weight}${weightUnit}${set.isDropSet ? ' (drop set)' : ''}`);
            }

            // TODO add translation here
            exercises += `\n${exercise?.name || 'Unknown exercise'}: ${sets.join(', ')}`;
        }

        const sentence = `on ${new Date(workout.date).toLocaleDateString()} it lasted ${workout.duration} minutes`
            + ', with the following exercises: '
            + exercises
            + `${workout.bodyWeight ? `, their body weight was ${workout.bodyWeight}${weightUnit}` : ''}`
            + `${workout.fatPercentage ? `, their fat percentage was ${workout.fatPercentage}%` : ''}`
            + `${workout.eatingPhase ? `, and they were in the ${workout.eatingPhase} phase` : ''}`.replace(/,\s*$/, '');

        sentences.push(sentence);
    }

    const begin = `The workout "${title}" was previously completed as follows: `;
    if (sentences.length > 1) {
        const lastSentence = sentences.pop();
        return begin + sentences.join(', ') + ', and ' + lastSentence + '.';
    } else {
        return begin + sentences[0] + '.';
    }
};

export const createWorkoutPlanPrompt = async (messages: any[]): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> => {
    const existingExercises = await getAllExercises();
    const user = await getUser();
    const { weightUnit } = await getUnit();

    return [
        {
            content: [
                await getMainSystemPrompt(),
                "Generate a workout plan with exercises, reps, sets, and percentages of 1 rep max based on the user's fitness goals, activity level, weight, height and available equipment.",
                "If you can't infer what workout the user wants you to generate from the messages, simply generate a basic weekly workout plan, like a 3-day split.",
                `${existingExercises.length > 0 ? `Please only use the exercises from the following list: ${existingExercises.map((e) => e.name).join(', ')}` : ''}`,
                getUserDetailsPrompt(user, weightUnit),
            ].join('\n'),
            role: 'system',
        },
        ...messages,
    ];
};

export const getCreateWorkoutPlanFunctions = (): (FunctionDeclaration[] | OpenAI.Chat.ChatCompletionCreateParams.Function[]) => {
    return [{
        description: 'Generates a workout plan with exercises, reps, sets, and percentages of 1 rep max',
        name: 'generateWorkoutPlan',
        parameters: {
            properties: {
                description: {
                    description: 'The description of the workout plan, to be sent to the user',
                    type: 'string',
                },
                workoutPlan: {
                    description: 'The workout plan with exercises, reps, sets, and percentages of 1 rep max',
                    items: {
                        properties: {
                            description: {
                                description: 'The description of the workout',
                                type: 'string',
                            },
                            exercises: {
                                description: 'The exercises in the workout',
                                items: {
                                    properties: {
                                        name: {
                                            description: 'The name of the exercise',
                                            type: 'string',
                                        },
                                        oneRepMaxPercentage: {
                                            description: 'The percentage of the 1 rep max to use for the exercise',
                                            type: 'number',
                                        },
                                        reps: {
                                            description: 'The number of reps to perform',
                                            type: 'number',
                                        },
                                        sets: {
                                            description: 'The number of sets to perform',
                                            type: 'number',
                                        },
                                    },
                                    required: ['name', 'reps', 'sets', 'oneRepMaxPercentage'],
                                    type: 'object',
                                },
                                type: 'array',
                            },
                            recurringOnWeekDay: {
                                description: 'The day of the week the workout should recur on, e.g. "monday" or "friday"',
                                type: 'string',
                            },
                            title: {
                                description: 'The title of the workout',
                                type: 'string',
                            },
                        },
                        required: ['title', 'exercises', 'recurringOnWeekDay'],
                        type: 'object',
                    },
                    type: 'array',
                },
            },
            required: ['workoutPlan', 'description'],
            type: 'object',
        },
    }];
};

export const getRecentWorkoutsInsightsPrompt = async (startDate: string, endDate: string): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> => {
    const { weightUnit } = await getUnit();
    const user = await getUser();
    const recentWorkouts = await getRecentWorkoutsBetweenDates(startDate, endDate);

    const diffInDays = Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));

    return [
        {
            content: [
                await getMainSystemPrompt(),
                `Please provide insights about the user workouts in these ${diffInDays} days range, like if they are doing enough volume, if they are using the correct weights, etc. Base your analysis on their goal, eating phase, and activity level.`,
                BE_CONCISE_PROMPT,
                getUserDetailsPrompt(user, weightUnit),
            ].join('\n'),
            role: 'system',
        },
        {
            content: [
                `Please provide insights about my recent workouts in these ${diffInDays} days range:`,
                '```json\n' + JSON.stringify(await formatRecentWorkouts(recentWorkouts)) + '\n```',
            ].join('\n'),
            role: 'user',
        },
    ];
};

export const getNutritionInsightsPrompt = async (startDate: string, endDate: string): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> => {
    const { unitSystem, weightUnit } = await getUnit();
    const foodWeightUnit = unitSystem === METRIC_SYSTEM ? GRAMS : OUNCES;
    const user = await getUser();
    const userMetrics = await getUserMetricsBetweenDates(startDate, endDate);
    const userNutrition = await getUserNutritionBetweenDates(startDate, endDate);

    const diffInDays = Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));

    const fatAndWeight = userMetrics.map((userMetric) => ({
        date: formatDate(userMetric.createdAt!, 'MMM d, yy'),
        fatPercentage: userMetric.fatPercentage,
        weight: userMetric.weight,
    }));

    const nutrition = Object.entries(aggregateNutritionData(userNutrition, 'MMM d, yy'))
        .map(([date, data]) => ({
            calories: `${Math.round(data.calories)}kcal`,
            carbohydrate: `${Math.round(data.carbohydrate)}${foodWeightUnit}`,
            date,
            fat: `${Math.round(data.fat)}${foodWeightUnit}`,
            protein: `${Math.round(data.protein)}${foodWeightUnit}`,
        }));

    return [
        {
            content: [
                await getMainSystemPrompt(),
                `Please provide insights about the user's nutrition in these ${diffInDays} days range, like if they are eating enough protein, if they are consuming too many calories, etc. Base your analysis on their goal, eating phase, and activity level.`,
                BE_CONCISE_PROMPT,
                getUserDetailsPrompt(user, weightUnit),
            ].join('\n'),
            role: 'system',
        },
        {
            content: [
                `Please provide insights about my nutrition these ${diffInDays} days range:`,
                fatAndWeight.length > 0 ? 'This is my historical data about my fat percentage and weight:\n```json\n' + JSON.stringify(fatAndWeight) + '\n```' : '',
                nutrition.length > 0 ? 'And this is my historical data about my nutrition:```json\n' + JSON.stringify(nutrition) + '\n```' : '',
            ].join('\n'),
            role: 'user',
        },
    ];
};

type PromptWorkoutEventReturnType = Omit<WorkoutEventReturnType, 'date' | 'duration' | 'exerciseData' | 'exhaustionLevel' | 'id' | 'status' | 'title' | 'workoutId' | 'workoutScore'> & {
    duration: string;
    exerciseData: SimpleExerciseVolumeData[];
    exhaustionLevel: string;
    workoutScore: string;
};

type SimpleExerciseVolumeData = {
    exercise: string;
    sets: {
        difficultyLevel: string,
        reps: number,
        restTime: string,
        weight: string,
    }[];
};

const formatRecentWorkouts = async (recentWorkouts: WorkoutEventReturnType[]) => {
    const { weightUnit } = await getUnit();

    const result: PromptWorkoutEventReturnType[] = [];

    for (const recentWorkout of recentWorkouts) {
        const filteredRecentWorkout = Object.fromEntries(
            Object.entries(recentWorkout).filter(
                ([key]) => ![
                    'alcohol',
                    'bodyWeight',
                    'calories',
                    'carbohydrate',
                    'createdAt',
                    'deletedAt',
                    'description',
                    'fat',
                    'fatPercentage',
                    'fiber',
                    'id',
                    'protein',
                    'recurringOnWeek',
                    'status',
                    'workoutId',
                    'workoutVolume',
                ].includes(key)
            )
        ) as WorkoutEventReturnType;

        const formattedWorkout = {
            ...filteredRecentWorkout,
            ...(recentWorkout.fatPercentage && {
                fatPercentage: `${safeToFixed(recentWorkout.fatPercentage)}%`,
            }),
            ...(recentWorkout.bodyWeight && {
                bodyWeight: `${safeToFixed(recentWorkout.bodyWeight)}${weightUnit}`,
            }),
            ...(recentWorkout.workoutVolume && {
                workoutVolume: recentWorkout.workoutVolume,
            }),
            ...(recentWorkout.eatingPhase && {
                eatingPhase: recentWorkout.eatingPhase,
            }),
            date: recentWorkout.date.split('T')[0],
            duration: `${recentWorkout.duration} ${i18n.t('minutes')}`,
            exerciseData: [],
            exhaustionLevel: `${recentWorkout.exhaustionLevel}/10`,
            workoutScore: `${recentWorkout.workoutScore}/10`,
        } as PromptWorkoutEventReturnType;

        const parsedExerciseData = JSON.parse(filteredRecentWorkout.exerciseData || '[]');
        for (const ed of parsedExerciseData) {
            const exercise = await getExerciseById(ed.exerciseId);
            const formattedExerciseData = {
                exercise: exercise?.name || i18n.t('unknown'),
                sets: [],
            } as SimpleExerciseVolumeData;

            for (const set of ed.sets) {
                const formattedSet = {
                    difficultyLevel: `${set.difficultyLevel}/10`,
                    reps: set.reps,
                    restTime: `${set.restTime} ${i18n.t('seconds')}`,
                    weight: `${set.weight}${weightUnit}`,
                };

                formattedExerciseData.sets.push(formattedSet);
            }

            formattedWorkout.exerciseData.push(formattedExerciseData);
        }

        result.push(formattedWorkout);
    }

    return result;
};

export const getCalculateNextWorkoutVolumePrompt = async (workout: WorkoutReturnType, calculateNextVolume = true): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> => {
    const { weightUnit } = await getUnit();
    const user = await getUser();
    // const workoutWithDetails = await getWorkoutWithExercisesRepsAndSetsDetails(workout.id!);
    const recentWorkouts = await getRecentWorkoutsByWorkoutId(workout.id!);
    // const workoutsTable = await workoutEventsToCsvTable(recentWorkouts);

    const getCalculateNextWorkoutVolumePrompt = () => {
        if (calculateNextVolume) {
            return [
                '# Volume Calculation',
                "- Please, calculate the volume for the next workout, this doesn't necessarily mean that reps and/or weights must be increased. Base it on past workouts to see if the volume should be increased or not.",
                '- The `workoutVolume` is calculated using an average of Epley, Brzycki, Lander, Lombardi, Mayhew, OConner, and Wathan formulas.',
                '\nAlso explain how and why the volume was calculated for the next workout.',
            ];
        }

        return [];
    };

    return [
        {
            content: [
                await getMainSystemPrompt(),
                `The user just completed a "${workout.title}" workout, and your task is to give the user feedback${calculateNextVolume ? ' and calculate the volume for the next workout' : ''}.`,
                '# Feedback',
                '- Please congratulate the user on their most recent workout and give feedback about it, for example if they did less volume than last week of if they took too long to complete the workout, etc.',
                '- Please also check the individual data for each set of each exercise, like the `difficultyLevel` (from one to ten) of the exercise, the `restTime` between sets, etc.',
                '- There is also data about how the user is feeling after the whole workout, if they are too exhausted (`exhaustionLevel` - from one to ten), if they liked the workout (`workoutScore` - from one to ten), etc.',
                '- The `duration` of the workout is also available, and its value is in minutes.',
                ...getCalculateNextWorkoutVolumePrompt(),
                '- Some user details:',
                getUserDetailsPrompt(user, weightUnit),
                // TODO: maybe this can be improved
                '\n- The following is the data for the times this workout was completed by the user:\n',
                // '```csv',
                // JSON.stringify(workoutsTable),
                // '```',
                '```json',
                JSON.stringify(await formatRecentWorkouts(recentWorkouts)),
                '```',
                '\nAlso explain how the volume was calculated for the next workout.',
                // 'If the user is bulking, increase the volume by at least 10%', // TODO: this is for debugging only
            ].join('\n'),
            role: 'system',
        },
        {
            content: calculateNextVolume ? `Calculate the volume for the next "${workout.title}" workout` : `Provide feedback for the "${workout.title}" workout`,
            role: 'user',
        },
    ];
};

export const getCalculateNextWorkoutVolumeFunctions = (): (FunctionDeclaration[] | OpenAI.Chat.ChatCompletionCreateParams.Function[]) => {
    return [{
        description: 'Calculates the next workout volume based on the previous workout data',
        name: 'calculateNextWorkoutVolume',
        parameters: {
            properties: {
                messageToUser: {
                    description: [
                        'A message to be displayed to the user explaining what was taken into account for the next workout volume calculation.',
                        BE_CONCISE_PROMPT,
                    ].join('\n'),
                    type: 'string',
                },
                workoutVolume: {
                    items: {
                        properties: {
                            exercises: {
                                items: {
                                    properties: {
                                        exerciseId: { type: 'number' },
                                        sets: {
                                            items: {
                                                properties: {
                                                    reps: { type: 'number' },
                                                    setId: { type: 'number' },
                                                    weight: { type: 'number' },
                                                },
                                                required: ['setId', 'reps', 'weight'],
                                                type: 'object',
                                            },
                                            type: 'array',
                                        },
                                    },
                                    required: ['exerciseId', 'sets'],
                                    type: 'object',
                                },
                                type: 'array',
                            },
                            workoutId: { type: 'number' },
                        },
                        required: ['exercises', 'workoutId'],
                        type: 'object',
                    },
                    type: 'array',
                },
            },
            required: ['workoutVolume', 'messageToUser'],
            type: 'object',
        },
    }];
};

export const getParsePastWorkoutsPrompt = async (userMessage: string): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> => {
    const unitSystem = await getSetting(UNIT_CHOICE_TYPE);

    const weightUnit = (unitSystem?.value || METRIC_SYSTEM) === METRIC_SYSTEM ? KILOGRAMS : POUNDS;

    const existingExercises = await getAllExercises();

    return [
        {
            content: [
                await getMainSystemPrompt(),
                'Parse the past workouts from the text input and return it in a JSON format.',
                'The text input will contain the past workouts in a human-readable format, like a list of exercises with sets and reps.',
                'Try to figure out the correct name for each of the workouts, for example if there is a day with only chest exercises, you can name it "Chest Day", etc.',
                'It is also possible that the user will provide the same workout, but with different weights or reps, probably from a different workout session, in that case you should can name it the same as the previous one, but with a different date.',
                'If the text input is too long, please only parse the first 20 workouts.',
                `The weight unit used in the text input and for the JSON output is ${weightUnit}.`,
                `${existingExercises.length > 0 ? `Please try to match the exercises from the past workouts to the exercises in the following list: ${existingExercises.map((e) => e.name).join(', ')}` : ''}`,
            ].join('\n'),
            role: 'system',
        },
        {
            content: userMessage,
            role: 'user',
        },
    ];
};

export const getParsePastWorkoutsFunctions = (): (FunctionDeclaration[] | OpenAI.Chat.ChatCompletionCreateParams.Function[]) => {
    return [{
        description: 'Parses the past workouts from the text input and returns it in a JSON format.',
        name: 'parsePastWorkouts',
        parameters: {
            properties: {
                pastWorkouts: {
                    description: 'The list of parsed past workouts',
                    items: {
                        properties: {
                            date: {
                                description: 'The date the workout was performed in the format YYYY-MM-DD',
                                type: 'string',
                            },
                            description: {
                                description: 'The description of the workout',
                                type: 'string',
                            },
                            duration: {
                                description: 'The duration of the workout in minutes',
                                type: 'string',
                            },
                            exercises: {
                                description: 'The exercises in the workout',
                                items: {
                                    properties: {
                                        muscleGroup: {
                                            description: 'The muscle group targeted by the exercise',
                                            type: 'string',
                                        },
                                        name: {
                                            description: 'The name of the exercise',
                                            type: 'string',
                                        },
                                        sets: {
                                            description: 'The number of sets performed',
                                            items: {
                                                properties: {
                                                    reps: {
                                                        description: 'The number of reps performed',
                                                        type: 'number',
                                                    },
                                                    weight: {
                                                        description: 'The weight used',
                                                        type: 'number',
                                                    },
                                                },
                                                required: ['reps', 'weight'],
                                                type: 'object',
                                            },
                                            type: 'array',
                                        },
                                        type: {
                                            description: 'Type of the exercise, like "Compound", "Machine" or "Isolation"',
                                            type: 'string',
                                        },
                                    },
                                    required: ['name', 'reps', 'sets', 'type', 'muscleGroup'],
                                    type: 'object',
                                },
                                type: 'array',
                            },
                            title: {
                                description: 'The title of the workout, like "Chest Day" or "Leg Day"',
                                type: 'string',
                            },
                        },
                        required: ['title', 'exercises', 'date', 'duration'],
                        type: 'object',
                    },
                    type: 'array',
                },
            },
            required: ['pastWorkouts'],
            type: 'object',
        },
    }];
};

export const getMacrosEstimationFunctions = (
    description: string,
    mode: 'estimated' | 'extracted' = 'estimated'
): (FunctionDeclaration[] | OpenAI.Chat.ChatCompletionCreateParams.Function[]) => {
    return [{
        description,
        name: 'estimateMacros',
        parameters: {
            properties: {
                carbs: {
                    description: `The ${mode} carbohydrates in grams`,
                    type: 'number',
                },
                fat: {
                    description: `The ${mode} fat in grams`,
                    type: 'number',
                },
                grams: {
                    description: `The ${mode} weight in grams`,
                    type: 'number',
                },
                kcal: {
                    description: `The ${mode} kilocalories`,
                    type: 'number',
                },
                kj: {
                    description: `The ${mode} kilojoules`,
                    type: 'number',
                },
                name: {
                    description: 'The name of the food / meal',
                    type: 'string',
                },
                protein: {
                    description: `The ${mode} protein in grams`,
                    type: 'number',
                },
            },
            required: ['protein', 'fat', 'carbs', 'kcal', 'kj', 'name', 'grams'],
            type: 'object',
        },
    }];
};

export const getParsePastNutritionPrompt = async (userMessage: string): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> => {
    return [
        {
            content: [
                await getMainSystemPrompt(),
                'Parse the past nutrition data from the text input and return it in a JSON format.',
                'The text input will contain the past nutrition data in a human-readable format, like a list of foods with their nutritional values.',
                'Try to figure out the correct date for each entry, and ensure all nutritional values are in the appropriate units (e.g., grams, milligrams).',
                'If the text input is too long, please only parse the first 20 entries.',
            ].join('\n'),
            role: 'system',
        },
        {
            content: userMessage,
            role: 'user',
        },
    ];
};

export const getParsePastNutritionFunctions = (): (FunctionDeclaration[] | OpenAI.Chat.ChatCompletionCreateParams.Function[]) => {
    return [{
        description: 'Parses the past nutrition data from the text input and returns it in a JSON format.',
        name: 'parsePastNutrition',
        parameters: {
            properties: {
                pastNutrition: {
                    description: 'The list of parsed past nutrition data',
                    items: {
                        properties: {
                            calories: {
                                description: 'The total calories consumed',
                                type: 'number',
                            },
                            carbs: {
                                description: 'The total carbohydrates consumed in grams',
                                type: 'number',
                            },
                            cholesterol: {
                                description: 'The total cholesterol consumed in milligrams',
                                type: 'number',
                            },
                            date: {
                                description: 'The date the nutrition data was recorded in the format YYYY-MM-DD',
                                type: 'string',
                            },
                            fat: {
                                description: 'The total fat consumed in grams',
                                type: 'number',
                            },
                            fat_saturated: {
                                description: 'The total saturated fat consumed in grams',
                                type: 'number',
                            },
                            fat_unsaturated: {
                                description: 'The total unsaturated fat consumed in grams',
                                type: 'number',
                            },
                            fiber: {
                                description: 'The total fiber consumed in grams',
                                type: 'number',
                            },
                            potassium: {
                                description: 'The total potassium consumed in milligrams',
                                type: 'number',
                            },
                            protein: {
                                description: 'The total protein consumed in grams',
                                type: 'number',
                            },
                            sodium: {
                                description: 'The total sodium consumed in milligrams',
                                type: 'number',
                            },
                            sugar: {
                                description: 'The total sugar consumed in grams',
                                type: 'number',
                            },
                        },
                        required: ['date', 'calories', 'carbs', 'cholesterol', 'fat', 'fat_saturated', 'fat_unsaturated', 'fiber', 'potassium', 'protein', 'sodium', 'sugar'],
                        type: 'object',
                    },
                    type: 'array',
                },
            },
            required: ['pastNutrition'],
            type: 'object',
        },
    }];
};

export const getChatMessagePromptContent = async (): Promise<string> => {
    // const bioData = await getAllBio();
    const recentWorkoutsData = await getRecentWorkouts();
    const user = await getUser();
    const currentDate = getCurrentTimestampISOString().split('T')[0];
    const { weightUnit } = await getUnit();

    const recentWorkoutDetails = await formatRecentWorkouts(recentWorkoutsData.slice(-4));

    return [
        await getMainSystemPrompt(),
        `The current date is ${currentDate}.`,
        `The current time is ${new Date().toLocaleTimeString()}.`,
        // '\n#Tools: BIO, WORKOUTS',
        // '\n#Tools: WORKOUTS',
        // '- The `BIO` tool allows you to persist information across conversations. Use the `messageToBio` and write information you want to remember, for example if the user likes to run, play videogames, etc. The information will appear in the model set context below in future conversations but never sent to the user.',
        // 'DO NOT use the `BIO` tool to save if the user asked for a workout to be generated or not. Use the `WORKOUTS` tool for that.',
        // '- The `WORKOUTS` tool allows you to let our systems know if we should generate a workout for the user. Use the `shouldGenerateWorkout` property set as `true` or `false`. This information will never be sent to the user',
        // "Use the whole history of the conversation and try to infer if a new workout should be generated or not, but pay attention, because if you've just recently generated a workout plan, you SHOULD NOT generate another one right away.",
        '\nSome details about the user:',
        getUserDetailsPrompt(user),
        `${recentWorkoutsData?.length > 0 ? [
            'The following JSON data is are the recent workouts the user did:\n',
            '```json',
            JSON.stringify(recentWorkoutDetails),
            '```',
            `All weights are in "${weightUnit}"`,
        ].join('\n') : ''}`,
        // `${bioData?.length > 0 ? `Here is some information about the user that you saved using the BIO tool:\n ${bioData.map((bio) => `${formatDate(bio.createdAt!, 'yyyy-MM-dd')}: "${bio.value}"`).join('\n')}` : ''}`,
        "The following content is a conversation between the user and you, the AI model. Based on the conversation history, you should provide a response to the user's last message, keeping in mind the context of the conversation.",
    ].join('\n');
};
