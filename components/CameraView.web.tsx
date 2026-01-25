import { PermissionResponse, useCameraPermissions as useExpoCameraPermissions } from 'expo-camera';
import { ReactNode, RefObject } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useZxing } from 'react-zxing';

type CameraViewProps = {
  [key: string]: any;
  children?: ReactNode;
  onBarcodeScanned?: (event: { data: string; type: string }) => void;
  style?: StyleProp<ViewStyle>;
};

/** Web-only camera that uses react-zxing under the hood */
const WebCameraView = ({ children, onBarcodeScanned, style, ...otherProps }: CameraViewProps) => {
  const { ref } = useZxing({
    constraints: {
      audio: false,
      video: { facingMode: 'environment' },
    },
    onDecodeResult: (result) => {
      onBarcodeScanned?.({
        data: result.getText(),
        type: result.getBarcodeFormat().toString(),
      });
    },
  });

  return (
    <View
      // make the camera view cover the whole viewport on web
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
};

export const CameraView = ({
  children,
  onBarcodeScanned,
  style,
  ...otherProps
}: CameraViewProps) => {
  return (
    <WebCameraView onBarcodeScanned={onBarcodeScanned} style={style} {...otherProps}>
      {children}
    </WebCameraView>
  );
};

export const useCameraPermissions = (): [
  null | PermissionResponse,
  () => Promise<PermissionResponse>,
] => {
  const [permission, requestPermission] = useExpoCameraPermissions();
  return [permission, requestPermission];
};
