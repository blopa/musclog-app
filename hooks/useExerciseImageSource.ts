import { useEffect, useState } from 'react';
import { ImageSourcePropType } from 'react-native';

import { FALLBACK_EXERCISE_IMAGE } from '@/utils/exerciseImage';
import { getCachedExerciseImageUri } from '@/utils/exerciseImageCache';

/**
 * Resolves an exercise imageUrl to a React Native ImageSource.
 *
 * - Cloud URLs (http/https): downloaded once and cached locally; subsequent calls
 *   return the cached file URI without hitting the network.
 * - Local file:// URIs (user-uploaded photos): returned as-is.
 * - Empty / null / undefined: returns FALLBACK_EXERCISE_IMAGE.
 *
 * Always returns the fallback synchronously on first render to avoid flicker.
 */
export function useExerciseImageSource(
    imageUrl: string | null | undefined
): ImageSourcePropType {
    const [source, setSource] = useState<ImageSourcePropType>(FALLBACK_EXERCISE_IMAGE);

    useEffect(() => {
        if (!imageUrl?.trim()) {
            setSource(FALLBACK_EXERCISE_IMAGE);
            return;
        }

        if (imageUrl.startsWith('file://')) {
            setSource({ uri: imageUrl });
            return;
        }

        if (imageUrl.startsWith('http')) {
            let cancelled = false;
            getCachedExerciseImageUri(imageUrl).then((cachedUri) => {
                if (cancelled) {
                    return;
                }
                if (cachedUri) {
                    setSource({ uri: cachedUri });
                } else {
                    setSource(FALLBACK_EXERCISE_IMAGE);
                }
            });
            return () => {
                cancelled = true;
            };
        }

        // Fallback for any other scheme
        setSource({ uri: imageUrl });
    }, [imageUrl]);

    return source;
}
