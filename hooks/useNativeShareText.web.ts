import { useCallback } from 'react';
import type { ShareAction, ShareContent, ShareOptions } from 'react-native';

/** Optional `ShareContent` fields besides `message` (e.g. `title`, `url`). */
export type NativeShareTextContentExtras = Omit<
  Extract<ShareContent, { message: string }>,
  'message'
>;

function sanitizeDownloadBasename(raw: string): string {
  const trimmed = raw
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return trimmed.length > 0 ? trimmed : 'share';
}

function buildDownloadBody(message: string, extras?: NativeShareTextContentExtras): string {
  const parts: string[] = [];
  if (extras?.title?.trim()) {
    parts.push(extras.title.trim());
  }
  if (message.trim()) {
    parts.push(message.trim());
  }
  if (extras?.url?.trim()) {
    parts.push(extras.url.trim());
  }
  return parts.join('\n\n');
}

function downloadTextFile(body: string, basename: string): void {
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `${sanitizeDownloadBasename(basename)}.txt`;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

/**
 * Web implementation: uses the Web Share API when supported, otherwise downloads the text as a `.txt` file.
 * `options` is accepted for API parity with native and is ignored on web.
 */
export function useNativeShareText() {
  const shareText = useCallback(
    async (
      message: string,
      contentExtras?: NativeShareTextContentExtras,
      _options?: ShareOptions
    ): Promise<ShareAction> => {
      const shareData: ShareData = {
        title: contentExtras?.title,
        text: message,
        url: contentExtras?.url,
      };

      const canTryWebShare =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        (navigator.canShare == null || navigator.canShare(shareData));

      if (canTryWebShare) {
        try {
          await navigator.share(shareData);
          return { action: 'sharedAction' };
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return { action: 'dismissedAction' };
          }
        }
      }

      const body = buildDownloadBody(message, contentExtras);
      const basename =
        contentExtras?.title?.trim() ||
        _options?.subject?.trim() ||
        (contentExtras?.url?.trim() ? 'shared-link' : 'shared-text');
      downloadTextFile(body, basename);

      return { action: 'sharedAction' };
    },
    []
  );

  return { shareText };
}
