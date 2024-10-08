import { GEMINI_API_KEY_TYPE, OPENAI_API_KEY_TYPE } from '@/constants/storage';
import * as geminiFunctions from '@/utils/gemini';
import * as openAiFunctions from '@/utils/openai';
import { WorkoutReturnType } from '@/utils/types';

export const getAiApiVendor = async () => {
    if (await geminiFunctions.getApiKey()) {
        return GEMINI_API_KEY_TYPE;
    } else if (await openAiFunctions.getApiKey()) {
        return OPENAI_API_KEY_TYPE;
    }

    return null;
}

export const sendChatMessage = async (messages: any[]) => {
    const vendor = await getAiApiVendor();

    if (vendor === OPENAI_API_KEY_TYPE) {
        return openAiFunctions.sendChatMessage(messages);
    } else if (vendor === GEMINI_API_KEY_TYPE) {
        return geminiFunctions.sendChatMessage(messages);
    }

    return;
};

export const getNutritionInsights = async (startDate: string) => {
    const vendor = await getAiApiVendor();

    if (vendor === OPENAI_API_KEY_TYPE) {
        return openAiFunctions.getNutritionInsights(startDate);
    } else if (vendor === GEMINI_API_KEY_TYPE) {
        return geminiFunctions.getNutritionInsights(startDate);
    }

    return;
};

export const generateWorkoutPlan = async (messages: any[]) => {
    const vendor = await getAiApiVendor();

    if (vendor === OPENAI_API_KEY_TYPE) {
        return openAiFunctions.generateWorkoutPlan(messages);
    } else if (vendor === GEMINI_API_KEY_TYPE) {
        return geminiFunctions.generateWorkoutPlan(messages);
    }

    return false;
};

export const calculateNextWorkoutVolume = async (workout: WorkoutReturnType) => {
    const vendor = await getAiApiVendor();

    if (vendor === OPENAI_API_KEY_TYPE) {
        return openAiFunctions.calculateNextWorkoutVolume(workout);
    } else if (vendor === GEMINI_API_KEY_TYPE) {
        return geminiFunctions.calculateNextWorkoutVolume(workout);
    }

    return;
};

export const generateExerciseImage = async (exerciseName: string) => {
    const vendor = await getAiApiVendor();

    if (vendor === OPENAI_API_KEY_TYPE) {
        return openAiFunctions.generateExerciseImage(exerciseName);
    } else if (vendor === GEMINI_API_KEY_TYPE) {
        return geminiFunctions.generateExerciseImage(exerciseName);
    }

    return;
};

export const parsePastWorkouts = async (userMessage: string) => {
    const vendor = await getAiApiVendor();

    if (vendor === OPENAI_API_KEY_TYPE) {
        return openAiFunctions.parsePastWorkouts(userMessage);
    } else if (vendor === GEMINI_API_KEY_TYPE) {
        return geminiFunctions.parsePastWorkouts(userMessage);
    }

    return;
};

export const parsePastNutrition = async (userMessage: string) => {
    const vendor = await getAiApiVendor();

    if (vendor === OPENAI_API_KEY_TYPE) {
        return openAiFunctions.parsePastNutrition(userMessage);
    } else if (vendor === GEMINI_API_KEY_TYPE) {
        return geminiFunctions.parsePastNutrition(userMessage);
    }

    return;
};

export const getWorkoutInsights = async (workoutId: number) => {
    const vendor = await getAiApiVendor();

    if (vendor === OPENAI_API_KEY_TYPE) {
        return openAiFunctions.getWorkoutInsights(workoutId);
    } else if (vendor === GEMINI_API_KEY_TYPE) {
        return geminiFunctions.getWorkoutInsights(workoutId);
    }

    return;
};

export const getRecentWorkoutInsights = async (workoutId: number) => {
    // TODO: update this to have its own prompt
    const vendor = await getAiApiVendor();

    if (vendor === OPENAI_API_KEY_TYPE) {
        return openAiFunctions.getRecentWorkoutInsights(workoutId);
    } else if (vendor === GEMINI_API_KEY_TYPE) {
        return geminiFunctions.getRecentWorkoutInsights(workoutId);
    }

    return;
};

export const getWorkoutVolumeInsights = async (workoutId: number) => {
    const vendor = await getAiApiVendor();

    if (vendor === OPENAI_API_KEY_TYPE) {
        return openAiFunctions.getWorkoutVolumeInsights(workoutId);
    } else if (vendor === GEMINI_API_KEY_TYPE) {
        return geminiFunctions.getWorkoutVolumeInsights(workoutId);
    }

    return;
};

export const isValidApiKey = (key: string, vendor: string) => {
    if (vendor === OPENAI_API_KEY_TYPE) {
        return openAiFunctions.isValidApiKey(key);
    } else if (vendor === GEMINI_API_KEY_TYPE) {
        return geminiFunctions.isValidApiKey(key);
    }

    return false;
}

export const isAllowedLocation = async (key: string, vendor: string) => {
    if (key && vendor === GEMINI_API_KEY_TYPE) {
        return geminiFunctions.isAllowedLocation(key);
    }

    return true;
};
