import {
    CameraView as ExpoCameraView,
    CameraViewProps as ExpoCameraViewProps,
    PermissionResponse,
    useCameraPermissions as useExpoCameraPermissions,
} from 'expo-camera';
import { forwardRef, ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

type CameraViewProps = Omit<ExpoCameraViewProps, 'style'> & {
    children?: ReactNode;
    onBarcodeScanned?: (_: { data: string; type: string }) => void;
    style?: StyleProp<ViewStyle>;
};

export const CameraView = forwardRef<ExpoCameraView, CameraViewProps>(({
    children,
    onBarcodeScanned,
    style,
    ...otherProps
}, ref) => {
    return (
        <ExpoCameraView
            onBarcodeScanned={onBarcodeScanned}
            ref={ref}
            style={style as any}
            {...otherProps}
        >
            {children}
        </ExpoCameraView>
    );
});

CameraView.displayName = 'CameraView';

export const useCameraPermissions = (): [
    null | PermissionResponse,
    () => Promise<PermissionResponse>
] => {
    const [permission, requestPermission] = useExpoCameraPermissions();
    return [permission, requestPermission];
};
