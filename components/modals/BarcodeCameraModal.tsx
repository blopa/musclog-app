import type { CameraView as CameraViewType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Image, Lightbulb, LightbulbOff, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../../theme';
import { detectBarcodes } from '../../utils/file';
import { Button } from '../theme/Button';
import { CameraView, useCameraPermissions } from '../CameraView';
import { FullScreenModal } from './FullScreenModal';

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
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const scanLineY = useSharedValue(0);
  const cameraRef = useRef<CameraViewType>(null);

  // Request camera permission on mount
  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

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
        title={t('camera.title')}
        showHeader={false}
      >
        <View className="flex-1 items-center justify-center p-8">
          <Text className="mb-8 text-center text-text-primary">
            {t('food.aiCamera.permissionRequired')}
          </Text>
          <Pressable className="rounded-xl bg-accent-primary px-8 py-4" onPress={requestPermission}>
            <Text className="text-base font-semibold text-black">
              {t('food.aiCamera.grantPermission')}
            </Text>
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
      <View className="flex-1" style={{ backgroundColor: theme.colors.text.black }}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView className="flex-1" edges={['top']}>
          {/* Camera Background */}
          <View className="absolute inset-0">
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
              }}
              onBarcodeScanned={handleBarcodeScanned}
              flash={torchEnabled ? 'on' : 'off'}
              active={visible}
            />
          </View>

          {/* Scanner Overlay */}
          <View className="absolute inset-0 bg-black/40">
            {/* Scanner Frame - Centered Higher */}
            <View className="absolute inset-0 items-center justify-center" style={{ top: '-10%' }}>
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
          <View className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-black/60 px-6 pb-12 pt-8 backdrop-blur-xl">
            <View className="gap-4">
              {/* Upload from Gallery Button */}
              <Button
                label={t('food.aiCamera.uploadFromGallery')}
                onPress={handleGalleryUpload}
                icon={Image}
                iconColor={theme.colors.text.muted}
                variant="secondary"
                width="full"
                size="md"
              />

              {/* Close Scanner Button */}
              <Button
                label={t('food.aiCamera.closeScanner')}
                onPress={onClose}
                icon={X}
                variant="outline"
                width="full"
                size="md"
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </FullScreenModal>
  );
}
