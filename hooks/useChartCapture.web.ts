import { toPng } from 'html-to-image';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';

import { theme } from '../theme';
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
    if (!captureRef.current) {
      return;
    }

    setIsCapturing(true);
    await waitForNextFrame();

    try {
      const domNode = captureRef.current as unknown as HTMLElement;
      const dataUrl = await toPng(domNode, {
        backgroundColor: theme.colors.background.primary,
        pixelRatio: 2,
      });

      const date = new Date().toISOString().slice(0, 10);
      const filename = `musclog-${sanitizeFilename(title)}-${date}.png`;

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.click();

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
