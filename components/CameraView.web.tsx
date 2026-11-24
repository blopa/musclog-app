import { forwardRef, ReactNode, RefObject, useImperativeHandle } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useZxing } from 'react-zxing';

import { captureFrameFromVideo } from '@/utils/webCameraCapture';

export { useCameraPermissions } from '@/utils/webCameraPermissions';

/**
 * The browser only learns whether a camera exists once the page asks for one, so the web build
 * keeps every camera entry point and lets the camera screen explain a denial or a missing device.
 */
export function useHasCamera(): boolean {
  return true;
}

/** Same shape as the native wrapper's ref (`CameraView.tsx`), so the shared capture flow works. */
export type CameraViewRef = {
  takePictureAsync: () => Promise<{ uri: string }>;
};

type CameraViewProps = {
  [key: string]: any;
  children?: ReactNode;
  onBarcodeScanned?: (event: { data: string; type: string }) => void;
  style?: StyleProp<ViewStyle>;
  active?: boolean;
};

/** Web-only camera that uses react-zxing under the hood */
const WebCameraView = forwardRef<CameraViewRef, CameraViewProps>(function WebCameraView(
  { children, onBarcodeScanned, style },
  forwardedRef
) {
  const { ref } = useZxing({
    constraints: {
      audio: false,
      video: { facingMode: 'environment' },
    },
    onDecodeResult: (result) => {
      onBarcodeScanned?.({
        data: result.rawValue,
        type: result.format.toString(),
      });
    },
  });

  // The browser has no shutter: the shutter grabs the live preview frame instead. Without this
  // the ref stayed null and the shutter button silently did nothing on web.
  useImperativeHandle(
    forwardedRef,
    () => ({
      takePictureAsync: () => captureFrameFromVideo(ref.current as HTMLVideoElement | null),
    }),
    [ref]
  );

  return (
    <View
      // Absolute fill of the parent (e.g. SmartCameraModal / FullScreenModal shell), not the browser viewport
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          overflow: 'hidden',
          backgroundColor: 'black',
        },
        style,
      ]}
    >
      <video
        autoPlay
        muted
        playsInline
        ref={ref as RefObject<HTMLVideoElement>}
        // make the video fill the container and crop as needed
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          minWidth: '100%',
          minHeight: '100%',
          width: 'auto',
          height: 'auto',
          objectFit: 'cover',
          zIndex: 0,
        }}
      />

      {/* overlay children (controls/UI) above the video */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
        }}
      >
        {children}
      </View>
    </View>
  );
});

export const CameraView = forwardRef<CameraViewRef, CameraViewProps>(function CameraView(
  { children, onBarcodeScanned, style, active, ...otherProps },
  ref
) {
  if (!active) {
    return null;
  }

  return (
    <WebCameraView ref={ref} onBarcodeScanned={onBarcodeScanned} style={style} {...otherProps}>
      {children}
    </WebCameraView>
  );
});
