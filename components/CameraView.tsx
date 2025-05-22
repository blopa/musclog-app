import { CameraView as ExpoCameraView, PermissionResponse, useCameraPermissions as useExpoCameraPermissions } from 'expo-camera';
import { ReactNode } from 'react';
import { Platform } from 'react-native';

type CameraViewProps = {
    [key: string]: any;
    children?: ReactNode;
};

export const CameraView = ({ children, ...otherProps }: CameraViewProps) => {
    if (Platform.OS === 'web' && otherProps.onBarcodeScanned) {
        // TODO: Implement web camera view
        // for some reason, the web camera view from expo-camera is not
        // properly focusing the camera when the camera is opened
        // so we need to use a custom camera view for web that can properly focus
        // to be able to scan barcodes and then call the onBarcodeScanned prop
    }

    return (
        <ExpoCameraView
            {...otherProps}
        >
            {children}
        </ExpoCameraView>
    );
};

export const useCameraPermissions = (): [
    null | PermissionResponse,
    () => Promise<PermissionResponse>
] => {
    const [permission, requestPermission] = useExpoCameraPermissions();
    return [permission, requestPermission];
};