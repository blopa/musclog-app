import {
  CameraView as ExpoCameraView,
  CameraViewProps as ExpoCameraViewProps,
  PermissionResponse,
  useCameraPermissions as useExpoCameraPermissions,
} from 'expo-camera';
import { forwardRef, ReactNode } from 'react';
import { Platform, StyleProp, ViewStyle } from 'react-native';

type CameraViewProps = Omit<ExpoCameraViewProps, 'style'> & {
  children?: ReactNode;
  onBarcodeScanned?: (_: { data: string; type: string }) => void;
  style?: StyleProp<ViewStyle>;
  active?: boolean;
};

/**
 * Wraps expo-camera's CameraView. The `active` prop is only supported on iOS by expo-camera.
 * When active is false on Android we unmount the native camera so the feed stops; when active
 * becomes true again we remount. This ensures the live feed pauses on all platforms.
 */
export const CameraView = forwardRef<ExpoCameraView, CameraViewProps>(
  ({ children, onBarcodeScanned, style, active = true, ...otherProps }, ref) => {
    // On Android, expo-camera ignores `active`; unmount the camera to stop the feed.
    const shouldRenderCamera = Platform.OS === 'android' ? active : true;

    if (!shouldRenderCamera) {
      return null;
    }

    return (
      <ExpoCameraView
        onBarcodeScanned={onBarcodeScanned}
        ref={ref}
        style={style as any}
        active={Platform.OS === 'ios' ? active : undefined}
        {...otherProps}
      >
        {children}
      </ExpoCameraView>
    );
  }
);

export const useCameraPermissions = (): [
  null | PermissionResponse,
  () => Promise<PermissionResponse>,
] => {
  const [permission, requestPermission] = useExpoCameraPermissions();
  return [permission, requestPermission];
};
