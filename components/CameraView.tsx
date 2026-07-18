import { forwardRef, ReactNode, useImperativeHandle, useRef } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import {
  Camera,
  type CameraPermissionStatus,
  type CodeType,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';

export type CameraViewRef = {
  takePictureAsync: (options?: { shutterSound?: boolean }) => Promise<{ uri: string }>;
};

export type PermissionResponse = {
  granted: boolean;
  status: CameraPermissionStatus;
  canAskAgain: boolean;
  expires: 'never';
};

type BarcodeScannerSettings = { barcodeTypes: string[] };

type CameraViewProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  facing?: 'front' | 'back';
  active?: boolean;
  enableTorch?: boolean;
  onCameraReady?: () => void;
  onBarcodeScanned?: (event: { data: string; type: string }) => void;
  barcodeScannerSettings?: BarcodeScannerSettings;
};

/**
 * Maps the app's expo-camera-shaped barcode type strings (kept as the public prop shape so
 * call sites didn't need to change) to vision-camera's CodeType strings.
 */
const CODE_TYPE_MAP: Record<string, CodeType> = {
  qr: 'qr',
  ean13: 'ean-13',
  ean8: 'ean-8',
  upc_a: 'upc-a',
  upc_e: 'upc-e',
  code128: 'code-128',
  code39: 'code-39',
  code93: 'code-93',
};

/**
 * Wraps react-native-vision-camera's Camera behind the prop/ref shape the app previously used
 * for expo-camera, so SmartCameraModal/BarcodeCameraModal and useCameraCaptureFlow need minimal
 * changes. `photoQualityBalance="balanced"` maps to CameraX's Zero-Shutter-Lag capture mode on
 * Android out of the box — the native fast-capture path a prior version of this codebase had to
 * patch expo-camera's source to get (see git history: patches/expo-camera+57.0.3.patch).
 */
export const CameraView = forwardRef<CameraViewRef, CameraViewProps>(
  (
    {
      children,
      style,
      facing = 'back',
      active = true,
      enableTorch = false,
      onCameraReady,
      onBarcodeScanned,
      barcodeScannerSettings,
    },
    ref
  ) => {
    const device = useCameraDevice(facing);
    const cameraRef = useRef<Camera>(null);

    useImperativeHandle(
      ref,
      () => ({
        takePictureAsync: async (options) => {
          if (!cameraRef.current) {
            throw new Error('Camera is not ready');
          }
          const photo = await cameraRef.current.takePhoto({
            enableShutterSound: options?.shutterSound ?? true,
          });
          const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
          return { uri };
        },
      }),
      []
    );

    const codeTypes = (barcodeScannerSettings?.barcodeTypes ?? [])
      .map((type) => CODE_TYPE_MAP[type])
      .filter((type): type is CodeType => type !== undefined);

    const codeScanner = useCodeScanner({
      codeTypes: codeTypes.length > 0 ? codeTypes : ['qr'],
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
          isActive={active}
          photo={true}
          torch={enableTorch ? 'on' : 'off'}
          photoQualityBalance="balanced"
          onInitialized={onCameraReady}
          codeScanner={onBarcodeScanned ? codeScanner : undefined}
        />
        {children}
      </View>
    );
  }
);

export const useCameraPermissions = (): [
  null | PermissionResponse,
  () => Promise<PermissionResponse>,
] => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const status = Camera.getCameraPermissionStatus();

  const permission: PermissionResponse = {
    granted: hasPermission,
    status,
    canAskAgain: status !== 'restricted',
    expires: 'never',
  };

  const request = async (): Promise<PermissionResponse> => {
    await requestPermission();
    const newStatus = Camera.getCameraPermissionStatus();
    return {
      granted: newStatus === 'granted',
      status: newStatus,
      canAskAgain: newStatus !== 'restricted',
      expires: 'never',
    };
  };

  return [permission, request];
};
