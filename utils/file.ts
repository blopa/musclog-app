import {
    dumpDatabase,
    getRecentWorkoutById,
    getWorkoutWithExercisesRepsAndSetsDetails,
    restoreDatabase,
} from '@/utils/database';
import { getCurrentTimestamp } from '@/utils/date';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Updates from 'expo-updates';
import Papa from 'papaparse';

export async function getFileInfoForExerciseId (exerciseId: number) {
    try {
        const localFilePath = getFileUriForExerciseId(exerciseId);
        return await FileSystem.getInfoAsync(localFilePath);
    } catch (error) {
        console.error('Error getting file info for exercise ID:', error);
        alert('An error occurred while getting file info. Please try again.');
    }

    return null;
}

export function getFileUriForExerciseId (exerciseId: number) {
    return `${FileSystem.documentDirectory}${exerciseId}`;
}

export async function downloadAsyncToFileSystem (imageUrl: string, localFilePath: string) {
    try {
        return await FileSystem.downloadAsync(imageUrl, localFilePath);
    } catch (error) {
        console.error('Error downloading file:', error);
        alert('An error occurred while downloading the file. Please try again.');
    }

    return null;
}

export async function exportDatabase(encryptionPhrase?: string) {
    const timestamp = getCurrentTimestamp();
    const fileUri = `${FileSystem.cacheDirectory}${timestamp}-database_export.json`;

    try {
        const dbDump = await dumpDatabase(encryptionPhrase);

        await FileSystem.writeAsStringAsync(fileUri, dbDump);

        await Sharing.shareAsync(fileUri);
    } catch (error) {
        console.error('Error exporting database:', error);
        alert('An error occurred while exporting the database. Please try again.');
    }
}

export async function exportRecentWorkout(recentWorkoutId: number) {
    const timestamp = getCurrentTimestamp();
    const fileUri = `${FileSystem.cacheDirectory}${timestamp}-recent_workout_export.json`;

    try {
        const workoutWithDetails = await getRecentWorkoutById(recentWorkoutId);

        await FileSystem.writeAsStringAsync(fileUri, JSON.stringify({
            ...workoutWithDetails,
            exerciseData: JSON.parse(workoutWithDetails?.exerciseData || '[]'),
        }));

        await Sharing.shareAsync(fileUri);
    } catch (error) {
        console.error('Error exporting recent workout:', error);
        alert('An error occurred while exporting the recent workout. Please try again.');
    }
}

export async function exportWorkout(workoutId: number) {
    const timestamp = getCurrentTimestamp();
    const fileUri = `${FileSystem.cacheDirectory}${timestamp}-workout_export.json`;

    try {
        const workoutWithDetails = await getWorkoutWithExercisesRepsAndSetsDetails(workoutId);

        await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(workoutWithDetails));

        await Sharing.shareAsync(fileUri);
    } catch (error) {
        console.error('Error exporting workout:', error);
        alert('An error occurred while exporting the workout. Please try again.');
    }
}

export async function importDatabase(decryptionPhrase?: string) {
    try {
        const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
        if (!result.canceled && result.assets.length > 0) {
            const uri = result.assets[0].uri;

            const dbDump = await FileSystem.readAsStringAsync(uri);
            await restoreDatabase(dbDump, decryptionPhrase);
            await Updates.reloadAsync();
        }
    } catch (error) {
        console.error('Error importing database:', error);
        alert('An error occurred while importing the database. Please try again.');
    }
}

export async function importJson() {
    try {
        const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
        if (!result.canceled && result.assets.length > 0) {
            const uri = result.assets[0].uri;

            const dataString = await FileSystem.readAsStringAsync(uri);
            return {
                data: JSON.parse(dataString),
                fileName: result.assets[0].name,
            };
        }

        return {
            data: {},
            fileName: '',
        };
    } catch (error) {
        console.error('Error importing JSON:', error);
        alert('An error occurred while importing JSON data. Please try again.');
    }

    return {};
}

export async function importCsv() {
    try {
        const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
        if (!result.canceled && result.assets.length > 0) {
            const uri = result.assets[0].uri;
            const fileName = result.assets[0].name;

            if (fileName.endsWith('.csv')) {
                const dataString = await FileSystem.readAsStringAsync(uri);
                const { data } = Papa.parse(dataString, { header: true });

                return {
                    data: data as Record<string, string>[],
                    fileName,
                };
            } else {
                alert('Please select a CSV file.');
                return {
                    data: [],
                    fileName: '',
                };
            }
        }

        return {
            data: [],
            fileName: '',
        };
    } catch (error) {
        console.error('Error importing CSV:', error);
        alert('An error occurred while importing CSV data. Please try again.');
    }

    return {};
}
