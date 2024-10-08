import {
    dumpDatabase,
    getRecentWorkoutById,
    getWorkoutWithExercisesRepsAndSetsDetails,
    restoreDatabase,
} from '@/utils/database';
import { getCurrentTimestamp } from '@/utils/date';

import jsonData from '../data/importJsonExample.json';

export async function getFileInfoForExerciseId (exerciseId: number) {
    return {
        exists: false,
    };
}

export function getFileUriForExerciseId (exerciseId: number) {
    return '';
}

export function downloadAsyncToFileSystem (imageUrl: string, localFilePath: string) {
    return Promise.resolve();
}

export async function exportDatabase(encryptionPhrase?: string) {
    const dbDump = await dumpDatabase(encryptionPhrase);
    const fileName = `${getCurrentTimestamp()}-database_export.json`;

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
    const fileName = `${getCurrentTimestamp()}-recent_workout_export.json`;
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
    const fileName = `${getCurrentTimestamp()}-workout_export.json`;
    const jsonString = JSON.stringify(workoutWithDetails);
    
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    
    URL.revokeObjectURL(url);
}

export async function importDatabase() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = async (event) => {
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

export async function importCsv() {
    return {
        data: '',
        fileName: 'my-json-file.csv',
    };
}
