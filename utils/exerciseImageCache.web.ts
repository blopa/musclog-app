/**
 * Web stub: no local file system caching available.
 * Returns the cloud URL directly so the browser's own HTTP cache handles it.
 */
export async function getCachedExerciseImageUri(cloudUrl: string): Promise<string | null> {
    return cloudUrl;
}
