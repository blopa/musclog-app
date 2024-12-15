import type { ChatCompletionMessageParam } from 'openai/resources';

import { GEMINI_MODELS } from '@/constants/ai';
import { EXERCISE_IMAGE_GENERATION_TYPE, GEMINI_API_KEY_TYPE, GEMINI_MODEL_TYPE } from '@/constants/storage';
import i18n from '@/lang/lang';
import { getSetting, processWorkoutPlan } from '@/utils/database';
import { getBase64StringFromPhotoUri, resizeImage } from '@/utils/file';
import { getAccessToken as getGoogleAccessToken, refreshAccessToken } from '@/utils/googleAuth';
import { captureMessage } from '@/utils/sentry';
import { WorkoutPlan, WorkoutReturnType } from '@/utils/types';
import {
    Content,
    FunctionDeclaration,
    GenerateContentRequest,
    GoogleGenerativeAI,
    HarmBlockThreshold,
    HarmCategory,
    ModelParams,
    Part,
    StartChatParams,
    Tool,
    ToolConfig,
} from '@google/generative-ai';
// import fetch from 'isomorphic-fetch';
import { fetch } from 'expo/fetch';

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
    const defaultModel = GEMINI_MODELS.GEMINI_FLASH_1_5.model;
    const savedModel = await getSetting(GEMINI_MODEL_TYPE);

    if (!savedModel) {
        return defaultModel;
    }

    const model = Object.values(GEMINI_MODELS)
        .find((m) => m.value === Number(savedModel.value));

    return model?.model || defaultModel;
};

// https://cloud.google.com/vertex-ai/generative-ai/docs/reference/python/latest/vertexai.generative_models.FinishReason
const ACCEPTABLE_STOP_REASONS = ['MAX_TOKENS', 'STOP'];

export const getApiKey = async () =>
    (await getSetting(GEMINI_API_KEY_TYPE))?.value || process.env.EXPO_PUBLIC_FORCE_GEMINI_API_KEY;

export const getAccessToken = async () => await getGoogleAccessToken();

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const getGenerativeAI = async ({ accessToken, apiKey }: { accessToken?: string; apiKey?: string;}): Promise<GoogleGenerativeAI> => {
    if (accessToken) {
        return {
            getGenerativeModel: ({ model, ...modelParams }: ModelParams) => {
                return {
                    generateContent: async (request: GenerateContentRequest) => {
                        return await rawFetchGeminiApi(model, accessToken, {
                            ...modelParams,
                            ...request,
                        });
                    },
                    startChat: ({ history }: StartChatParams) => {
                        return {
                            sendMessage: async (request: string) => {
                                return await rawFetchGeminiApi(model, accessToken, {
                                    ...modelParams,
                                    contents: [
                                        ...(history || []),
                                        { parts: [{ text: request } as Part], role: 'user' },
                                    ],
                                });
                            },
                        };
                    },
                };
            },
        } as unknown as GoogleGenerativeAI;
    }

    if (apiKey) {
        return new GoogleGenerativeAI(apiKey);
    }

    return {
        getGenerativeModel: (modelParams: ModelParams) => {
            return {
                generateContent: async (request: GenerateContentRequest) => {
                    captureMessage('No API key or access token provided for generative AI');
                    return {
                        response: null,
                        status: 401,
                    };
                },
                startChat: async (startChatParams: StartChatParams) => {
                    return {
                        sendMessage: async (request: string) => {
                            captureMessage('No API key or access token provided for generative AI');
                            return {
                                response: {},
                                status: 401,
                            };
                        },
                    };
                },
            };
        },
    } as unknown as GoogleGenerativeAI;
};

const rawFetchGeminiApi = async (model: string, accessToken: string, body: any) => {
    const makeRequest = async (accessToken: string) => {
        const result = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
                body: JSON.stringify(body),
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                method: 'POST',
            }
        );

        return result;
    };

    // First attempt
    let result = await makeRequest(accessToken);

    if (result.status === 401) {
        try {
            console.warn('Access token is invalid. Attempting to refresh...');
            const newAccessToken = await refreshAccessToken();

            if (newAccessToken) {
                // Retry with the new access token
                result = await makeRequest(newAccessToken);
            }
        } catch (error) {
            console.error('Error refreshing access token:', error);
            throw new Error('Failed to refresh access token and retry the request.');
        }
    }

    if (result.ok) {
        const data = await result.json();

        return {
            response: data,
            status: result.status,
        };
    }

    return {
        response: null,
        status: result.status,
    };
};

const configureBasicGenAI = async ({ accessToken, apiKey, model }: { accessToken?: string; apiKey?: string; model?: string; }, systemParts?: Part[]) => {
    const genAI = await getGenerativeAI({ accessToken, apiKey });

    return genAI.getGenerativeModel({
        model: model || await getModel(),
        safetySettings,
        ... systemParts && {
            systemInstruction: {
                parts: systemParts,
                role: 'system',
            },
        },
    });
};

const createConversationContent = (messages: ChatCompletionMessageParam[]): Content[] =>
    messages.filter((msg) => msg.role !== 'system')
        .map((msg) => ({
            parts: [{ text: msg.content } as Part],
            role: msg.role === 'assistant' ? 'model' : msg.role,
        }));

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

export async function getNutritionInsights(startDate: string, endDate: string): Promise<string | undefined> {
    const apiKey = await getApiKey();
    const accessToken = await getAccessToken();

    if (!apiKey && !accessToken) {
        return;
    }

    const prompt = await getNutritionInsightsPrompt(startDate, endDate);

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const model = await configureBasicGenAI({ accessToken, apiKey }, systemParts);

    const generationConfig = {
        // maxOutputTokens: 2048,
        temperature: 0.9,
        topK: 1,
        topP: 1,
    };

    const conversationContent: Content[] = createConversationContent(prompt);

    try {
        const result = await model.generateContent({
            contents: conversationContent,
            generationConfig,
        } as GenerateContentRequest);

        if (result?.response?.promptFeedback?.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        if (!ACCEPTABLE_STOP_REASONS.includes(result?.response?.candidates?.[0]?.finishReason || '')) {
            console.log(`Blocked for ${result?.response?.candidates?.[0]?.finishReason}`);
            return;
        }

        return result.response.candidates?.[0]?.content?.parts[0]?.text;
    } catch (e) {
        console.error(e);
        return;
    }
}

export async function getRecentWorkoutsInsights(startDate: string, endDate: string): Promise<string | undefined> {
    const apiKey = await getApiKey();
    const accessToken = await getAccessToken();

    if (!apiKey && !accessToken) {
        return;
    }

    const prompt = await getRecentWorkoutsInsightsPrompt(startDate, endDate);

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const model = await configureBasicGenAI({ accessToken, apiKey }, systemParts);

    const generationConfig = {
        // maxOutputTokens: 2048,
        temperature: 0.9,
        topK: 1,
        topP: 1,
    };

    const conversationContent: Content[] = createConversationContent(prompt);

    try {
        const result = await model.generateContent({
            contents: conversationContent,
            generationConfig,
        } as GenerateContentRequest);

        if (result.response?.promptFeedback?.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        if (!ACCEPTABLE_STOP_REASONS.includes(result?.response?.candidates?.[0]?.finishReason || '')) {
            console.log(`Blocked for ${result?.response?.candidates?.[0]?.finishReason}`);
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
    const accessToken = await getAccessToken();

    if (!apiKey && !accessToken) {
        return;
    }

    const genAI = await getGenerativeAI({ accessToken, apiKey });

    const conversationContent: Content[] = createConversationContent(messages);

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
        model: await getModel(),
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

        if (result.response?.promptFeedback?.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        if (!ACCEPTABLE_STOP_REASONS.includes(result?.response?.candidates?.[0]?.finishReason || '')) {
            console.log(`Blocked for ${result?.response?.candidates?.[0]?.finishReason}`);
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
    const accessToken = await getAccessToken();

    if (!apiKey && !accessToken) {
        return;
    }

    const messagesToSend = messages.length > 20 ? messages.slice(0, 20) : messages;
    const genAI = await getGenerativeAI({ accessToken, apiKey });
    const prompt = await createWorkoutPlanPrompt(messagesToSend);

    const conversationContent: Content[] = createConversationContent(prompt);

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const functionDeclarations = getCreateWorkoutPlanFunctions() as FunctionDeclaration[];
    const tools: Tool[] = [{ functionDeclarations }];

    const model = genAI.getGenerativeModel({
        model: await getModel(),
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

        if (result.response?.promptFeedback?.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        if (!ACCEPTABLE_STOP_REASONS.includes(result?.response?.candidates?.[0]?.finishReason || '')) {
            console.log(`Blocked for ${result?.response?.candidates?.[0]?.finishReason}`);
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
    const accessToken = await getAccessToken();

    if (!apiKey && !accessToken) {
        return;
    }

    const genAI = await getGenerativeAI({ accessToken, apiKey });
    const prompt = await getCalculateNextWorkoutVolumePrompt(workout);

    const conversationContent: Content[] = createConversationContent(prompt);

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const functionDeclarations = getCalculateNextWorkoutVolumeFunctions() as FunctionDeclaration[];
    const tools: Tool[] = [{ functionDeclarations }];

    const model = genAI.getGenerativeModel({
        model: await getModel(),
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

        if (result.response?.promptFeedback?.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        if (!ACCEPTABLE_STOP_REASONS.includes(result?.response?.candidates?.[0]?.finishReason || '')) {
            console.log(`Blocked for ${result?.response?.candidates?.[0]?.finishReason}`);
            return;
        }

        return {
            messageToUser: i18n.t('next_workout_calculated_successfully'),
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
    const accessToken = await getAccessToken();

    if (!apiKey && !accessToken) {
        return 'https://via.placeholder.com/300';
    }

    const model = await configureBasicGenAI({
        accessToken,
        apiKey,
        model: GEMINI_MODELS.GEMINI_FLASH_2_0.model,
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

        if (result.response?.promptFeedback?.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return 'https://via.placeholder.com/300';
        }

        if (!ACCEPTABLE_STOP_REASONS.includes(result?.response?.candidates?.[0]?.finishReason || '')) {
            console.log(`Blocked for ${result?.response?.candidates?.[0]?.finishReason}`);
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
    const accessToken = await getAccessToken();

    if (!apiKey && !accessToken) {
        return;
    }

    const genAI = await getGenerativeAI({ accessToken, apiKey });
    const prompt = await getParsePastWorkoutsPrompt(userMessage);

    const conversationContent: Content[] = createConversationContent(prompt);

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const functionDeclarations = getParsePastWorkoutsFunctions() as FunctionDeclaration[];
    const tools: Tool[] = [{ functionDeclarations }];

    const model = genAI.getGenerativeModel({
        model: await getModel(),
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

        if (result.response?.promptFeedback?.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        if (!ACCEPTABLE_STOP_REASONS.includes(result?.response?.candidates?.[0]?.finishReason || '')) {
            console.log(`Blocked for ${result?.response?.candidates?.[0]?.finishReason}`);
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
    const accessToken = await getAccessToken();

    if (!apiKey && !accessToken) {
        return;
    }

    const genAI = await getGenerativeAI({ accessToken, apiKey });
    const prompt = await getParsePastNutritionPrompt(userMessage);

    const conversationContent: Content[] = createConversationContent(prompt);

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const functionDeclarations = getParsePastNutritionFunctions() as FunctionDeclaration[];
    const tools: Tool[] = [{ functionDeclarations }];

    const model = genAI.getGenerativeModel({
        model: await getModel(),
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

        if (result.response?.promptFeedback?.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        if (!ACCEPTABLE_STOP_REASONS.includes(result?.response?.candidates?.[0]?.finishReason || '')) {
            console.log(`Blocked for ${result?.response?.candidates?.[0]?.finishReason}`);
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
    const accessToken = await getAccessToken();

    if (!apiKey && !accessToken) {
        return;
    }

    const prompt = await getRecentWorkoutInsightsPrompt(workoutEventId);

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const model = await configureBasicGenAI({ accessToken, apiKey }, systemParts);

    const generationConfig = {
        // maxOutputTokens: 2048,
        temperature: 0.9,
        topK: 1,
        topP: 1,
    };

    const conversationContent: Content[] = createConversationContent(prompt);

    try {
        const result = await model.generateContent({
            contents: conversationContent,
            generationConfig,
        } as GenerateContentRequest);

        if (result.response?.promptFeedback?.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        if (!ACCEPTABLE_STOP_REASONS.includes(result?.response?.candidates?.[0]?.finishReason || '')) {
            console.log(`Blocked for ${result?.response?.candidates?.[0]?.finishReason}`);
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
    const accessToken = await getAccessToken();

    if (!apiKey && !accessToken) {
        return;
    }

    const prompt = await getWorkoutInsightsPrompt(workoutId);

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const model = await configureBasicGenAI({ accessToken, apiKey }, systemParts);

    const generationConfig = {
        // maxOutputTokens: 2048,
        temperature: 0.9,
        topK: 1,
        topP: 1,
    };

    const conversationContent: Content[] = createConversationContent(prompt);

    try {
        const result = await model.generateContent({
            contents: conversationContent,
            generationConfig,
        } as GenerateContentRequest);

        if (result.response?.promptFeedback?.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        if (!ACCEPTABLE_STOP_REASONS.includes(result?.response?.candidates?.[0]?.finishReason || '')) {
            console.log(`Blocked for ${result?.response?.candidates?.[0]?.finishReason}`);
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
    const accessToken = await getAccessToken();

    if (!apiKey && !accessToken) {
        return;
    }

    const prompt = await getWorkoutVolumeInsightsPrompt(workoutId);

    const systemParts: Part[] = prompt
        .filter((msg) => msg.role === 'system')
        .map((msg) => ({ text: msg.content } as Part));

    const model = await configureBasicGenAI({ accessToken, apiKey }, systemParts);

    const generationConfig = {
        // maxOutputTokens: 2048,
        temperature: 0.9,
        topK: 1,
        topP: 1,
    };

    const conversationContent: Content[] = createConversationContent(prompt);

    try {
        const result = await model.generateContent({
            contents: conversationContent,
            generationConfig,
        } as GenerateContentRequest);

        if (result.response?.promptFeedback?.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return;
        }

        if (!ACCEPTABLE_STOP_REASONS.includes(result?.response?.candidates?.[0]?.finishReason || '')) {
            console.log(`Blocked for ${result?.response?.candidates?.[0]?.finishReason}`);
            return;
        }

        return result.response.candidates?.[0]?.content?.parts[0]?.text;
    } catch (e) {
        console.error(e);
        return;
    }
};

export async function estimateNutritionFromPhoto(photoUri: string) {
    const apiKey = await getApiKey();
    const accessToken = await getAccessToken();

    if (!apiKey && !accessToken) {
        return;
    }

    const base64Image = await getBase64StringFromPhotoUri(await resizeImage(photoUri));

    const genAI = await getGenerativeAI({ accessToken, apiKey });

    const functionDeclarations = getMacrosEstimationFunctions(
        'Extracts the macronutrients of a food label from a photo',
        'extracted'
    ) as FunctionDeclaration[];
    const tools: Tool[] = [{ functionDeclarations }];

    const model = genAI.getGenerativeModel({
        model: await getModel(),
        safetySettings,
        systemInstruction: {
            parts: [{
                text: [
                    'You are a very powerful AI, trained to extract the macronutrients of a food label from the photo provided',
                    'Use OCR to extract the text from the image, then parse the text to extract the macronutrients.',
                ].join('\n'),
            }],
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
            contents: [{
                parts: [{
                    text: [
                        'Please estimate the macronutrients of the food/meal from the photo provided',
                    ].join('\n'),
                }, {
                    inline_data: {
                        data: base64Image,
                        mime_type: 'image/jpeg',
                    },
                }],
                role: 'user',
            }],
            generationConfig: {
                maxOutputTokens: 1024,
                temperature: 0.7,
                topK: 1,
                topP: 1,
            },
        } as GenerateContentRequest);

        if (result.response.promptFeedback?.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return null;
        }

        return {
            carbs: 0,
            fat: 0,
            grams: 0,
            kcal: 0,
            kj: 0,
            name: '',
            protein: 0,
            ...result?.response?.candidates?.[0]?.content?.parts?.[0]?.functionCall?.args,
        };
    } catch (error) {
        console.error('Error estimating nutrition from photo:', error);
        return null;
    }
}

export async function extractMacrosFromLabelPhoto(photoUri: string) {
    const apiKey = await getApiKey();
    const accessToken = await getAccessToken();

    if (!apiKey && !accessToken) {
        return;
    }

    const base64Image = await getBase64StringFromPhotoUri(await resizeImage(photoUri));

    const genAI = await getGenerativeAI({ accessToken, apiKey });

    const functionDeclarations = getMacrosEstimationFunctions(
        'Extracts the macronutrients of a food label from a photo',
        'extracted'
    ) as FunctionDeclaration[];
    const tools: Tool[] = [{ functionDeclarations }];

    const model = genAI.getGenerativeModel({
        model: await getModel(),
        safetySettings,
        systemInstruction: {
            parts: [{
                text: [
                    'You are a very powerful AI, trained to extract the macronutrients of a food label from the photo provided',
                    'Use OCR to extract the text from the image, then parse the text to extract the macronutrients.',
                ].join('\n'),
            }],
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
            contents: [{
                parts: [{
                    text: [
                        'Please extract the macronutrients of the food label from the photo provided.',
                    ].join('\n'),
                }, {
                    inline_data: {
                        data: base64Image,
                        mime_type: 'image/jpeg',
                    },
                }],
                role: 'user',
            }],
            generationConfig: {
                maxOutputTokens: 1024,
                temperature: 0.7,
                topK: 1,
                topP: 1,
            },
        } as GenerateContentRequest);

        if (result.response.promptFeedback?.blockReason) {
            console.log(`Blocked for ${result.response.promptFeedback.blockReason}`);
            return null;
        }

        return {
            carbs: 0,
            fat: 0,
            grams: 0,
            kcal: 0,
            kj: 0,
            name: '',
            protein: 0,
            ...result?.response?.candidates?.[0]?.content?.parts?.[0]?.functionCall?.args,
        };
    } catch (error) {
        console.error('Error extracting macros from label photo:', error);
        return null;
    }
}

export async function isAllowedLocation(apiKey: string): Promise<boolean> {
    try {
        const model = await configureBasicGenAI({ apiKey });

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
            captureMessage(`Error in isAllowedLocation: ${error}`);
        }

        return false;
    }
}

export async function isValidAccessToken(accessToken: string): Promise<boolean> {
    try {
        const model = await configureBasicGenAI({ accessToken });

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

export async function isValidApiKey(apiKey: string): Promise<boolean> {
    try {
        const model = await configureBasicGenAI({ apiKey });

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
