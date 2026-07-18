import { forwardRef, ReactNode, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import {
  Camera,
  type CameraPermissionStatus,
  type CodeType,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';

import { runCameraWarmUp } from '@/components/cameraWarmUp';

export type CameraViewRef = {
  takePictureAsync: (options?: { shutterSound?: boolean }) => Promise<{ uri: string }>;
};

export type PermissionResponse = {
  granted: boolean;
  status: CameraPermissionStatus;
  canAskAgain: boolean;
  expires: 'never';
};

/**
 * Maps the app's expo-camera-shaped barcode type strings (kept as the public prop shape so
 * call sites didn't need to change) to vision-camera's CodeType strings.
 */
const CODE_TYPE_MAP = {
  code39: 'code-39',
  code93: 'code-93',
  code128: 'code-128',
  ean8: 'ean-8',
  ean13: 'ean-13',
  qr: 'qr',
  upc_a: 'upc-a',
  upc_e: 'upc-e',
} as const satisfies Record<string, CodeType>;

export type BarcodeType = keyof typeof CODE_TYPE_MAP;

/**
 * Target still-photo size (~3MP, 4:3). Without a format vision-camera captures at the full
 * sensor resolution (12–108MP on modern phones), and that megapixel count — not shutter lag —
 * dominates the tap-to-crop-UI latency: the JPEG encode + file write inflate `takePhoto`, and
 * the crop Activity then pays a proportional bitmap decode before it can even render. Every
 * downstream consumer works on ≤3MP images anyway: barcode detection, label OCR, and AI vision
 * (which resizes inputs to ≤~2k px before inference).
 */
const PHOTO_RESOLUTION_TARGET = { width: 2048, height: 1536 };

type CameraViewProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  facing?: 'front' | 'back';
  active?: boolean;
  enableTorch?: boolean;
  onBarcodeScanned?: (event: { data: string; type: string }) => void;
  barcodeScannerSettings?: { barcodeTypes: BarcodeType[] };
};

/**
 * Wraps react-native-vision-camera's Camera behind the prop/ref shape the app previously used
 * for expo-camera, so SmartCameraModal/BarcodeCameraModal and useCameraCaptureFlow need minimal
 * changes. `photoQualityBalance="balanced"` maps to CameraX's Zero-Shutter-Lag capture mode on
 * Android out of the box — the native fast-capture path a prior version of this codebase had to
 * patch expo-camera's source to get (see git history: patches/expo-camera+57.0.3.patch).
 *
 * Session-lifecycle concerns live here, next to the session they belong to: the silent warm-up
 * capture (see runCameraWarmUp) and the one-capture-in-flight ordering it requires.
 */
export const CameraView = forwardRef<CameraViewRef, CameraViewProps>(
  (
    {
      children,
      style,
      facing = 'back',
      active = true,
      enableTorch = false,
      onBarcodeScanned,
      barcodeScannerSettings,
    },
    ref
  ) => {
    const device = useCameraDevice(facing);
    const format = useCameraFormat(device, [{ photoResolution: PHOTO_RESOLUTION_TARGET }]);
    const cameraRef = useRef<Camera>(null);
    const warmUpPromiseRef = useRef<Promise<void> | null>(null);

    const takePhoto = useCallback(async (options?: { shutterSound?: boolean }) => {
      if (!cameraRef.current) {
        throw new Error('Camera is not ready');
      }
      const photo = await cameraRef.current.takePhoto({
        enableShutterSound: options?.shutterSound ?? true,
      });
      const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
      return { uri };
    }, []);

    // Warm the session up once per mount, as soon as it reports ready. Callers deactivate the
    // camera by unmounting this component, so a remount — a new native session — re-arms the
    // warm-up naturally. onInitialized can re-fire when the session is reconfigured in place
    // (e.g. the code scanner toggling); ??= keeps that a no-op.
    const handleInitialized = useCallback(() => {
      warmUpPromiseRef.current ??= runCameraWarmUp(takePhoto);
    }, [takePhoto]);

    useImperativeHandle(
      ref,
      () => ({
        takePictureAsync: async (options) => {
          // The native session supports one capture in flight at a time; if the silent warm-up
          // is still resolving (a tap moments after mount), queue behind it.
          if (warmUpPromiseRef.current) {
            await warmUpPromiseRef.current;
          }
          return takePhoto(options);
        },
      }),
      [takePhoto]
    );

    const codeTypes = (barcodeScannerSettings?.barcodeTypes ?? []).map(
      (type) => CODE_TYPE_MAP[type]
    );

    const codeScanner = useCodeScanner({
      codeTypes,
      onCodeScanned: (codes) => {
        const code = codes[0];
        if (code?.value) {
          onBarcodeScanned?.({ data: code.value, type: code.type });
        }
      },
    });

    if (!device) {
      return null;
    }

    return (
      <View style={[StyleSheet.absoluteFill, style]}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          isActive={active}
          photo={true}
          torch={enableTorch ? 'on' : 'off'}
          photoQualityBalance="balanced"
          onInitialized={handleInitialized}
          codeScanner={onBarcodeScanned && codeTypes.length > 0 ? codeScanner : undefined}
        />
        {children}
      </View>
    );
  }
);

const buildPermissionResponse = (
  granted: boolean,
  status: CameraPermissionStatus
): PermissionResponse => ({
  granted,
  status,
  canAskAgain: status !== 'restricted',
  expires: 'never',
});

/**
 * expo-camera-shaped permission hook over vision-camera. The response object and request
 * function keep stable identities across re-renders — consumers use them as effect deps
 * (see SmartCameraContext) — and the response is rebuilt only when vision-camera's own
 * permission state changes (request resolution, app returning from system Settings). The
 * underlying native check is synchronous, so `permission` is never null on native; the null
 * side of the tuple type exists for the web implementation (utils/webCameraPermissions.ts).
 */
export const useCameraPermissions = (): [
  null | PermissionResponse,
  () => Promise<PermissionResponse>,
] => {
  const { hasPermission, requestPermission } = useCameraPermission();

  const permission = useMemo(
    () => buildPermissionResponse(hasPermission, Camera.getCameraPermissionStatus()),
    [hasPermission]
  );

  const request = useCallback(async (): Promise<PermissionResponse> => {
    const granted = await requestPermission();
    return buildPermissionResponse(granted, Camera.getCameraPermissionStatus());
  }, [requestPermission]);

  return [permission, request];
};
