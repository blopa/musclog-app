import {
    dumpDatabase,
    getRecentWorkoutById,
    getWorkoutWithExercisesRepsAndSetsDetails,
    restoreDatabase,
} from '@/utils/database';
import { getCurrentTimestampISOString } from '@/utils/date';

import jsonData from '../data/importJsonExample.json';

export function downloadAsyncToFileSystem (imageUrl: string, localFilePath: string) {
    return Promise.resolve();
}

export async function exportDatabase(encryptionPhrase?: string) {
    const dbDump = await dumpDatabase(encryptionPhrase);
    const fileName = `${getCurrentTimestampISOString()}-database_export.json`;

    const blob = new Blob([dbDump], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();

    URL.revokeObjectURL(url);
}

export async function exportRecentWorkout(recentWorkoutId: number) {
    const workoutWithDetails = await getRecentWorkoutById(recentWorkoutId);
    const fileName = `${getCurrentTimestampISOString()}-recent_workout_export.json`;
    const jsonString = JSON.stringify({
        ...workoutWithDetails,
        exerciseData: JSON.parse(workoutWithDetails?.exerciseData || '[]'),
    });

    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();

    URL.revokeObjectURL(url);
}

export async function exportWorkout(workoutId: number) {
    const workoutWithDetails = await getWorkoutWithExercisesRepsAndSetsDetails(workoutId);
    const fileName = `${getCurrentTimestampISOString()}-workout_export.json`;
    const jsonString = JSON.stringify(workoutWithDetails);

    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();

    URL.revokeObjectURL(url);
}

export async function getBase64StringFromPhotoUri(photoUri: string) {
    return photoUri.split(',')[1];
}

export async function getFileInfoForExerciseId (exerciseId: number) {
    return {
        exists: false,
    };
}

export function getFileUriForExerciseId (exerciseId: number) {
    return '';
}

export async function importCsv() {
    return {
        data: '',
        fileName: 'my-json-file.csv',
    };
}

export async function importDatabase() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = async (event) => {
        // eslint-disable-next-line no-undef
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dbDump = e.target?.result as string;
                await restoreDatabase(dbDump);
                window.location.reload();
            };
            reader.readAsText(file);
        }
    };

    input.click();
}

export async function importJson() {
    return {
        data: jsonData,
        fileName: 'my-json-file.json',
    };
}

export async function resizeImage(photoUri: string, width: number = 256): Promise<string> {
    try {
        // eslint-disable-next-line no-undef
        const image = new Image();
        image.src = photoUri;

        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = (err) => reject(err);
        });

        const aspectRatio = image.height / image.width;
        const newHeight = Math.round(width * aspectRatio);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Failed to get 2D context');
        }

        ctx.drawImage(image, 0, 0, width, newHeight);

        return canvas.toDataURL();
    } catch (error) {
        console.error('Failed to resize image:', error);
        throw new Error('Failed to resize image');
    }
}

