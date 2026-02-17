import type { CameraView as CameraViewType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import {
  FileText,
  Lightbulb,
  LightbulbOff,
  MessageSquareText,
  ScanBarcode,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Animated,
  Dimensions,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type MealType } from '../../database/models';
import { useTheme } from '../../hooks/useTheme';
import { detectBarcodes } from '../../utils/file';
import { CameraView, useCameraPermissions } from '../CameraView';
import { AddFoodModal } from './AddFoodModal';
import { AINutritionTrackingContextModal } from './AINutritionTrackingContextModal';
import CreateCustomFoodModal from './CreateCustomFoodModal';
import { FoodDetailsModal } from './FoodDetailsModal';
import { FullScreenModal } from './FullScreenModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CAMERA_MAX_HEIGHT = SCREEN_HEIGHT * 0.6;

type CameraMode = 'ai-meal-photo' | 'ai-label-scan' | 'barcode-scan';

type CameraModalProps = {
  visible: boolean;
  onClose: () => void;
  mode?: CameraMode;
  hideCameraModePicker?: boolean;
};

export default function SmartCameraModal({
  visible,
  onClose,
  mode = 'barcode-scan',
  hideCameraModePicker = false, // TODO: implement the usage of this
}: CameraModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>(mode || 'ai-meal-photo');
  const [isContextModalVisible, setIsContextModalVisible] = useState(false);
  const [isFoodDetailsModalVisible, setIsFoodDetailsModalVisible] = useState(false);
  const [isAddFoodModalVisible, setIsAddFoodModalVisible] = useState(false);
  const [isNewCustomFoodModalVisible, setIsNewCustomFoodModalVisible] = useState(false);
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const cameraRef = useRef<CameraViewType>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Update camera mode when mode prop changes
  useEffect(() => {
    if (mode) {
      setCameraMode(mode);
    }
  }, [mode]);

  // Show appropriate modal based on product details availability
  useEffect(() => {
    if (detectedBarcode) {
      setIsFoodDetailsModalVisible(true);
    } else {
      setIsFoodDetailsModalVisible(false);
    }
  }, [detectedBarcode]);

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

  const handleTakePicture = useCallback(async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      // TODO: LATER: Process the photo based on camera mode
      console.log('Photo taken:', photo);
    } catch (error) {
      console.error('Error taking picture:', error);
    }
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleFlashToggle = useCallback(() => {
    setFlashEnabled(!flashEnabled);
  }, [flashEnabled]);

  const handleModeChange = useCallback((mode: CameraMode) => {
    setCameraMode(mode);
  }, []);

  const handleApplyContext = useCallback((context: { description: string; tags: string[] }) => {
    // TODO: LATER: Apply context to AI processing
    console.log('Context applied:', context);
  }, []);

  const handleFoodDetailsClose = useCallback(() => {
    setIsFoodDetailsModalVisible(false);
    setDetectedBarcode(null);
  }, []);

  const handleFoodNotFoundClose = useCallback(() => {
    setIsFoodDetailsModalVisible(false);
    setDetectedBarcode(null);
  }, []);

  const handleTryAiScan = useCallback(() => {
    setCameraMode('ai-meal-photo');
  }, []);

  const handleSearchAgain = useCallback(() => {
    setCameraMode('barcode-scan');
  }, []);

  const handleCreateCustom = useCallback(() => {
    setIsAddFoodModalVisible(true);
  }, []);

  const handleAddFoodClose = useCallback(() => {
    setIsAddFoodModalVisible(false);
  }, []);

  const handleCreateCustomFood = useCallback(() => {
    setIsNewCustomFoodModalVisible(true);
  }, []);

  const handleNewCustomFoodClose = useCallback(() => {
    setIsNewCustomFoodModalVisible(false);
  }, []);

  const handleNewCustomFoodSave = useCallback((data: any) => {
    setIsNewCustomFoodModalVisible(false);
  }, []);

  const handleTrackCustomMeal = useCallback(() => {
    // TODO: Navigate to custom meal tracking
    console.log('Track custom meal');
  }, []);

  const handleMealTypeSelect = useCallback((mealType: MealType) => {
    // TODO: do something with this
    console.log('Selected meal type:', mealType);
  }, []);

  const handleAiCameraPress = useCallback(() => {
    setCameraMode('ai-meal-photo');
  }, []);

  const handleScanBarcodePress = useCallback(() => {
    setCameraMode('barcode-scan');
  }, []);

  const handleSearchFoodPress = useCallback(() => {
    // TODO: Navigate to food search
    console.log('Search food');
  }, []);

  const handleGalleryPress = useCallback(async () => {
    try {
      // Request media library permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        // TODO: use snackbar here instead
        Alert.alert(t('common.permissionRequired'), t('food.aiCamera.galleryPermissionRequired'), [
          { text: t('common.ok') },
        ]);

        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        console.log('Image selected from gallery:', selectedAsset.uri);

        if (cameraMode === 'barcode-scan') {
          const barcode = await detectBarcodes(selectedAsset.uri);
          if (barcode) {
            setDetectedBarcode(barcode);
          } else {
            // TODO: use snackbar here instead
            Alert.alert(t('common.noBarcode'), t('food.aiCamera.noBarcodeFound'), [
              { text: t('common.ok') },
            ]);
          }
        }
      }
    } catch (error) {
      console.error('Error picking image from gallery:', error);
      // TODO: use snackbar here instead
      Alert.alert(t('common.error'), t('food.aiCamera.galleryError'), [{ text: t('common.ok') }]);
    }
  }, [cameraMode, t]);

  if (!visible) {
    return null;
  }

  if (!permission) {
    return (
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('camera.title')}
        scrollable={false}
        showHeader={false}
      >
        <View
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: theme.colors.text.black }}
        >
          <Text style={{ color: theme.colors.text.white }}>
            {t('food.aiCamera.requestingPermission')}
          </Text>
        </View>
      </FullScreenModal>
    );
  }

  if (!permission.granted) {
    return (
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('camera.title')}
        scrollable={false}
        showHeader={false}
      >
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
      </FullScreenModal>
    );
  }

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('camera.title')}
      scrollable={false}
      showHeader={false}
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
              flash={flashEnabled ? 'on' : 'off'}
              active={visible}
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
                aspectRatio: theme.aspectRatio.portrait,
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
              {cameraMode === 'ai-meal-photo'
                ? t('food.aiCamera.mealInstruction')
                : cameraMode === 'ai-label-scan'
                  ? t('food.aiCamera.labelInstruction')
                  : t('food.aiCamera.barcodeInstruction')}
            </Text>
          </View>

          {/* Bottom Controls */}
          <View className="relative z-20 px-4 pb-10 pt-4">
            {/* Mode Selector */}
            {!hideCameraModePicker ? (
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
            ) : null}

            {/* Camera Controls */}
            <View className="flex-row items-center justify-between px-2">
              <Pressable
                className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg"
                style={{
                  backgroundColor: theme.colors.background.darkGray50,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: theme.colors.background.white10,
                }}
                onPress={handleGalleryPress}
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
                  opacity: hideCameraModePicker ? 0 : (
                    mode === 'barcode-scan' ? theme.colors.opacity.strong : 1
                  ),
                }}
                disabled={mode === 'barcode-scan'}
              >
                <MessageSquareText
                  size={theme.iconSize.lg}
                  color={
                    mode === 'barcode-scan' ? theme.colors.text.gray500 : theme.colors.text.primary
                  }
                />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>

        {/* Context Modal */}
        {isContextModalVisible ? (
          <AINutritionTrackingContextModal
            visible={isContextModalVisible}
            onClose={() => setIsContextModalVisible(false)}
            onApply={handleApplyContext}
          />
        ) : null}

        {/* Food Details Modal */}
        {isFoodDetailsModalVisible ? (
          <FoodDetailsModal
            visible={isFoodDetailsModalVisible}
            onClose={handleFoodDetailsClose}
            barcode={detectedBarcode}
          />
        ) : null}

        {/* Add Food Modal */}
        {isAddFoodModalVisible ? (
          <AddFoodModal
            visible={isAddFoodModalVisible}
            onClose={handleAddFoodClose}
            onMealTypeSelect={handleMealTypeSelect}
            onAiCameraPress={handleAiCameraPress}
            onScanBarcodePress={handleScanBarcodePress}
            onSearchFoodPress={handleSearchFoodPress}
            onCreateCustomFoodPress={handleCreateCustomFood}
            onTrackCustomMealPress={handleTrackCustomMeal}
          />
        ) : null}

        {/* New Custom Food Modal */}
        {isNewCustomFoodModalVisible ? (
          <CreateCustomFoodModal
            visible={isNewCustomFoodModalVisible}
            onClose={handleNewCustomFoodClose}
            onSave={handleNewCustomFoodSave}
          />
        ) : null}
      </View>
    </FullScreenModal>
  );
}
