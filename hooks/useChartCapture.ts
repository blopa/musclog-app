import { ImageFormat, makeImageFromView } from '@shopify/react-native-skia';
import { cacheDirectory, EncodingType, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';

import { formatLocalCalendarDayIso } from '../utils/calendarDate';
import { showSnackbar } from '../utils/snackbarService';

function sanitizeFilename(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export function useChartCapture() {
  const captureRef = useRef<View>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const captureAndShare = useCallback(async (title: string) => {
    if (!captureRef.current || !cacheDirectory) {
      return;
    }

    setIsCapturing(true);
    await waitForNextFrame();

    try {
      const skImage = await makeImageFromView(captureRef);
      if (!skImage) {
        throw new Error('Failed to capture chart view');
      }

      const base64 = skImage.encodeToBase64(ImageFormat.PNG);
      const date = formatLocalCalendarDayIso(new Date());
      const filename = `musclog-${sanitizeFilename(title)}-${date}.png`;
      const fileUri = `${cacheDirectory}${filename}`;

      await writeAsStringAsync(fileUri, base64, { encoding: EncodingType.Base64 });
      await Sharing.shareAsync(fileUri, { mimeType: 'image/png' });

      showSnackbar('success', 'Chart saved');
    } catch (error) {
      console.error('Chart capture failed:', error);
      showSnackbar('error', 'Failed to export chart');
    } finally {
      setIsCapturing(false);
    }
  }, []);

  return { captureRef, isCapturing, captureAndShare };
}
