import { EXERCISE_IMAGE_GENERATION_TYPE, GEMINI_API_KEY_TYPE } from '@/constants/storage';
import i18n from '@/lang/lang';
import { getSetting, processWorkoutPlan } from '@/utils/database';
import { getBase64StringFromPhotoUri } from '@/utils/file';
import { WorkoutPlan, WorkoutReturnType } from '@/utils/types';
import {
    Content,
    FunctionDeclaration,
    GenerateContentRequest,
    GoogleGenerativeAI,
    HarmBlockThreshold,
    HarmCategory,
    Part,
    Tool,
    ToolConfig,
} from '@google/generative-ai';
import * as Sentry from '@sentry/react-native';

import {
    createWorkoutPlanPrompt,
    getCalculateNextWorkoutVolumeFunctions,
    getCalculateNextWorkoutVolumePrompt,
    getCreateWorkoutPlanFunctions,
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

const GEMINI_MODEL = 'gemini-1.5-flash'; // or gemini-1.5-pro-latest

export const getApiKey = async () =>
    (await getSetting(GEMINI_API_KEY_TYPE))?.value || process.env.EXPO_PUBLIC_FORCE_GEMINI_API_KEY;

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

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

export async function getNutritionInsights(startDate: string): Promise<string | undefined> {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = await getNutritionInsightsPrompt(startDate);

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        safetySettings,
        systemInstruction: {
            parts: systemParts,
            role: 'system',
        },
    });

    const generationConfig = {
        // maxOutputTokens: 2048,
        temperature: 0.9,
        topK: 1,
        topP: 1,
    };

    const conversationContent: Content[] = prompt
        .filter((msg) => msg.role !== 'system')
        .map((msg) => ({
            parts: [{ text: msg.content } as Part],
            role: msg.role === 'assistant' ? 'model' : msg.role,
        }));

    try {
        const result = await model.generateContent({
            contents: conversationContent,
            generationConfig,
        } as GenerateContentRequest);

        if (result.response.promptFeedback && result.response.promptFeedback.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        return result.response.candidates?.[0]?.content?.parts[0]?.text;
    } catch (e) {
        console.error(e);
        return;
    }
}

export async function sendChatMessage(messages: any[]) {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const conversationContent: Content[] = messages
        .filter((msg) => msg.role !== 'system')
        .map((msg) => ({
            parts: [{ text: msg.content } as Part],
            role: msg.role === 'assistant' ? 'model' : msg.role,
        }));

    const latestMessage = conversationContent.pop();
    const firstMessage = conversationContent.at(0);

    if (firstMessage?.role! !== 'user') {
        conversationContent.unshift({
            parts: [{ text: ' ' } as Part],
            role: 'user',
        });
    }

    const systemParts: Part[] = messages
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const functionDeclarations = getSendChatMessageFunctions() as FunctionDeclaration[];
    const tools: Tool[] = [{ functionDeclarations }];

    const model = genAI.getGenerativeModel({
        generationConfig: {
            // maxOutputTokens: 2048,
            // responseMimeType: 'application/json',
            temperature: 0.9,
            topK: 1,
            topP: 1,
        },
        model: GEMINI_MODEL,
        safetySettings,
        systemInstruction: {
            parts: systemParts,
            role: 'system',
        },
        toolConfig: {
            functionCallingConfig: {
                allowedFunctionNames: functionDeclarations.map((f) => f.name),
                mode: 'ANY',
            },
        } as ToolConfig,
        tools,
    });

    try {
        const chatSession = model.startChat({
            history: conversationContent,
        });

        const result = await chatSession.sendMessage(latestMessage?.parts?.[0].text!);

        if (result.response.promptFeedback && result.response.promptFeedback.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        return {
            messageToBio: '',
            messageToUser: i18n.t('great'),
            // shouldGenerateWorkout: false,
            ...result?.response?.candidates?.[0]?.content?.parts?.[0]?.functionCall?.args,
        };
    } catch (e) {
        console.error(e);
        return;
    }
}

async function createWorkoutPlan(messages: any[]) {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return;
    }

    const messagesToSend = messages.length > 20 ? messages.slice(0, 20) : messages;
    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = await createWorkoutPlanPrompt(messagesToSend);

    const conversationContent: Content[] = prompt
        .filter((msg) => msg.role !== 'system')
        .map((msg) => ({
            parts: [{ text: msg.content } as Part],
            role: msg.role === 'assistant' ? 'model' : msg.role,
        }));

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const functionDeclarations = getCreateWorkoutPlanFunctions() as FunctionDeclaration[];
    const tools: Tool[] = [{ functionDeclarations }];

    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        safetySettings,
        systemInstruction: {
            parts: systemParts,
            role: 'system',
        },
        toolConfig: {
            functionCallingConfig: {
                allowedFunctionNames: functionDeclarations.map((f) => f.name),
                mode: 'ANY',
            },
        } as ToolConfig,
        tools,
    });

    try {
        const result = await model.generateContent({
            contents: conversationContent,
            generationConfig: {
                // maxOutputTokens: 2048,
                temperature: 0.9,
                topK: 1,
                topP: 1,
            },
        } as GenerateContentRequest);

        if (result.response.promptFeedback && result.response.promptFeedback.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        return {
            description: 'Workout plan generated successfully',
            workoutPlan: [],
            ...result?.response?.candidates?.[0]?.content?.parts?.[0]?.functionCall?.args,
        };
    } catch (e) {
        console.error(e);
        return;
    }
}

export const calculateNextWorkoutVolume = async (workout: WorkoutReturnType) => {
    const apiKey = await getApiKey();
    if (!apiKey) {
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = await getCalculateNextWorkoutVolumePrompt(workout);

    const conversationContent: Content[] = prompt
        .filter((msg) => msg.role !== 'system')
        .map((msg) => ({
            parts: [{ text: msg.content } as Part],
            role: msg.role === 'assistant' ? 'model' : msg.role,
        }));

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const functionDeclarations = getCalculateNextWorkoutVolumeFunctions() as FunctionDeclaration[];
    const tools: Tool[] = [{ functionDeclarations }];

    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        safetySettings,
        systemInstruction: {
            parts: systemParts,
            role: 'system',
        },
        toolConfig: {
            functionCallingConfig: {
                allowedFunctionNames: functionDeclarations.map((f) => f.name),
                mode: 'ANY',
            },
        } as ToolConfig,
        tools,
    });

    try {
        const result = await model.generateContent({
            contents: conversationContent,
            generationConfig: {
                // maxOutputTokens: 2048,
                temperature: 0.9,
                topK: 1,
                topP: 1,
            },
        } as GenerateContentRequest);

        if (result.response.promptFeedback && result.response.promptFeedback.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        return {
            messageToUser: 'Next workout volume calculated successfully',
            workoutVolume: [],
            ...result?.response?.candidates?.[0]?.content?.parts?.[0]?.functionCall?.args,
        };
    } catch (e) {
        console.error(e);
        return;
    }
};

export const generateExerciseImage = async (exerciseName: string): Promise<string> => {
    const isImageGenerationEnabled = (await getSetting(EXERCISE_IMAGE_GENERATION_TYPE))?.value === 'true';
    if (!isImageGenerationEnabled) {
        return 'https://via.placeholder.com/300';
    }

    const apiKey = await getApiKey();

    if (!apiKey) {
        return 'https://via.placeholder.com/300';
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        safetySettings,
    });

    const generationConfig = {
        // maxOutputTokens: 2048,
        responseMimeType: 'image/jpeg',
        temperature: 0.9,
        topK: 1,
        topP: 1,
    };

    try {
        const result = await model.generateContent({
            contents: [{
                parts: [{
                    text: `Generate a flat design image, with only grayscale colors, showing a person performing the "${exerciseName}" exercise.`,
                }],
                role: 'user',
            }],
            generationConfig,
        } as GenerateContentRequest);

        if (result.response.promptFeedback && result.response.promptFeedback.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return 'https://via.placeholder.com/300';
        }

        const imageUrl = result.response.candidates?.[0]?.content?.parts[0]?.fileData?.fileUri;
        if (imageUrl) {
            return imageUrl;
        } else {
            console.log('No image found in the response');
            return 'https://via.placeholder.com/300';
        }
    } catch (e) {
        console.error(e);
        return 'https://via.placeholder.com/300';
    }
};

export const parsePastWorkouts = async (userMessage: string) => {
    const apiKey = await getApiKey();
    if (!apiKey) {
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = await getParsePastWorkoutsPrompt(userMessage);

    const conversationContent: Content[] = prompt
        .filter((msg) => msg.role !== 'system')
        .map((msg) => ({
            parts: [{ text: msg.content } as Part],
            role: msg.role === 'assistant' ? 'model' : msg.role,
        }));

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const functionDeclarations = getParsePastWorkoutsFunctions() as FunctionDeclaration[];
    const tools: Tool[] = [{ functionDeclarations }];

    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        safetySettings,
        systemInstruction: {
            parts: systemParts,
            role: 'system',
        },
        toolConfig: {
            functionCallingConfig: {
                allowedFunctionNames: functionDeclarations.map((f) => f.name),
                mode: 'ANY',
            },
        } as ToolConfig,
        tools,
    });

    try {
        const result = await model.generateContent({
            contents: conversationContent,
            generationConfig: {
                // maxOutputTokens: 2048,
                temperature: 0.9,
                topK: 1,
                topP: 1,
            },
        } as GenerateContentRequest);

        if (result.response.promptFeedback && result.response.promptFeedback.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        return {
            pastWorkouts: [],
            ...result?.response?.candidates?.[0]?.content?.parts?.[0]?.functionCall?.args,
        };
    } catch (e) {
        console.error(e);
        return;
    }
};

export const parsePastNutrition = async (userMessage: string) => {
    const apiKey = await getApiKey();
    if (!apiKey) {
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = await getParsePastNutritionPrompt(userMessage);

    const conversationContent: Content[] = prompt
        .filter((msg) => msg.role !== 'system')
        .map((msg) => ({
            parts: [{ text: msg.content } as Part],
            role: msg.role === 'assistant' ? 'model' : msg.role,
        }));

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const functionDeclarations = getParsePastNutritionFunctions() as FunctionDeclaration[];
    const tools: Tool[] = [{ functionDeclarations }];

    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        safetySettings,
        systemInstruction: {
            parts: systemParts,
            role: 'system',
        },
        toolConfig: {
            functionCallingConfig: {
                allowedFunctionNames: functionDeclarations.map((f) => f.name),
                mode: 'ANY',
            },
        } as ToolConfig,
        tools,
    });

    try {
        const result = await model.generateContent({
            contents: conversationContent,
            generationConfig: {
                // maxOutputTokens: 2048,
                temperature: 0.9,
                topK: 1,
                topP: 1,
            },
        } as GenerateContentRequest);

        if (result.response.promptFeedback && result.response.promptFeedback.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        return {
            pastNutrition: [],
            ...result?.response?.candidates?.[0]?.content?.parts?.[0]?.functionCall?.args,
        };
    } catch (e) {
        console.error(e);
        return;
    }
};

export const getRecentWorkoutInsights = async (workoutEventId: number): Promise<string | undefined> => {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = await getRecentWorkoutInsightsPrompt(workoutEventId);

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        safetySettings,
        systemInstruction: {
            parts: systemParts,
            role: 'system',
        },
    });

    const generationConfig = {
        // maxOutputTokens: 2048,
        temperature: 0.9,
        topK: 1,
        topP: 1,
    };

    const conversationContent: Content[] = prompt
        .filter((msg) => msg.role !== 'system')
        .map((msg) => ({
            parts: [{ text: msg.content } as Part],
            role: msg.role === 'assistant' ? 'model' : msg.role,
        }));

    try {
        const result = await model.generateContent({
            contents: conversationContent,
            generationConfig,
        } as GenerateContentRequest);

        if (result.response.promptFeedback && result.response.promptFeedback.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        return result.response.candidates?.[0]?.content?.parts[0]?.text;
    } catch (e) {
        console.error(e);
        return;
    }
};

export const getWorkoutInsights = async (workoutId: number): Promise<string | undefined> => {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = await getWorkoutInsightsPrompt(workoutId);

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        safetySettings,
        systemInstruction: {
            parts: systemParts,
            role: 'system',
        },
    });

    const generationConfig = {
        // maxOutputTokens: 2048,
        temperature: 0.9,
        topK: 1,
        topP: 1,
    };

    const conversationContent: Content[] = prompt
        .filter((msg) => msg.role !== 'system')
        .map((msg) => ({
            parts: [{ text: msg.content } as Part],
            role: msg.role === 'assistant' ? 'model' : msg.role,
        }));

    try {
        const result = await model.generateContent({
            contents: conversationContent,
            generationConfig,
        } as GenerateContentRequest);

        if (result.response.promptFeedback && result.response.promptFeedback.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        return result.response.candidates?.[0]?.content?.parts[0]?.text;
    } catch (e) {
        console.error(e);
        return;
    }
};

export const getWorkoutVolumeInsights = async (workoutId: number): Promise<string | undefined> => {
    const apiKey = await getApiKey();

    if (!apiKey) {
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = await getWorkoutVolumeInsightsPrompt(workoutId);

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        safetySettings,
        systemInstruction: {
            parts: systemParts,
            role: 'system',
        },
    });

    const generationConfig = {
        // maxOutputTokens: 2048,
        temperature: 0.9,
        topK: 1,
        topP: 1,
    };

    const conversationContent: Content[] = prompt
        .filter((msg) => msg.role !== 'system')
        .map((msg) => ({
            parts: [{ text: msg.content } as Part],
            role: msg.role === 'assistant' ? 'model' : msg.role,
        }));

    try {
        const result = await model.generateContent({
            contents: conversationContent,
            generationConfig,
        } as GenerateContentRequest);

        if (result.response.promptFeedback && result.response.promptFeedback.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        return result.response.candidates?.[0]?.content?.parts[0]?.text;
    } catch (e) {
        console.error(e);
        return;
    }
};

export async function estimateNutritionFromPhoto(photoUri: string) {
    // TODO: this is probably not the right way to do this, so fix it later
    const apiKey = await getApiKey();

    if (!apiKey) {
        return Promise.resolve(null);
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        safetySettings,
    });

    const generationConfig = {
        // maxOutputTokens: 2048,
        temperature: 0.9,
        topK: 1,
        topP: 1,
    };

    const base64Image = await getBase64StringFromPhotoUri(photoUri);

    const conversationContent: Content[] = [{
        parts: [{ text: 'Estimate the nutrition of the food in the image.' }],
        role: 'user',
    }];

    try {
        const result = await model.generateContent({
            contents: conversationContent,
            files: [{ content: base64Image, name: 'image.jpg' }],
            generationConfig,
        } as GenerateContentRequest);

        if (result.response.promptFeedback && result.response.promptFeedback.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return Promise.resolve(null);

        }

        // return result.response.candidates?.[0]?.content?.parts[0]?.text;

        return {
            calories: 0,
            carbs: 0,
            fat: 0,
            grams: 0,
            name: '',
            protein: 0,
        };
    } catch (e) {
        console.error(e);
        return Promise.resolve(null);
    }

    return {
        calories: 0,
        carbs: 0,
        fat: 0,
        grams: 0,
        name: '',
        protein: 0,
    };
}

export async function extractMacrosFromLabelPhoto(photoUri: string) {
    return {
        calories: 0,
        carbs: 0,
        fat: 0,
        grams: 0,
        name: '',
        protein: 0,
    };
}

export async function isAllowedLocation(apiKey: string): Promise<boolean> {
    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

        await model.generateContent({
            contents: [{ parts: [{ text: 'hi' } as Part], role: 'user' }],
            generationConfig: {
                maxOutputTokens: 1,
                temperature: 0.5,
            },
        } as GenerateContentRequest);

        return true;
    } catch (error) {
        // @ts-expect-error
        if (error?.status === 400 && error?.message?.includes('location is not supported')) {
            return false;
        } else {
            // send notification to Sentry
            Sentry.captureMessage(`Error in isAllowedLocation: ${error}`);
        }

        return false;
    }
}

export async function isValidApiKey(apiKey: string): Promise<boolean> {
    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

        await model.generateContent({
            contents: [{ parts: [{ text: 'hi' } as Part], role: 'user' }],
            generationConfig: {
                maxOutputTokens: 1,
                temperature: 0.5,
            },
        } as GenerateContentRequest);

        return true;
    } catch (error) {
        return false;
    }
}
