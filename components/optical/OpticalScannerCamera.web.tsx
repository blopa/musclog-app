/**
 * Optical transfer — the receiving camera, in a browser.
 *
 * Same contract as the native component (`OpticalScannerCamera.tsx`): it owns the camera and the
 * permission UI, and reports codes through `onCodeScanned(codes, frame)` in vision-camera's shape,
 * so `useOpticalReceiver` is platform-agnostic and neither half of the hook knows which one it is
 * talking to.
 *
 * WHAT IS DIFFERENT FROM NATIVE, and why:
 *
 *  - THE FRAME PUMP IS OURS. There is no code-scanner pipeline to subscribe to, so we drive
 *    decoding off `requestVideoFrameCallback` — one callback per frame the browser actually
 *    presents, which self-limits to the camera's rate instead of spinning a timer against it.
 *    Firefox has no rVFC, so it falls back to a timer at a rate a decode can keep up with.
 *  - DECODES DO NOT OVERLAP. `decodingRef` drops a frame rather than queueing it. Queuing would
 *    build an ever-growing backlog of stale frames — and a frame from 400 ms ago is worthless
 *    here, since the sender has moved on to a different one.
 *  - RESOLUTION IS ASKED FOR, NOT ASSUMED. Unlike Android's code scanner (pinned at ~640×480 by
 *    vision-camera, see `presets.ts`), a browser lets us request 1080p, and more pixels per module
 *    is the single biggest lever on decode reliability. `ideal` rather than `exact` so a webcam
 *    that cannot do it still starts.
 *  - NO TAP-TO-FOCUS. `applyConstraints` focus control is not meaningfully supported across
 *    browsers; the native component's focus tap has no equivalent worth faking.
 *  - NO TORCH. Same reason: browser torch control is not portable. The component still accepts the
 *    native props and simply reports the torch as unavailable, so the screen hides its flash button
 *    without needing a `Platform.OS` check of its own.
 *
 * The permission flow deliberately mirrors the native one, including asking once automatically:
 * `getUserMedia` IS the browser's prompt, so there is nothing to request separately.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { Code, CodeScannerFrame } from 'react-native-vision-camera';

import { SmartCameraFrameOverlay } from '@/components/SmartCameraFrame';
import { Button } from '@/components/theme/Button';
import { handleError } from '@/utils/handleError';
import {
  createOpticalWebQrDecoder,
  type OpticalWebQrDecoder,
  type RgbaFrame,
} from '@/utils/optical/webQrDecode';

interface OpticalScannerCameraProps {
  active: boolean;
  /**
   * MUST be identity-stable (a `useCallback(…, [])` writing to refs) — it is called on every
   * decoded frame, and anything that triggers a React render per call starves the decode.
   */
  onCodeScanned: (codes: Code[], frame: CodeScannerFrame) => void;
  onError?: (error: Error) => void;
  /** Fires when the camera is actually producing frames — not when this component mounts. */
  onStarted?: () => void;
  /** Accepted for parity with native; a browser gives us no torch control, so it does nothing. */
  torchEnabled?: boolean;
  /** Always reports `false` here — see the torch note in the header. */
  onTorchAvailabilityChange?: (available: boolean) => void;
}

type ScannerStatus = 'blocked' | 'idle' | 'no-camera' | 'starting' | 'streaming';

/** Firefox has no `requestVideoFrameCallback`; 40 ms is well inside what a wasm decode sustains. */
const FALLBACK_FRAME_INTERVAL_MS = 40;

export function OpticalScannerCamera({
  active,
  onCodeScanned,
  onError,
  onStarted,
  onTorchAvailabilityChange,
}: OpticalScannerCameraProps) {
  const { t } = useTranslation();

  useEffect(() => {
    onTorchAvailabilityChange?.(false);
  }, [onTorchAvailabilityChange]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const decoderRef = useRef<null | OpticalWebQrDecoder>(null);
  const decodingRef = useRef(false);
  const runningRef = useRef(false);
  const frameHandleRef = useRef<null | number>(null);
  const timerRef = useRef<null | ReturnType<typeof setTimeout>>(null);

  // Held in refs so the frame pump never has to be rebuilt — see the identity note on the props.
  const onCodeScannedRef = useRef(onCodeScanned);
  const onStartedRef = useRef(onStarted);
  useEffect(() => {
    onCodeScannedRef.current = onCodeScanned;
    onStartedRef.current = onStarted;
  });

  const [status, setStatus] = useState<ScannerStatus>('idle');
  /** Bumped by the retry button; the camera effect keys off it so a refusal can be re-asked. */
  const [attempt, setAttempt] = useState(0);

  /** Copy the current video frame into a canvas and hand back its pixels. Wasm path only. */
  const readFrame = useCallback((): null | RgbaFrame => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      return null;
    }

    canvasRef.current ??= document.createElement('canvas');
    const canvas = canvasRef.current;
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // `willReadFrequently` moves the canvas to a software backing store: without it every
    // `getImageData` stalls on a GPU readback, which at frame rate is the dominant cost.
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return null;
    }

    context.drawImage(video, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    runningRef.current = true;
    // Captured now rather than read in the cleanup: the element is rendered unconditionally, and
    // the cleanup has to stop the tracks on the same one it started.
    const videoElement = videoRef.current;

    const scheduleNext = () => {
      if (!runningRef.current) {
        return;
      }

      // TypeScript's DOM lib declares rVFC as always present; Firefox disagrees, so the guard is
      // a runtime one.
      const video = videoRef.current;
      if (video && typeof video.requestVideoFrameCallback === 'function') {
        frameHandleRef.current = video.requestVideoFrameCallback(() => void pump());
      } else {
        timerRef.current = setTimeout(() => void pump(), FALLBACK_FRAME_INTERVAL_MS);
      }
    };

    const pump = async () => {
      const video = videoRef.current;
      const decoder = decoderRef.current;

      if (!runningRef.current || !video || !decoder || decodingRef.current) {
        scheduleNext();
        return;
      }

      decodingRef.current = true;
      try {
        const value = await decoder.decode(video, readFrame);
        // Reported on every attempt, not only on a hit: the receiver uses the frame size to warn
        // that the capture resolution is too low to decode this density, and a stream that never
        // decodes is exactly when that warning has to appear.
        onCodeScannedRef.current(value ? ([{ value }] as Code[]) : [], {
          height: video.videoHeight,
          width: video.videoWidth,
        } as CodeScannerFrame);
      } catch (error) {
        handleError(error, 'OpticalScannerCamera.decode');
      } finally {
        decodingRef.current = false;
      }

      scheduleNext();
    };

    const start = async () => {
      setStatus('starting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            height: { ideal: 1080 },
            width: { ideal: 1920 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }

        decoderRef.current = await createOpticalWebQrDecoder();
        if (cancelled) {
          return;
        }

        setStatus('streaming');
        onStartedRef.current?.();
        scheduleNext();
      } catch (error) {
        if (cancelled) {
          return;
        }

        // NotFoundError means there is no camera at all — a different dead end from a refusal, and
        // the only one where telling the user to grant permission would be misleading.
        const isMissing = error instanceof Error && error.name === 'NotFoundError';
        setStatus(isMissing ? 'no-camera' : 'blocked');
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    };

    void start();

    return () => {
      cancelled = true;
      runningRef.current = false;

      if (
        frameHandleRef.current !== null &&
        typeof videoElement?.cancelVideoFrameCallback === 'function'
      ) {
        videoElement.cancelVideoFrameCallback(frameHandleRef.current);
      }
      frameHandleRef.current = null;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Releasing the tracks is what turns the browser's recording indicator off. Leaving them
      // running after the transfer would be both a battery drain and a bad look.
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [active, attempt, onError, readFrame]);

  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  if (status === 'no-camera') {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-center text-sm text-text-secondary">
          {t('opticalTransfer.receive.noCamera')}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 overflow-hidden">
      <video
        muted
        playsInline
        ref={videoRef}
        style={{
          height: '100%',
          left: 0,
          objectFit: 'cover',
          position: 'absolute',
          top: 0,
          width: '100%',
        }}
      />

      {/* Aiming aid only — the decoder reads the whole video frame, not just what is inside the
          window. Suppressed while blocked, so the permission copy is not dimmed by the scrim. */}
      {status === 'blocked' ? null : <SmartCameraFrameOverlay variant="portrait" />}

      {status === 'blocked' ? (
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="text-center text-base font-bold text-text-primary">
            {t('opticalTransfer.receive.cameraPermissionTitle')}
          </Text>
          <Text className="text-center text-sm text-text-secondary">
            {/* No "open settings" here: a browser's camera permission lives in the page's own site
                settings, which no API can open for us. The copy tells the user where to look. */}
            {t('opticalTransfer.receive.cameraPermissionBrowser')}
          </Text>
          <Button
            label={t('opticalTransfer.retry')}
            onPress={retry}
            size="sm"
            style={{ alignSelf: 'center' }}
            variant="accent"
          />
        </View>
      ) : null}
    </View>
  );
}
