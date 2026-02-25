import type { CameraView as CameraViewType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import {
  FileText,
  Images,
  Lightbulb,
  LightbulbOff,
  MessageSquareText,
  ScanBarcode,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Dimensions, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type MealType } from '../../database/models';
import { useTheme } from '../../hooks/useTheme';
import { detectBarcodes } from '../../utils/file';
import { showSnackbar } from '../../utils/snackbarService';
import { CameraProcessingIndicator } from '../CameraProcessingIndicator';
import { CameraView, useCameraPermissions } from '../CameraView';
import { AddFoodModal } from './AddFoodModal';
import { AINutritionTrackingContextModal } from './AINutritionTrackingContextModal';
import CreateCustomFoodModal from './CreateCustomFoodModal';
import { FoodMealDetailsModal } from './FoodMealDetailsModal';
import { FoodSearchModal } from './FoodSearchModal';
import { FullScreenModal } from './FullScreenModal';
import { LogMealModal } from './LogMealModal';

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
  hideCameraModePicker = false,
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
  const [aiContext, setAiContext] = useState<{ description: string; tags: string[] } | null>(null);
  const [isFoodSearchModalVisible, setIsFoodSearchModalVisible] = useState(false);
  const [isLogMealModalVisible, setIsLogMealModalVisible] = useState(false);
  const [selectedMealForLogging, setSelectedMealForLogging] = useState<any>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('lunch');
  const [isSearchingBarcode, setIsSearchingBarcode] = useState(false);
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
    if (!cameraRef.current) {
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      // Process the photo based on camera mode
      if (cameraMode === 'barcode-scan') {
        // For barcode mode, try to detect barcodes in the image
        setIsSearchingBarcode(true);
        try {
          const barcode = await detectBarcodes(photo.uri);
          if (barcode) {
            setDetectedBarcode(barcode);
            setIsFoodDetailsModalVisible(true);
            // Keep loading visible until food details modal is shown (cleared in useEffect above)
          } else {
            showSnackbar('error', t('food.aiCamera.noBarcodeFound'));
            setIsSearchingBarcode(false);
          }
        } catch (error) {
          console.error('Error detecting barcode:', error);
          showSnackbar('error', t('food.aiCamera.cameraError'));
          setIsSearchingBarcode(false);
        }
      } else if (cameraMode === 'ai-meal-photo' || cameraMode === 'ai-label-scan') {
        // For AI modes, we would process the image with AI
        // For now, just show a placeholder message
        console.log('AI processing photo:', photo.uri);
        showSnackbar('success', t('food.aiCamera.photoCaptured'));

        // TODO: Implement actual AI processing here
        // This would involve sending the image to an AI service
        // and handling the response to show food/nutrition information
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      showSnackbar('error', t('food.aiCamera.cameraError'));
    }
  }, [cameraMode, t]);

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
    setAiContext(context);
    console.log('Context applied:', context);
  }, []);

  const handleFoodDetailsClose = useCallback(() => {
    setIsFoodDetailsModalVisible(false);
    setDetectedBarcode(null);
    setIsSearchingBarcode(false);
  }, []);

  const handleFoodNotFoundClose = useCallback(() => {
    setIsFoodDetailsModalVisible(false);
    setDetectedBarcode(null);
    setIsSearchingBarcode(false);
  }, []);

  const handleBarcodeLookupComplete = useCallback(() => {
    setIsSearchingBarcode(false);
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
    setIsLogMealModalVisible(true);
  }, []);

  const handleMealTypeSelect = useCallback((mealType: MealType) => {
    setSelectedMealType(mealType);
    setIsAddFoodModalVisible(false);
  }, []);

  const handleAiCameraPress = useCallback(() => {
    setCameraMode('ai-meal-photo');
  }, []);

  const handleScanBarcodePress = useCallback(() => {
    setCameraMode('barcode-scan');
  }, []);

  const handleSearchFoodPress = useCallback(() => {
    setIsFoodSearchModalVisible(true);
  }, []);

  const handleGalleryPress = useCallback(async () => {
    try {
      // Request media library permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        showSnackbar('error', t('food.aiCamera.galleryPermissionRequired'));
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
        if (cameraMode === 'barcode-scan') {
          setIsSearchingBarcode(true);
          try {
            const barcode = await detectBarcodes(selectedAsset.uri);
            if (barcode) {
              setDetectedBarcode(barcode);
              setIsFoodDetailsModalVisible(true);
              // Keep loading visible until food details modal is shown (cleared in useEffect above)
            } else {
              showSnackbar('error', t('food.aiCamera.noBarcodeFound'));
              setIsSearchingBarcode(false);
            }
          } catch (error) {
            console.error('Error detecting barcode from gallery:', error);
            showSnackbar('error', t('food.aiCamera.cameraError'));
            setIsSearchingBarcode(false);
          }
        }
      }
    } catch (error) {
      console.error('Error picking image from gallery:', error);
      showSnackbar('error', t('food.aiCamera.galleryError'));
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
              enableTorch={flashEnabled}
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

          {/* Loading Overlay */}
          {isSearchingBarcode ? (
            <View
              className="absolute inset-0 z-30"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
            >
              <CameraProcessingIndicator />
            </View>
          ) : null}

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
                    style={[
                      { overflow: 'hidden' },
                      cameraMode === 'ai-meal-photo' ? { backgroundColor: 'transparent' } : {},
                    ]}
                  >
                    {cameraMode === 'ai-meal-photo' ? (
                      <LinearGradient
                        colors={theme.colors.gradients.cta}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="absolute inset-0"
                        style={{
                          borderRadius: theme.borderRadius.md,
                          overflow: 'hidden',
                        }}
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
                    style={[
                      { overflow: 'hidden' },
                      cameraMode === 'ai-label-scan' ? { backgroundColor: 'transparent' } : {},
                    ]}
                  >
                    {cameraMode === 'ai-label-scan' ? (
                      <LinearGradient
                        colors={theme.colors.gradients.cta}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="absolute inset-0"
                        style={{
                          borderRadius: theme.borderRadius.md,
                          overflow: 'hidden',
                        }}
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
                    style={[
                      { overflow: 'hidden' },
                      cameraMode === 'barcode-scan' ? { backgroundColor: 'transparent' } : {},
                    ]}
                  >
                    {cameraMode === 'barcode-scan' ? (
                      <LinearGradient
                        colors={theme.colors.gradients.cta}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="absolute inset-0"
                        style={{
                          borderRadius: theme.borderRadius.md,
                          overflow: 'hidden',
                        }}
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
                className="h-12 w-12 items-center justify-center rounded-lg active:scale-95"
                style={{
                  backgroundColor: theme.colors.background.darkGray50,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: theme.colors.background.white20,
                }}
                onPress={handleGalleryPress}
              >
                <Images
                  size={theme.iconSize.lg}
                  color={theme.colors.text.primary}
                />
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
                  opacity: hideCameraModePicker
                    ? 0
                    : cameraMode === 'barcode-scan'
                      ? theme.colors.opacity.strong
                      : 1,
                }}
                disabled={cameraMode === 'barcode-scan'}
              >
                <MessageSquareText
                  size={theme.iconSize.lg}
                  color={
                    cameraMode === 'barcode-scan'
                      ? theme.colors.text.gray500
                      : theme.colors.text.primary
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
          <FoodMealDetailsModal
            visible={isFoodDetailsModalVisible}
            onClose={handleFoodDetailsClose}
            barcode={detectedBarcode}
            onBarcodeLookupComplete={handleBarcodeLookupComplete}
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

        {/* Food Search Modal */}
        {isFoodSearchModalVisible ? (
          <FoodSearchModal
            visible={isFoodSearchModalVisible}
            onClose={() => setIsFoodSearchModalVisible(false)}
            mealType={selectedMealType}
            onBarcodeScanPress={handleScanBarcodePress}
            onCreatePress={handleCreateCustomFood}
          />
        ) : null}

        {/* Log Meal Modal */}
        {isLogMealModalVisible && selectedMealForLogging ? (
          <LogMealModal
            visible={isLogMealModalVisible}
            onClose={() => {
              setIsLogMealModalVisible(false);
              setSelectedMealForLogging(null);
            }}
            meal={selectedMealForLogging}
            onLogMeal={(date, mealType) => {
              console.log('Logging meal:', selectedMealForLogging, 'on', date, 'as', mealType);
              setIsLogMealModalVisible(false);
              setSelectedMealForLogging(null);
            }}
          />
        ) : null}
      </View>
    </FullScreenModal>
  );
}
