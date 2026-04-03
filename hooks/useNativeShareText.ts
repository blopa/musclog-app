import { useCallback } from 'react';
import { Share, type ShareContent, type ShareOptions } from 'react-native';

/** Optional `ShareContent` fields besides `message` (e.g. `title`, `url` on iOS). */
export type NativeShareTextContentExtras = Omit<Extract<ShareContent, { message: string }>, 'message'>;

/**
 * Stable wrapper around {@link Share.share} for text payloads (`message`).
 */
export function useNativeShareText() {
  const shareText = useCallback(
    (message: string, contentExtras?: NativeShareTextContentExtras, options?: ShareOptions) => {
      return Share.share({ message, ...contentExtras }, options);
    },
    []
  );

  return { shareText };
}
