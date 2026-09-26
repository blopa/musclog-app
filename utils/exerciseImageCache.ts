import { Directory, File, Paths } from 'expo-file-system';
import { downloadAsync } from 'expo-file-system/legacy';

import { exerciseImageCacheKey } from '@/utils/exerciseImage';

const CACHE_DIR_NAME = 'exercise-images';

/**
 * Returns a local cached URI for the given cloud image URL, downloading it if needed.
 * Returns null if the download fails or the URL is invalid.
 */
export async function getCachedExerciseImageUri(cloudUrl: string): Promise<null | string> {
  try {
    const filename = exerciseImageCacheKey(cloudUrl);
    if (!filename) {
      return null;
    }

    const cacheDir = new Directory(Paths.document, CACHE_DIR_NAME);
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

/**
 * Deletes the `exercise<N>.png` files cached from the retired catalogue. The cache has no
 * eviction, so without this sweep every user carries up to 256 dead PNGs — the images they
 * viewed before upgrading — in their document directory forever. Safe to call repeatedly.
 */
export function purgeRetiredExerciseImageCache(): number {
  try {
    const cacheDir = new Directory(Paths.document, CACHE_DIR_NAME);
    if (!cacheDir.exists) {
      return 0;
    }

    let removed = 0;
    for (const entry of cacheDir.list()) {
      if (entry instanceof File && /^exercise\d+\.png$/i.test(entry.name)) {
        entry.delete();
        removed += 1;
      }
    }

    return removed;
  } catch {
    return 0;
  }
}
