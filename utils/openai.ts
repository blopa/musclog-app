import { OPENAI_MODELS } from '@/constants/ai';
import {
    EXERCISE_IMAGE_GENERATION_TYPE,
    OPENAI_API_KEY_TYPE,
    OPENAI_MODEL_TYPE,
} from '@/constants/storage';
import i18n from '@/lang/lang';
import { getSetting, processWorkoutPlan } from '@/utils/database';
import { getBase64StringFromPhotoUri, resizeImage } from '@/utils/file';
import { WorkoutPlan, WorkoutReturnType } from '@/utils/types';
import OpenAI from 'openai';

import {
    createWorkoutPlanPrompt,
    getCalculateNextWorkoutVolumeFunctions,
    getCalculateNextWorkoutVolumePrompt,
    getCreateWorkoutPlanFunctions,
    getMacrosEstimationFunctions,
    getNutritionInsightsPrompt,
    getParsePastNutritionFunctions,
    getParsePastNutritionPrompt,
    getParsePastWorkoutsFunctions,
    getParsePastWorkoutsPrompt,
    getRecentWorkoutInsightsPrompt,
    getRecentWorkoutsInsightsPrompt,
    getSendChatMessageFunctions,
    getWorkoutInsightsPrompt,
    getWorkoutVolumeInsightsPrompt,
} from './prompts';

const getModel = async () => {
    const defaultModel = OPENAI_MODELS.GPT_4O_MINI.model;
    const savedModel = await getSetting(OPENAI_MODEL_TYPE);

    if (!savedModel) {
        return defaultModel;
    }

    const model = Object.values(OPENAI_MODELS)
        .find((m) => m.value === Number(savedModel.value));

    return model?.model || defaultModel;
};

export const getApiKey = async () =>
    (await getSetting(OPENAI_API_KEY_TYPE))?.value || process.env.EXPO_PUBLIC_FORCE_OPENAI_API_KEY;

export async function generateWorkoutPlan(messages: any[]): Promise<boolean> {
    const workoutPlanResponse = await createWorkoutPlan(messages);

    try {
        if (workoutPlanResponse?.workoutPlan) {
            await processWorkoutPlan(workoutPlanResponse as WorkoutPlan);
        }

        return true;
    } catch (error) {
        console.error('Failed to process workout plan:', error);
    }

    return false;
}

export async function getNutritionInsights(startDate: string, endDate: string) {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return Promise.resolve();
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
    });

    const result = await openai.chat.completions.create({
        messages: await getNutritionInsightsPrompt(startDate, endDate),
        model: await getModel(),
    });

    return result?.choices?.[0].message.content;
}

export async function getRecentWorkoutsInsights(startDate: string, endDate: string): Promise<string | undefined> {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return;
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
    });

    const result = await openai.chat.completions.create({
        messages: await getRecentWorkoutsInsightsPrompt(startDate, endDate),
        model: await getModel(),
    });

    return result?.choices?.[0].message.content || undefined;
}

export async function sendChatMessage(messages: any[]) {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return;
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
    });

    const result = await openai.chat.completions.create({
        function_call: { name: 'generateMessage' },
        functions: getSendChatMessageFunctions() as OpenAI.Chat.ChatCompletionCreateParams.Function[],
        messages,
        model: await getModel(),
    });

    let jsonResponse = {
        messageToBio: '',
        messageToUser: i18n.t('great'),
        // shouldGenerateWorkout: false,
    };

    try {
        // @ts-expect-error
        jsonResponse = JSON.parse(result?.choices?.[0]?.message?.function_call?.arguments);
    } catch (error) {
        console.log('Error parsing JSON response:', error);
    }

    return jsonResponse;
}

async function createWorkoutPlan(messages: any[]) {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return;
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
    });

    const messagesToSend = messages.length > 20 ? messages.slice(0, 20) : messages;
    const result = await openai.chat.completions.create({
        function_call: { name: 'generateWorkoutPlan' },
        functions: getCreateWorkoutPlanFunctions() as OpenAI.Chat.ChatCompletionCreateParams.Function[],
        messages: await createWorkoutPlanPrompt(messagesToSend),
        model: await getModel(),
    });

    let jsonResponse = {
        description: 'Workout plan generated successfully',
        workoutPlan: [],
    };

    try {
        // @ts-expect-error
        jsonResponse = JSON.parse(result?.choices?.[0]?.message?.function_call?.arguments);
    } catch (error) {
        console.log('Error parsing JSON response:', error);
    }

    return jsonResponse;
}

export const calculateNextWorkoutVolume = async (workout: WorkoutReturnType) => {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return Promise.resolve();
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
    });

    const result = await openai.chat.completions.create({
        function_call: { name: 'calculateNextWorkoutVolume' },
        functions: getCalculateNextWorkoutVolumeFunctions() as OpenAI.Chat.ChatCompletionCreateParams.Function[],
        messages: await getCalculateNextWorkoutVolumePrompt(workout),
        model: await getModel(),
    });

    let jsonResponse = {
        messageToUser: i18n.t('next_workout_calculated_successfully'),
        workoutVolume: [],
    };

    try {
        // @ts-expect-error
        jsonResponse = JSON.parse(result?.choices?.[0]?.message?.function_call?.arguments);
    } catch (error) {
        console.log('Error parsing JSON response:', error);
    }

    return jsonResponse;
};

export const generateExerciseImage = async (exerciseName: string) => {
    const isImageGenerationEnabled = (await getSetting(EXERCISE_IMAGE_GENERATION_TYPE))?.value === 'true';
    if (!isImageGenerationEnabled) {
        return 'https://via.placeholder.com/300';
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
        return 'https://via.placeholder.com/300';
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
    });

    const response = await openai.images.generate({
        model: 'dall-e-3',
        n: 1,
        prompt: `Generate a flat design image, with only grayscale colors, showing a person performing the "${exerciseName}" exercise.`,
        size: '1024x1024',
    });

    return response.data[0].url;
};

export const parsePastWorkouts = async (userMessage: string) => {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return;
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
    });

    const result = await openai.chat.completions.create({
        function_call: { name: 'parsePastWorkouts' },
        functions: getParsePastWorkoutsFunctions() as OpenAI.Chat.ChatCompletionCreateParams.Function[],
        messages: await getParsePastWorkoutsPrompt(userMessage),
        model: await getModel(),
    });

    let jsonResponse = {
        pastWorkouts: [],
    };

    try {
        // @ts-expect-error
        jsonResponse = JSON.parse(result?.choices?.[0]?.message?.function_call?.arguments);
    } catch (error) {
        console.log('Error parsing JSON response:', error);
    }

    return jsonResponse;
};

export const parsePastNutrition = async (userMessage: string) => {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return Promise.resolve();
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
    });

    const result = await openai.chat.completions.create({
        function_call: { name: 'parsePastNutrition' },
        functions: getParsePastNutritionFunctions() as OpenAI.Chat.ChatCompletionCreateParams.Function[],
        messages: await getParsePastNutritionPrompt(userMessage),
        model: await getModel(),
    });

    let jsonResponse = {
        pastNutrition: [],
    };

    try {
        // @ts-expect-error
        jsonResponse = JSON.parse(result?.choices?.[0]?.message?.function_call?.arguments);
    } catch (error) {
        console.log('Error parsing JSON response:', error);
    }

    return jsonResponse;
};

export async function estimateNutritionFromPhoto(photoUri: string) {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return Promise.resolve(null);
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
    });

    const base64Image = await getBase64StringFromPhotoUri(
        await resizeImage(photoUri)
    );

    const result = await openai.chat.completions.create({
        function_call: { name: 'estimateMacros' },
        functions: getMacrosEstimationFunctions(
            'Estimates the macronutrients of a meal from a photo',
            'estimated'
        ) as OpenAI.Chat.ChatCompletionCreateParams.Function[],
        messages: [{
            content: [
                'You are a very powerful AI, trained to estimate the macronutrients of a food/meal from the photo provided',
            ].join('\n'),
            role: 'system',
        }, {
            content: [{
                image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                },
                type: 'image_url',
            }],
            role: 'user',
        }],
        model: await getModel(),
    });

    let jsonResponse = {
        carbs: 0,
        fat: 0,
        grams: 0,
        kcal: 0,
        kj: 0,
        name: '',
        protein: 0,
    };

    try {
        // @ts-expect-error
        jsonResponse = JSON.parse(result?.choices?.[0]?.message?.function_call?.arguments);
    } catch (error) {
        console.log('Error parsing JSON response:', error);
    }

    return jsonResponse;
}

export async function extractMacrosFromLabelPhoto(photoUri: string) {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return Promise.resolve(null);
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
    });

    const base64Image = await getBase64StringFromPhotoUri(
        await resizeImage(photoUri)
    );

    const result = await openai.chat.completions.create({
        function_call: { name: 'estimateMacros' },
        functions: getMacrosEstimationFunctions(
            'Extracts the macronutrients of a food label from a photo',
            'extracted'
        ) as OpenAI.Chat.ChatCompletionCreateParams.Function[],
        messages: [{
            content: [
                'You are a very powerful AI, trained to extract the macronutrients of a food label from the photo provided',
                'Use OCR to extract the text from the image, then parse the text to extract the macronutrients.',
            ].join('\n'),
            role: 'system',
        }, {
            content: [{
                image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                },
                type: 'image_url',
            }],
            role: 'user',
        }],
        model: await getModel(),
    });

    let jsonResponse = {
        carbs: 0,
        fat: 0,
        grams: 0,
        kcal: 0,
        kj: 0,
        name: '',
        protein: 0,
    };

    try {
        // @ts-expect-error
        jsonResponse = JSON.parse(result?.choices?.[0]?.message?.function_call?.arguments);
    } catch (error) {
        console.log('Error parsing JSON response:', error);
    }

    return jsonResponse;
}

export async function getRecentWorkoutInsights(workoutEventId: number) {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return Promise.resolve();
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
    });

    const result = await openai.chat.completions.create({
        messages: await getRecentWorkoutInsightsPrompt(workoutEventId),
        model: await getModel(),
    });

    return result?.choices?.[0].message.content;
}

export async function getWorkoutInsights(workoutId: number) {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return Promise.resolve();
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
    });

    const result = await openai.chat.completions.create({
        messages: await getWorkoutInsightsPrompt(workoutId),
        model: await getModel(),
    });

    return result?.choices?.[0].message.content;
}

export async function getWorkoutVolumeInsights(workoutId: number) {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return Promise.resolve();
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
    });

    const result = await openai.chat.completions.create({
        messages: await getWorkoutVolumeInsightsPrompt(workoutId),
        model: await getModel(),
    });

    return result?.choices?.[0].message.content;
}

export async function isValidApiKey(apiKey: string) {
    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
    });

    try {
        await openai.chat.completions.create({
            max_tokens: 1,
            messages: [{
                content: 'hi',
                role: 'user',
            }],
            model: await getModel(),
        });

        return true;
    } catch (error) {
        return false;
    }
}
