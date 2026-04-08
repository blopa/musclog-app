import type { CameraView as CameraViewType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Image, Lightbulb, LightbulbOff, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraView, useCameraPermissions } from '@/components/CameraView';
import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';
import { detectBarcodes } from '@/utils/file';
import { showSnackbar } from '@/utils/snackbarService';

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
  const theme = useTheme();
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
      aspect: [4, 3],
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedAsset = result.assets[0];
      const barcode = await detectBarcodes(selectedAsset.uri);

      if (barcode) {
        onBarcodeScanned(barcode);
        onClose();
      } else {
        showSnackbar('error', t('food.aiCamera.noBarcodeDetected'));
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
        <View
          className="flex-1 items-center justify-center"
          style={{ padding: theme.spacing.padding['2xl'] }}
        >
          <Text
            className="mb-8 text-center text-text-primary"
            style={{
              marginBottom: theme.spacing.margin['2xl'],
              color: theme.colors.text.primary,
              textAlign: 'center',
            }}
          >
            {t('food.aiCamera.permissionRequired')}
          </Text>
          <Pressable
            onPress={requestPermission}
            style={{
              borderRadius: theme.borderRadius.xl,
              paddingHorizontal: theme.spacing.padding['2xl'],
              paddingVertical: theme.spacing.padding.lg,
              backgroundColor: theme.colors.accent.primary,
            }}
          >
            <Text
              style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.black,
              }}
            >
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
        <SystemBars style="light" />
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
          <View className="absolute inset-0">
            {/* Scanner Frame - Centered Higher */}
            <View className="absolute inset-0 items-center justify-center" style={{ top: '-10%' }}>
              <View className="relative h-64 w-80">
                {/* Corner Brackets */}
                <View
                  className="absolute -left-4 top-0 h-10 w-10 rounded-tl-xl"
                  style={{
                    borderLeftColor: theme.colors.status.emerald,
                    borderLeftWidth: theme.borderWidth.thick,
                    borderTopColor: theme.colors.status.emerald,
                    borderTopWidth: theme.borderWidth.thick,
                    borderTopLeftRadius: theme.borderRadius['2xl'],
                  }}
                />
                <View
                  className="absolute -right-4 top-0 h-10 w-10 rounded-tr-xl"
                  style={{
                    borderRightColor: theme.colors.status.emerald,
                    borderRightWidth: theme.borderWidth.thick,
                    borderTopColor: theme.colors.status.emerald,
                    borderTopWidth: theme.borderWidth.thick,
                    borderTopRightRadius: theme.borderRadius['2xl'],
                  }}
                />
                <View
                  className="absolute -left-4 bottom-0 h-10 w-10 rounded-bl-xl"
                  style={{
                    borderLeftColor: theme.colors.status.emerald,
                    borderLeftWidth: theme.borderWidth.thick,
                    borderBottomColor: theme.colors.status.emerald,
                    borderBottomWidth: theme.borderWidth.thick,
                    borderBottomLeftRadius: theme.borderRadius['2xl'],
                  }}
                />
                <View
                  className="absolute -right-4 bottom-0 h-10 w-10 rounded-br-xl"
                  style={{
                    borderRightColor: theme.colors.status.emerald,
                    borderRightWidth: theme.borderWidth.thick,
                    borderBottomColor: theme.colors.status.emerald,
                    borderBottomWidth: theme.borderWidth.thick,
                    borderBottomRightRadius: theme.borderRadius['2xl'],
                  }}
                />

                {/* Animated Scan Line */}
                <Animated.View
                  className="absolute left-0 right-0"
                  style={[
                    {
                      height: theme.borderWidth.thin,
                      backgroundColor: theme.colors.status.emerald,
                      shadowColor: theme.colors.accent.primary,
                      shadowOffset: theme.shadowOffset.zero,
                      shadowOpacity: theme.shadowOpacity.mediumHeavy,
                      shadowRadius: theme.shadowRadius.md,
                      elevation: theme.elevation.lg,
                    },
                    scanLineStyle,
                  ]}
                />

                {/* Scan Lines Pattern */}
                <View className="absolute inset-8 flex justify-between">
                  <View
                    style={{
                      height: theme.borderWidth.thin,
                      backgroundColor: theme.colors.background.white20,
                    }}
                  />
                  <View
                    style={{
                      height: theme.borderWidth.thin,
                      backgroundColor: theme.colors.background.white20,
                      width: '75%',
                    }}
                  />
                  <View
                    style={{
                      height: theme.borderWidth.thin,
                      backgroundColor: theme.colors.background.white20,
                    }}
                  />
                  <View
                    style={{
                      height: theme.borderWidth.thin,
                      backgroundColor: theme.colors.background.white20,
                      width: '50%',
                    }}
                  />
                  <View
                    style={{
                      height: theme.borderWidth.thin,
                      backgroundColor: theme.colors.background.white20,
                    }}
                  />
                </View>
              </View>
            </View>

            {/* Flashlight Button */}
            <View className="absolute right-6 top-16">
              <Pressable
                onPress={toggleTorch}
                className="h-12 w-12 items-center justify-center rounded-full backdrop-blur-md"
                style={{
                  backgroundColor: theme.colors.background.black40,
                  width: theme.size['12'],
                  height: theme.size['12'],
                  borderRadius: theme.borderRadius.full,
                }}
              >
                {torchEnabled ? (
                  <Lightbulb size={theme.iconSize.lg} color={theme.colors.text.white} />
                ) : (
                  <LightbulbOff size={theme.iconSize.lg} color={theme.colors.text.white} />
                )}
              </Pressable>
            </View>
          </View>

          {/* Bottom Controls - Fixed at bottom */}
          <View
            className="absolute bottom-0 left-0 right-0 px-6 pb-12 pt-8 backdrop-blur-xl"
            style={{
              borderTopColor: theme.colors.background.white10,
              borderTopWidth: theme.borderWidth.thin,
              backgroundColor: theme.colors.background.black80,
            }}
          >
            <View style={{ gap: theme.spacing.gap.md }}>
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
