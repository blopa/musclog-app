import type { CameraView as CameraViewType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Image, Lightbulb, LightbulbOff, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Dimensions, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { theme } from '../../theme';
import { detectBarcodes } from '../../utils/file';
import { CameraView, useCameraPermissions } from '../CameraView';
import { FullScreenModal } from './FullScreenModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CAMERA_ASPECT_RATIO = theme.aspectRatio.portrait;
const CAMERA_MAX_HEIGHT = SCREEN_HEIGHT * 0.6;

type BarcodeCameraModalProps = {
  visible: boolean;
  onClose: () => void;
  onBarcodeScanned: (data: string) => void;
};

export function BarcodeCameraModal({
  visible,
  onClose,
  onBarcodeScanned,
}: BarcodeCameraModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const scanLineY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scanLineY.value = withRepeat(
        withTiming(256 - 4, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
  }, [visible, scanLineY]);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    onBarcodeScanned(data);
    onClose();
  };

  const handleGalleryUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      const barcodes = await detectBarcodes(result.assets[0].uri);
      if (barcodes && barcodes.length > 0) {
        onBarcodeScanned(barcodes[0]);
        onClose();
      }
    }
  };

  const toggleTorch = () => {
    setTorchEnabled(!torchEnabled);
  };

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title="Camera Permission Required"
        showHeader={false}
      >
        <View className="flex-1 items-center justify-center p-8">
          <Text className="mb-8 text-center text-text-primary">
            We need camera permission to scan barcodes. Please enable camera access in your device
            settings.
          </Text>
          <Pressable className="rounded-xl bg-accent-primary px-8 py-4" onPress={requestPermission}>
            <Text className="text-base font-semibold text-black">Grant Permission</Text>
          </Pressable>
        </View>
      </FullScreenModal>
    );
  }

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title=""
      showHeader={false}
      scrollable={false}
    >
      <View className="relative flex-1 bg-black">
        {/* Camera View - Full Screen */}
        <CameraView
          className="absolute inset-0"
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
          }}
          onBarcodeScanned={handleBarcodeScanned}
          flash={torchEnabled ? 'on' : 'off'}
        />

        {/* Scanner Overlay */}
        <View className="absolute inset-0 bg-black/40">
          {/* Header with instruction */}
          <View className="items-center px-6 pt-16">
            <View className="rounded-full border border-white/10 bg-black/40 px-4 py-2 backdrop-blur-md">
              <Text className="text-sm font-medium tracking-wide text-white">
                Align barcode within the frame to scan
              </Text>
            </View>
          </View>

          {/* Scanner Frame */}
          <View className="flex-1 items-center justify-center">
            <View className="relative h-64 w-64">
              {/* Corner Brackets */}
              <View className="absolute left-0 top-0 h-10 w-10 rounded-tl-xl border-l-4 border-t-4 border-emerald-400" />
              <View className="absolute right-0 top-0 h-10 w-10 rounded-tr-xl border-r-4 border-t-4 border-emerald-400" />
              <View className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-xl border-b-4 border-l-4 border-emerald-400" />
              <View className="absolute bottom-0 right-0 h-10 w-10 rounded-br-xl border-b-4 border-r-4 border-emerald-400" />

              {/* Animated Scan Line */}
              <Animated.View
                className="absolute left-0 right-0 h-0.5 bg-emerald-400"
                style={[
                  scanLineStyle,
                  {
                    shadowColor: theme.colors.accent.primary,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 15,
                    elevation: 5,
                  },
                ]}
              />

              {/* Scan Lines Pattern */}
              <View className="absolute inset-8 flex justify-between">
                <View className="h-0.5 w-full bg-white/20" />
                <View className="h-0.5 w-3/4 bg-white/20" />
                <View className="h-0.5 w-full bg-white/20" />
                <View className="h-0.5 w-1/2 bg-white/20" />
                <View className="h-0.5 w-full bg-white/20" />
              </View>
            </View>
          </View>

          {/* Flashlight Button */}
          <View className="absolute right-6 top-16">
            <Pressable
              onPress={toggleTorch}
              className="h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"
            >
              {torchEnabled ? (
                <Lightbulb size={24} color="white" />
              ) : (
                <LightbulbOff size={24} color="white" />
              )}
            </Pressable>
          </View>
        </View>

        {/* Bottom Controls - Fixed at bottom */}
        <View className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-black/60 backdrop-blur-xl px-6 pb-12 pt-8">
          <View className="gap-4">
            {/* Upload from Gallery Button */}
            <Pressable
              className="w-full flex-row items-center justify-center gap-3 rounded-xl border border-white/5 bg-white/5 py-4"
              onPress={handleGalleryUpload}
            >
              <Image size={theme.iconSize.lg} color={theme.colors.text.muted} />
              <Text className="text-base font-semibold text-white">Upload from Gallery</Text>
            </Pressable>

            {/* Close Scanner Button */}
            <Pressable
              className="h-14 w-full flex-row items-center justify-center gap-2 rounded-xl"
              style={{
                backgroundColor: theme.colors.status.emeraldLight,
                shadowColor: theme.colors.status.emeraldLight,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.2,
                shadowRadius: 25,
                elevation: 5,
              }}
              onPress={onClose}
            >
              <X size={theme.iconSize.lg} color="black" />
              <Text className="text-lg font-bold text-black">Close Scanner</Text>
            </Pressable>

            {/* Decorative Line */}
            <View className="mx-auto mt-4 h-1.5 w-32 rounded-full bg-white/20" />
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
