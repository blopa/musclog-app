import {
    EXERCISE_IMAGE_GENERATION_TYPE,
    OPENAI_API_KEY_TYPE,
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
    getSendChatMessageFunctions,
    getWorkoutInsightsPrompt,
    getWorkoutVolumeInsightsPrompt,
} from './prompts';

const OPENAI_MODEL = 'gpt-4o-mini';

export const getApiKey = async () =>
    (await getSetting(OPENAI_API_KEY_TYPE))?.value || process.env.EXPO_PUBLIC_FORCE_OPENAI_API_KEY;

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
        model: OPENAI_MODEL,
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
        model: OPENAI_MODEL,
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

export async function getNutritionInsights(startDate: string) {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return Promise.resolve();
    }

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true,
    });

    const result = await openai.chat.completions.create({
        messages: await getNutritionInsightsPrompt(startDate),
        model: OPENAI_MODEL,
    });

    return result?.choices?.[0].message.content;
}

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
        model: OPENAI_MODEL,
    });

    let jsonResponse = {
        messageToUser: '',
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
        model: OPENAI_MODEL,
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
        model: OPENAI_MODEL,
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
        model: OPENAI_MODEL,
    });

    return result?.choices?.[0].message.content;
};

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
        model: OPENAI_MODEL,
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
        model: OPENAI_MODEL,
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
            model: OPENAI_MODEL,
        });

        return true;
    } catch (error) {
        return false;
    }
}

export async function estimateNutritionFromPhoto(photoUri: string) {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return Promise.resolve();
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
        functions: getMacrosEstimationFunctions('Estimates the macronutrients of the meal from the photo') as OpenAI.Chat.ChatCompletionCreateParams.Function[],
        messages: [{
            role: 'user',
            content: [{
                type: 'image_url',
                image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                },
            }],
        }],
        model: OPENAI_MODEL,
    });

    let jsonResponse = {
        protein: 0,
        carbs: 0,
        fat: 0,
        calories: 0,
        name: '',
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
        return Promise.resolve();
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
        functions: getMacrosEstimationFunctions('Extract the macronutrients of the label from the photo') as OpenAI.Chat.ChatCompletionCreateParams.Function[],
        messages: [{
            role: 'user',
            content: [{
                type: 'image_url',
                image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                },
            }],
        }],
        model: OPENAI_MODEL,
    });

    let jsonResponse = {
        protein: 0,
        carbs: 0,
        fat: 0,
        calories: 0,
        name: '',
    };

    try {
        // @ts-expect-error
        jsonResponse = JSON.parse(result?.choices?.[0]?.message?.function_call?.arguments);
    } catch (error) {
        console.log('Error parsing JSON response:', error);
    }

    return jsonResponse;
}
