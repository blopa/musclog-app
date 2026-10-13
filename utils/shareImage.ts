import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type ShareImageResult = 'shared' | 'unavailable' | 'failed';

const isRemote = (uri: string) => /^https?:\/\//i.test(uri);

/**
 * Hands a photo to the system share sheet, from which the user can pick "Save image" / "Save to
 * Photos". It deliberately goes through the share sheet rather than writing to the media library:
 * saving that way needs `expo-media-library` and a permission the app does not otherwise hold, and
 * the app's rule is that picking photos needs none (see `utils/galleryImagePicker.ts`). On web it
 * downloads the file instead. Never throws — a sharing failure must not break the screen it is on.
 */
export async function shareImage(uri: string): Promise<ShareImageResult> {
  try {
    if (Platform.OS === 'web') {
      const anchor = document.createElement('a');
      anchor.href = uri;
      anchor.download = 'musclog-photo.jpg';
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      return 'shared';
    }

    if (!(await Sharing.isAvailableAsync())) {
      return 'unavailable';
    }

    let localUri = uri;
    if (isRemote(uri)) {
      if (!cacheDirectory) {
        return 'failed';
      }

      // The share sheet needs a file on this device, so a remote photo is fetched first.
      const downloaded = await downloadAsync(
        uri,
        `${cacheDirectory}musclog-photo-${Date.now()}.jpg`
      );
      localUri = downloaded.uri;
    }

    await Sharing.shareAsync(localUri, { mimeType: 'image/jpeg' });
    return 'shared';
  } catch (error) {
    console.warn('[shareImage] failed:', error);
    return 'failed';
  }
}
