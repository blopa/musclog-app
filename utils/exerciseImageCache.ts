import { Directory, File, Paths } from 'expo-file-system';
import { downloadAsync } from 'expo-file-system/legacy';

/**
 * Returns a local cached URI for the given cloud image URL, downloading it if needed.
 * Returns null if the download fails or the URL is invalid.
 */
export async function getCachedExerciseImageUri(cloudUrl: string): Promise<string | null> {
    try {
        const filename = cloudUrl.split('/').pop();
        if (!filename) {
            return null;
        }

        const cacheDir = new Directory(Paths.document, 'exercise-images');
        const cachedFile = new File(cacheDir, filename);

        if (cachedFile.exists) {
            return cachedFile.uri;
        }

        if (!cacheDir.exists) {
            cacheDir.create();
        }

        const result = await downloadAsync(cloudUrl, cachedFile.uri);
        if (result.status === 200) {
            return cachedFile.uri;
        }

        // Clean up a partial file on non-200
        if (cachedFile.exists) {
            cachedFile.delete();
        }

        return null;
    } catch {
        return null;
    }
}
