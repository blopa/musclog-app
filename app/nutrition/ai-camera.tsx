import { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, StatusBar, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  LightbulbOff,
  Lightbulb,
  MessageSquareText,
  ScanBarcode,
  Sparkles,
  FileText,
} from 'lucide-react-native';
import { theme } from '../../theme';
import { AINutritionTrackingContextModal } from '../../components/modals/AINutritionTrackingContextModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CAMERA_ASPECT_RATIO = theme.aspectRatio.portrait;
const CAMERA_MAX_HEIGHT = SCREEN_HEIGHT * 0.6;

type CameraMode = 'ai-meal-photo' | 'ai-label-scan' | 'barcode-scan';

export default function AICameraScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('ai-meal-photo');
  const [isDetecting, setIsDetecting] = useState(true);
  const [isContextModalVisible, setIsContextModalVisible] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for AI detecting indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Request camera permission on mount
  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleTakePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      // TODO: Process the photo based on camera mode
      console.log('Photo taken:', photo);
    } catch (error) {
      console.error('Error taking picture:', error);
    }
  };

  const handleClose = () => {
    router.back();
  };

  const handleFlashToggle = () => {
    setFlashEnabled(!flashEnabled);
  };

  const handleModeChange = (mode: CameraMode) => {
    setCameraMode(mode);
  };

  const handleApplyContext = (context: { description: string; tags: string[] }) => {
    // TODO: Apply context to AI processing
    console.log('Context applied:', context);
  };

  if (!permission) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.colors.text.black }}
      >
        <Text style={{ color: theme.colors.text.white }}>
          {t('food.aiCamera.requestingPermission')}
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: theme.colors.text.black }}
      >
        <Text className="mb-4 text-center text-lg" style={{ color: theme.colors.text.white }}>
          {t('food.aiCamera.permissionRequired')}
        </Text>
        <Pressable onPress={requestPermission} className="rounded-xl bg-accent-primary px-6 py-3">
          <Text className="font-semibold" style={{ color: theme.colors.text.black }}>
            {t('food.aiCamera.grantPermission')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.text.black }}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Camera Background */}
        <View className="absolute inset-0">
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            flash={flashEnabled ? 'on' : 'off'}
          />
          {/* Gradient Overlay */}
          <LinearGradient
            colors={theme.colors.gradients.cameraOverlay}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Header */}
        <View className="relative z-20 flex-row items-center justify-between px-4 pb-2 pt-4">
          <Pressable
            onPress={handleClose}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: theme.colors.background.darkGray,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.background.white10,
            }}
          >
            <X size={theme.iconSize.lg} color={theme.colors.text.primary} />
          </Pressable>

          <Pressable
            onPress={handleFlashToggle}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: theme.colors.background.darkGray,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.background.white10,
            }}
          >
            {flashEnabled ? (
              <Lightbulb size={theme.iconSize.lg} color={theme.colors.text.primary} />
            ) : (
              <LightbulbOff size={theme.iconSize.lg} color={theme.colors.text.primary} />
            )}
          </Pressable>
        </View>

        {/* Main Content - Camera Frame */}
        <View className="relative z-10 flex-1 items-center justify-center px-6">
          {/* Camera Frame Container */}
          <View
            className="relative w-full rounded-2xl"
            style={{
              aspectRatio: CAMERA_ASPECT_RATIO,
              maxHeight: CAMERA_MAX_HEIGHT,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.background.white20,
              overflow: 'visible',
            }}
          >
            {/* Corner Markers */}
            <View
              className="absolute -left-1 -top-1 h-8 w-8 rounded-tl-lg border-l-2 border-t-2"
              style={{ borderColor: theme.colors.accent.primary }}
            />
            <View
              className="absolute -right-1 -top-1 h-8 w-8 rounded-tr-lg border-r-2 border-t-2"
              style={{ borderColor: theme.colors.accent.primary }}
            />
            <View
              className="absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-lg border-b-2 border-l-2"
              style={{ borderColor: theme.colors.accent.primary }}
            />
            <View
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-br-lg border-b-2 border-r-2"
              style={{ borderColor: theme.colors.accent.primary }}
            />

            {/* Center Line */}
            <View
              className="absolute left-0 right-0"
              style={{
                top: '50%',
                height: theme.borderWidth.thin,
                backgroundColor: theme.colors.accent.primary40,
              }}
            />
          </View>

          {/* Instruction Text */}
          <Text
            className="mt-6 text-center text-sm font-medium drop-shadow-md"
            style={{ color: theme.colors.overlay.white90 }}
          >
            {/* TODO: change this text depending on the camera mode */}
            {t('food.aiCamera.mealInstruction')}
          </Text>
        </View>

        {/* Bottom Controls */}
        <View className="relative z-20 px-4 pb-10 pt-4">
          {/* Mode Selector */}
          <View className="mb-6 w-full items-center">
            <View
              className="w-full max-w-sm flex-row items-stretch justify-between rounded-2xl p-1.5"
              style={{
                backgroundColor: theme.colors.background.darkGray90,
                borderWidth: theme.borderWidth.thin,
                borderColor: theme.colors.background.white10,
              }}
            >
              {/* AI Meal Photo */}
              <Pressable
                onPress={() => handleModeChange('ai-meal-photo')}
                className="flex-1 rounded-xl px-2 py-2.5"
                style={
                  cameraMode === 'ai-meal-photo'
                    ? {
                        backgroundColor: 'transparent',
                      }
                    : {}
                }
              >
                {cameraMode === 'ai-meal-photo' ? (
                  <LinearGradient
                    colors={theme.colors.gradients.cta}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="absolute inset-0 rounded-xl"
                  />
                ) : null}
                <View className="flex-row items-center justify-center gap-1.5">
                  <Sparkles
                    size={theme.iconSize.md}
                    color={
                      cameraMode === 'ai-meal-photo'
                        ? theme.colors.text.white
                        : theme.colors.text.secondary
                    }
                  />
                  <Text
                    className="font-bold uppercase tracking-wide"
                    style={{
                      fontSize: theme.typography.fontSize.xs,
                      color:
                        cameraMode === 'ai-meal-photo'
                          ? theme.colors.text.white
                          : theme.colors.text.secondary,
                    }}
                  >
                    {t('food.aiCamera.modes.mealPhoto')}
                  </Text>
                </View>
              </Pressable>

              {/* AI Label Scan */}
              <Pressable
                onPress={() => handleModeChange('ai-label-scan')}
                className="flex-1 rounded-xl px-2 py-2.5"
                style={
                  cameraMode === 'ai-label-scan'
                    ? {
                        backgroundColor: 'transparent',
                      }
                    : {}
                }
              >
                {cameraMode === 'ai-label-scan' ? (
                  <LinearGradient
                    colors={theme.colors.gradients.cta}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="absolute inset-0 rounded-xl"
                  />
                ) : null}
                <View className="flex-row items-center justify-center gap-1.5">
                  <FileText
                    size={theme.iconSize.md}
                    color={
                      cameraMode === 'ai-label-scan'
                        ? theme.colors.text.white
                        : theme.colors.text.secondary
                    }
                  />
                  <Text
                    className="font-bold uppercase tracking-wide"
                    style={{
                      fontSize: theme.typography.fontSize.xs,
                      color:
                        cameraMode === 'ai-label-scan'
                          ? theme.colors.text.white
                          : theme.colors.text.secondary,
                    }}
                  >
                    {t('food.aiCamera.modes.labelScan')}
                  </Text>
                </View>
              </Pressable>

              {/* Barcode Scan */}
              <Pressable
                onPress={() => handleModeChange('barcode-scan')}
                className="flex-1 rounded-xl px-2 py-2.5"
                style={
                  cameraMode === 'barcode-scan'
                    ? {
                        backgroundColor: 'transparent',
                      }
                    : {}
                }
              >
                {cameraMode === 'barcode-scan' ? (
                  <LinearGradient
                    colors={theme.colors.gradients.cta}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="absolute inset-0 rounded-xl"
                  />
                ) : null}
                <View className="flex-row items-center justify-center gap-1.5">
                  <ScanBarcode
                    size={theme.iconSize.md}
                    color={
                      cameraMode === 'barcode-scan'
                        ? theme.colors.text.white
                        : theme.colors.text.secondary
                    }
                  />
                  <Text
                    className="font-bold uppercase tracking-wide"
                    style={{
                      fontSize: theme.typography.fontSize.xs,
                      color:
                        cameraMode === 'barcode-scan'
                          ? theme.colors.text.white
                          : theme.colors.text.secondary,
                    }}
                  >
                    {t('food.aiCamera.modes.barcodeScan')}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* Camera Controls */}
          <View className="flex-row items-center justify-between px-2">
            {/* Gallery Thumbnail */}
            <Pressable
              className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg"
              style={{
                backgroundColor: theme.colors.background.darkGray50,
                borderWidth: theme.borderWidth.thin,
                borderColor: theme.colors.background.white10,
              }}
            >
              <View className="h-full w-full p-1">
                <View
                  className="h-full w-full rounded"
                  style={{
                    backgroundColor: theme.colors.background.white10,
                    opacity: theme.colors.opacity.strong,
                  }}
                />
              </View>
            </Pressable>

            {/* Shutter Button */}
            <Pressable
              onPress={handleTakePicture}
              className="h-20 w-20 items-center justify-center rounded-full active:scale-95"
              style={{
                borderWidth: theme.borderWidth.thick,
                borderColor: theme.colors.text.white,
              }}
            >
              <View
                className="absolute inset-0 rounded-full"
                style={{
                  borderWidth: theme.borderWidth.thin,
                  borderColor: theme.colors.background.black20,
                }}
              />
              <View
                className="h-16 w-16 rounded-full bg-white"
                style={{ backgroundColor: theme.colors.text.white }}
              />
            </Pressable>

            {/* Context Button */}
            <Pressable
              onPress={() => setIsContextModalVisible(true)}
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{
                backgroundColor: theme.colors.background.darkGray50,
                borderWidth: theme.borderWidth.thin,
                borderColor: theme.colors.background.white10,
              }}
            >
              <MessageSquareText size={theme.iconSize.lg} color={theme.colors.text.primary} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* Context Modal */}
      <AINutritionTrackingContextModal
        visible={isContextModalVisible}
        onClose={() => setIsContextModalVisible(false)}
        onApply={handleApplyContext}
      />
    </View>
  );
}
