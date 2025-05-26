import { CameraView as ExpoCameraView, PermissionResponse, useCameraPermissions as useExpoCameraPermissions } from 'expo-camera';
import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

type CameraViewProps = {
    [key: string]: any;
    children?: ReactNode;
    onBarcodeScanned?: (event: { data: string; type: string; }) => void;
    style?: StyleProp<ViewStyle>;
};

export const CameraView = ({
    children,
    onBarcodeScanned,
    style,
    ...otherProps
}: CameraViewProps) => {
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
