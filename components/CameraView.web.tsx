import { PermissionResponse, useCameraPermissions as useExpoCameraPermissions } from 'expo-camera';
import { ReactNode, RefObject } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useZxing } from 'react-zxing';

type CameraViewProps = {
    [key: string]: any;
    children?: ReactNode;
    onBarcodeScanned?: (event: { data: string; type: string; }) => void;
    style?: StyleProp<ViewStyle>;
};

/** Web-only camera that uses react-zxing under the hood */
const WebCameraView = ({
    children,
    onBarcodeScanned,
    style,
    ...otherProps
}: CameraViewProps) => {
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
        <View style={[{ flex: 1 }, style]}>
            <video
                autoPlay
                muted
                playsInline
                ref={ref as RefObject<HTMLVideoElement>}
                style={{ height: '100%', width: '100%' }}
            />
            {children}
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
        <WebCameraView
            onBarcodeScanned={onBarcodeScanned}
            style={style}
            {...otherProps}
        >
            {children}
        </WebCameraView>
    );
};

export const useCameraPermissions = (): [
    null | PermissionResponse,
    () => Promise<PermissionResponse>
] => {
    const [permission, requestPermission] = useExpoCameraPermissions();
    return [permission, requestPermission];
};
