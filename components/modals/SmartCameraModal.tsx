import type { CameraView as CameraViewType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { MessageSquareText, Search } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { CameraView } from '@/components/CameraView';
import ConfettiOverlay from '@/components/ConfettiOverlay';
import { ConfettiActivity } from '@/context/ConfettiInteractionsContext';
import { type MealType } from '@/database/models';
import { NutritionService } from '@/database/services';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useConfettiTrigger } from '@/hooks/useConfettiTrigger';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake';
import { useTheme } from '@/hooks/useTheme';
import AiService from '@/services/AiService';
import { recognizeText as ocrRecognizeText } from '@/services/OcrService';
import type { SearchResultProduct } from '@/types/openFoodFacts';
import {
  estimateNutritionFromPhoto,
  extractMacrosFromLabelPhoto,
  extractMacrosFromLabelText,
  type MacroEstimate,
  type TrackMealIngredient,
  type TrackMealResponse,
} from '@/utils/coachAI';
import {
  copyImageToDocumentDirectory,
  openCropperAsync,
  readFileAsStringAsync,
} from '@/utils/file';
import { handleError } from '@/utils/handleError';
import { showSnackbar } from '@/utils/snackbarService';
import { generateUUID } from '@/utils/uuid';

import { AddFoodModal } from './AddFoodModal';
import { AINutritionTrackingContextModal } from './AINutritionTrackingContextModal';
import { BarcodeTextSearchSheet } from './BarcodeTextSearchSheet';
import CreateCustomFoodModal from './CreateCustomFoodModal';
import { FoodMealTrackingDetailsModal } from './FoodMealTrackingDetailsModal';
import { FoodNotFoundModal } from './FoodNotFoundModal';
import { FoodSearchModal } from './FoodSearchModal';
import { LogMealModal } from './LogMealModal';
import { SmartCameraShell } from './SmartCameraShell';

export type CameraMode = 'ai-meal-photo' | 'ai-label-scan' | 'barcode-scan';

const getSafeCameraMode = (
  mode: CameraMode,
  isAiEnabled: boolean,
  isAIVisionEnabled: boolean
): CameraMode => {
  if (!isAiEnabled) {
    return 'barcode-scan';
  }

  if (!isAIVisionEnabled && mode === 'ai-meal-photo') {
    return 'ai-label-scan';
  }

  return mode || 'ai-meal-photo';
};

const getContextButtonOpacity = (
  hideCameraModePicker: boolean,
  cameraMode: CameraMode,
  strongOpacity: number
): number => {
  if (hideCameraModePicker) {
    return 0;
  }

  if (cameraMode === 'barcode-scan') {
    return strongOpacity;
  }

  return 1;
};

const getContextIconColor = (
  cameraMode: CameraMode,
  aiContext: { description: string; tags: string[] } | null,
  colors: { gray500: string; accent: string; primary: string }
): string => {
  if (cameraMode === 'barcode-scan') {
    return colors.gray500;
  }

  if (aiContext) {
    return colors.accent;
  }

  return colors.primary;
};

type CameraModalProps = {
  visible: boolean;
  onClose: () => void;
  mode?: CameraMode;
  hideCameraModePicker?: boolean;
  isAiEnabled?: boolean;
  /** When false, the meal-photo mode button is hidden and the mode falls back to ai-label-scan. */
  isAIVisionEnabled?: boolean;
  useOcrBeforeAi?: boolean;
  /** Shows a manual barcode search entry point while the camera is in barcode mode. */
  showBarcodeTextSearch?: boolean;
  logDate?: Date;
  mealTypeForLog?: MealType;
  /** Called when user wants to open food search. Parent should close camera and open food search to avoid nested modals. */
  onOpenFoodSearch?: (mealType: MealType) => void;
  /**
   * When provided, the camera operates in "return barcode" mode: any detected barcode (live, shutter,
   * or gallery) is forwarded to this callback and the modal closes — the internal food-details and
   * food-not-found flows are bypassed entirely. The parent owns what to do with the barcode value.
   */
  onBarcodeScanned?: (data: string) => void;
  /** Camera permission state managed by SmartCameraContext. null = still checking. */
  permissionGranted: boolean | null;
  /** Request camera permission — called when user taps "Grant Permission". */
  onRequestPermission: () => void;
};

export default function SmartCameraModal({
  visible,
  onClose,
  mode = 'barcode-scan',
  hideCameraModePicker = false,
  isAiEnabled = true,
  isAIVisionEnabled = true,
  useOcrBeforeAi = false,
  showBarcodeTextSearch = false,
  logDate,
  mealTypeForLog,
  onOpenFoodSearch,
  onBarcodeScanned,
  permissionGranted,
  onRequestPermission,
}: CameraModalProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { triggerConfetti, showConfetti } = useConfettiTrigger();
  const { formatRoundedDecimal } = useFormatAppNumber();
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>(
    getSafeCameraMode(mode, isAiEnabled, isAIVisionEnabled)
  );
  const [isContextModalVisible, setIsContextModalVisible] = useState(false);
  const [isBarcodeTextSearchModalVisible, setIsBarcodeTextSearchModalVisible] = useState(false);
  const [barcodeTextSearchValue, setBarcodeTextSearchValue] = useState('');
  const [isAddFoodModalVisible, setIsAddFoodModalVisible] = useState(false);
  const [isNewCustomFoodModalVisible, setIsNewCustomFoodModalVisible] = useState(false);

  const [aiContext, setAiContext] = useState<{ description: string; tags: string[] } | null>(null);
  const [draftContext, setDraftContext] = useState<{ description: string; tags: string[] }>({
    description: '',
    tags: [],
  });
  const [isFoodSearchModalVisible, setIsFoodSearchModalVisible] = useState(false);
  const [foodSearchInitialTab, setFoodSearchInitialTab] = useState<
    'all' | 'myFoods' | 'openfood' | 'usda' | 'meals'
  >('all');
  const [isLogMealModalVisible, setIsLogMealModalVisible] = useState(false);
  const [selectedMealForLogging, setSelectedMealForLogging] = useState<any>(null);
  const [aiIngredients, setAiIngredients] = useState<TrackMealIngredient[] | undefined>(undefined);
  const [aiPhotoUri, setAiPhotoUri] = useState<string | undefined>(undefined);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('lunch');
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  /** Synthetic product from AI label (OCR or vision) for FoodMealTrackingDetailsModal */
  const [productFromAiLabel, setProductFromAiLabel] = useState<SearchResultProduct | null>(null);

  const isBarcodeScanning = cameraMode === 'barcode-scan';
  const cameraRef = useRef<CameraViewType>(null);
  const shouldShowBarcodeTextSearch = showBarcodeTextSearch && cameraMode === 'barcode-scan';

  const barcode = useBarcodeScanner({ visible, onBarcodeScanned, onClose });
  const { isSearchingBarcodeRef } = barcode;

  const isFoodDetailsModalVisible = barcode.detectedBarcode !== null || productFromAiLabel !== null;

  // When any overlay modal is open or we're processing AI/OCR,
  // the camera must be inactive so the feed is not live behind the modal.
  const isCameraActive =
    visible &&
    !barcode.isSearchingBarcode &&
    !isProcessingAi &&
    !isBarcodeTextSearchModalVisible &&
    !barcode.isFoodNotFoundModalVisible &&
    !isFoodDetailsModalVisible;

  /** Map AI TrackMealResponse to the shape LogMealModal expects (calories from kcal). */
  const mapTrackMealResponseToMeal = useCallback(
    (result: TrackMealResponse) => {
      const allIngredients = result.meals.flatMap((m) => m.ingredients);
      if (allIngredients.length === 0) {
        return null;
      }

      const totalGrams = allIngredients.reduce((sum, ing) => sum + (ing.grams || 0), 0);
      const totalKcal = allIngredients.reduce((sum, ing) => sum + ing.kcal, 0);
      const totalProtein = allIngredients.reduce((sum, ing) => sum + ing.protein, 0);
      const totalCarbs = allIngredients.reduce((sum, ing) => sum + ing.carbs, 0);
      const totalFat = allIngredients.reduce((sum, ing) => sum + ing.fat, 0);
      const mealName =
        result.meals[0]?.mealName || result.meals[0]?.mealType || t('meals.customMeal');

      return {
        name: mealName,
        type: t('meals.customMeal'),
        calories: totalKcal,
        protein: totalProtein,
        carbs: totalCarbs,
        fat: totalFat,
        grams: totalGrams,
      };
    },
    [t]
  );

  /** Map AI label macro result to synthetic SearchResultProduct for FoodMealTrackingDetailsModal. */
  const macroEstimateToSearchResultProduct = useCallback(
    (result: MacroEstimate): SearchResultProduct => {
      const grams = result.grams ?? 100;
      const scale = 100 / grams;

      return {
        product_name: result.name,
        nutriments: {
          'energy-kcal_100g': result.kcal * scale,
          proteins_100g: result.protein * scale,
          carbohydrates_100g: result.carbs * scale,
          fat_100g: result.fat * scale,
        },
        serving_size: grams,
      } as unknown as SearchResultProduct;
    },
    []
  );

  // Update camera mode when mode prop changes
  useEffect(() => {
    if (mode) {
      const syncMode = () => {
        const safeMode = getSafeCameraMode(mode, isAiEnabled, isAIVisionEnabled);
        setCameraMode(safeMode);
      };
      syncMode();
    }
  }, [mode, isAiEnabled, isAIVisionEnabled]);

  useEffect(() => {
    if (!visible) {
      const reset = () => {
        setIsContextModalVisible(false);
        setIsBarcodeTextSearchModalVisible(false);
        setIsAddFoodModalVisible(false);
        setIsNewCustomFoodModalVisible(false);
        setIsFoodSearchModalVisible(false);
        setIsLogMealModalVisible(false);
        setProductFromAiLabel(null);
        isSearchingBarcodeRef.current = false;
      };
      reset();
    }
  }, [visible, isSearchingBarcodeRef]);

  useKeepScreenAwake(
    'smart-camera-processing',
    visible && (isProcessingAi || barcode.isSearchingBarcode)
  );

  const processAiPhoto = useCallback(
    async (fileUri: string) => {
      setIsProcessingAi(true);
      setAiPhotoUri(fileUri);
      try {
        if (cameraMode === 'ai-label-scan') {
          if (useOcrBeforeAi || !isAIVisionEnabled) {
            const ocrLanguage = i18n.resolvedLanguage ?? i18n.language;
            const { text } = await ocrRecognizeText(fileUri, ocrLanguage);
            if (!text.trim()) {
              showSnackbar('error', t('food.aiCamera.aiAnalysisFailed'));
              return;
            }

            const aiConfig = await AiService.getAiConfig();
            if (!aiConfig) {
              showSnackbar('error', t('food.aiCamera.aiNotConfigured'));
              return;
            }

            const result = await extractMacrosFromLabelText(aiConfig, text, aiContext ?? undefined);
            if (result) {
              showSnackbar(
                'success',
                t('food.aiCamera.analysisSuccess', {
                  name: result.name,
                  kcal: result.kcal,
                  protein: result.protein,
                  carbs: result.carbs,
                  fat: result.fat,
                })
              );
              setProductFromAiLabel(macroEstimateToSearchResultProduct(result));
            } else {
              showSnackbar('error', t('food.aiCamera.aiAnalysisFailed'));
            }
          } else {
            const base64 = await readFileAsStringAsync(fileUri, {
              encoding: 'base64',
            } as { encoding: 'base64' });

            const aiConfig = await AiService.getAiConfig();
            if (!aiConfig) {
              showSnackbar('error', t('food.aiCamera.aiNotConfigured'));
              return;
            }

            const result = await extractMacrosFromLabelPhoto(
              aiConfig,
              base64,
              aiContext ?? undefined
            );

            if (result) {
              showSnackbar(
                'success',
                t('food.aiCamera.analysisSuccess', {
                  name: result.name,
                  kcal: result.kcal,
                  protein: result.protein,
                  carbs: result.carbs,
                  fat: result.fat,
                })
              );
              setProductFromAiLabel(macroEstimateToSearchResultProduct(result));
            } else {
              showSnackbar('error', t('food.aiCamera.aiAnalysisFailed'));
            }
          }
        } else if (cameraMode === 'ai-meal-photo') {
          const base64 = await readFileAsStringAsync(fileUri, {
            encoding: 'base64',
          } as { encoding: 'base64' });
          const aiConfig = await AiService.getAiConfig();
          if (!aiConfig) {
            showSnackbar('error', t('food.aiCamera.aiNotConfigured'));
            return;
          }

          const result = await estimateNutritionFromPhoto(aiConfig, base64, aiContext ?? undefined);
          if (!result) {
            handleError(
              new Error('estimateNutritionFromPhoto errored'),
              'SmartCameraModal.estimateNutritionFromPhoto'
            );

            return;
          }

          if (result && result.meals.length > 0) {
            const allIngredients = result.meals.flatMap((m) => m.ingredients);
            if (allIngredients.length === 0) {
              showSnackbar('error', t('food.aiCamera.aiAnalysisFailed'));
              return;
            }

            const totalKcal = allIngredients.reduce((sum, ing) => sum + ing.kcal, 0);
            const totalProtein = allIngredients.reduce((sum, ing) => sum + ing.protein, 0);
            const totalCarbs = allIngredients.reduce((sum, ing) => sum + ing.carbs, 0);
            const totalFat = allIngredients.reduce((sum, ing) => sum + ing.fat, 0);
            const mealName =
              result.meals[0]?.mealName || result.meals[0]?.mealType || t('meals.customMeal');
            showSnackbar(
              'success',
              t('food.aiCamera.analysisSuccess', {
                name: mealName,
                kcal: formatRoundedDecimal(totalKcal, 2),
                protein: formatRoundedDecimal(totalProtein, 2),
                carbs: formatRoundedDecimal(totalCarbs, 2),
                fat: formatRoundedDecimal(totalFat, 2),
              })
            );

            const mealForLogging = mapTrackMealResponseToMeal(result);
            if (mealForLogging) {
              setSelectedMealForLogging(mealForLogging);
              setAiIngredients(allIngredients);
              setIsLogMealModalVisible(true);
            } else {
              showSnackbar('error', t('food.aiCamera.aiAnalysisFailed'));
            }
          } else {
            showSnackbar('error', t('food.aiCamera.aiAnalysisFailed'));
          }
        }
      } catch (error) {
        console.error('[SmartCamera] Error processing AI photo:', error);
        showSnackbar('error', t('food.aiCamera.aiAnalysisFailed'));
      } finally {
        setIsProcessingAi(false);
      }
    },
    [
      cameraMode,
      aiContext,
      formatRoundedDecimal,
      isAIVisionEnabled,
      i18n.language,
      i18n.resolvedLanguage,
      macroEstimateToSearchResultProduct,
      mapTrackMealResponseToMeal,
      t,
      useOcrBeforeAi,
    ]
  );

  const handleTakePicture = useCallback(async () => {
    if (!cameraRef.current) {
      return;
    }

    if (cameraMode === 'ai-label-scan' || cameraMode === 'ai-meal-photo') {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          base64: false,
        });

        const cropped = await openCropperAsync({
          imageUri: photo.uri,
          format: 'jpeg',
          compressImageQuality: 0.85,
        });
        await processAiPhoto(cropped.path);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('cancel') && !message.includes('Cancel')) {
          console.error('Error taking picture:', error);
          showSnackbar('error', t('food.aiCamera.cameraError'));
        }
      }
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      const cropped = await openCropperAsync({
        imageUri: photo.uri,
        format: 'jpeg',
        compressImageQuality: 0.8,
      });
      await barcode.processBarcodeImage(cropped.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('cancel') && !message.includes('Cancel')) {
        console.error('Error taking picture:', error);
        showSnackbar('error', t('food.aiCamera.cameraError'));
      }
    }
  }, [cameraMode, t, processAiPhoto, barcode]);

  const handleClose = useCallback(() => {
    isSearchingBarcodeRef.current = false;
    onClose();
  }, [isSearchingBarcodeRef, onClose]);

  const handleFlashToggle = useCallback(() => {
    setFlashEnabled((prev) => !prev);
  }, []);

  const handleModeChange = useCallback((newMode: CameraMode) => {
    setCameraMode(newMode);
  }, []);

  const handleApplyContext = useCallback((context: { description: string; tags: string[] }) => {
    setAiContext(context);
    setDraftContext(context);
  }, []);

  const handleFoodDetailsClose = useCallback(() => {
    barcode.handleFoodDetailsClose();
    setProductFromAiLabel(null);
  }, [barcode]);

  const handleAddFoodClose = useCallback(() => {
    setIsAddFoodModalVisible(false);
  }, []);

  const handleCreateCustomFood = useCallback(() => {
    // Close any sibling sub-modal before presenting the new one.
    // On iOS, presenting a modal while a sibling is still active causes the
    // new presentation to be silently dropped (UIViewController hierarchy bug).
    barcode.handleFoodNotFoundClose();
    setIsAddFoodModalVisible(false);
    setIsFoodSearchModalVisible(false);
    setIsNewCustomFoodModalVisible(true);
  }, [barcode]);

  const handleNewCustomFoodClose = useCallback(() => {
    setIsNewCustomFoodModalVisible(false);
  }, []);

  const handleTrackCustomMeal = useCallback(() => {
    setIsAddFoodModalVisible(false);
    setFoodSearchInitialTab('meals');
    setIsFoodSearchModalVisible(true);
  }, []);

  const handleMealTypeSelect = useCallback((mealType: MealType) => {
    setSelectedMealType(mealType);
    setIsAddFoodModalVisible(false);
  }, []);

  const handleAiCameraPress = useCallback(() => {
    setCameraMode('ai-meal-photo');
  }, []);

  const handleLogMeal = useCallback(
    async (date: Date, mealType: MealType, portionGrams: number) => {
      try {
        if (!selectedMealForLogging) {
          showSnackbar('error', t('food.aiCamera.mealLoggingFailed'));
          return;
        }

        const baseGrams = Math.max(selectedMealForLogging.grams ?? 100, 1);
        const scale = portionGrams / baseGrams;
        const isSingleFood = !aiIngredients || aiIngredients.length <= 1;
        const persistedImageUri =
          !selectedMealForLogging.foodId && aiPhotoUri
            ? await copyImageToDocumentDirectory(aiPhotoUri).catch(() => undefined)
            : undefined;

        await NutritionService.logCustomMeal(
          {
            name: selectedMealForLogging.name,
            calories: selectedMealForLogging.calories * scale,
            protein: selectedMealForLogging.protein * scale,
            carbs: selectedMealForLogging.carbs * scale,
            fat: selectedMealForLogging.fat * scale,
            foodId: selectedMealForLogging.foodId,
            imageUrl: persistedImageUri,
          },
          date,
          mealType,
          portionGrams,
          isSingleFood
            ? { loggedMealName: selectedMealForLogging.name }
            : { groupId: generateUUID(), loggedMealName: selectedMealForLogging.name }
        );

        showSnackbar('success', t('food.aiCamera.mealLoggedSuccess'));
        triggerConfetti(ConfettiActivity.FIRST_NUTRITION_LOG);
        setIsLogMealModalVisible(false);
        setSelectedMealForLogging(null);
        setAiIngredients(undefined);
        setAiPhotoUri(undefined);

        onClose();
      } catch (error) {
        console.error('Error logging meal:', error);
        handleError(error, 'SmartCameraModal.handleLogMeal');
        showSnackbar('error', t('food.aiCamera.mealLoggingFailed'));
      }
    },
    [selectedMealForLogging, aiIngredients, aiPhotoUri, t, triggerConfetti, onClose]
  );

  const handleScanBarcodePress = useCallback(() => {
    setCameraMode('barcode-scan');
  }, []);

  const handleSearchFoodPress = useCallback(() => {
    if (onOpenFoodSearch) {
      onOpenFoodSearch(selectedMealType);
    } else {
      setFoodSearchInitialTab('all');
      setIsFoodSearchModalVisible(true);
    }
  }, [onOpenFoodSearch, selectedMealType]);

  const handleGalleryPress = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showSnackbar('error', t('food.aiCamera.galleryPermissionRequired'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        if (cameraMode === 'barcode-scan') {
          try {
            const cropped = await openCropperAsync({
              imageUri: selectedAsset.uri,
              format: 'jpeg',
              compressImageQuality: 0.85,
            });
            await barcode.processBarcodeImage(cropped.path);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('cancel') && !message.includes('Cancel')) {
              console.error('Error cropping gallery image for barcode scan:', error);
              showSnackbar('error', t('food.aiCamera.cameraError'));
            }
          }
        } else if (cameraMode === 'ai-label-scan' || cameraMode === 'ai-meal-photo') {
          try {
            const cropped = await openCropperAsync({
              imageUri: selectedAsset.uri,
              format: 'jpeg',
              compressImageQuality: 0.85,
            });
            await processAiPhoto(cropped.path);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('cancel') && !message.includes('Cancel')) {
              console.error('Error cropping gallery image:', error);
              showSnackbar('error', t('food.aiCamera.cameraError'));
            }
          }
        }
      }
    } catch (error) {
      console.error('Error picking image from gallery:', error);
      showSnackbar('error', t('food.aiCamera.galleryError'));
    }
  }, [cameraMode, processAiPhoto, barcode, t]);

  const handleBarcodeTextSearchSubmit = useCallback(() => {
    const value = barcodeTextSearchValue.trim();
    setIsBarcodeTextSearchModalVisible(false);
    setBarcodeTextSearchValue('');
    barcode.handleBarcodeTextSearchSubmit(value);
  }, [barcode, barcodeTextSearchValue]);

  let bottomRightControl = <View className="h-12 w-12" />;

  if (shouldShowBarcodeTextSearch) {
    bottomRightControl = (
      <Pressable
        onPress={() => setIsBarcodeTextSearchModalVisible(true)}
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{
          backgroundColor: theme.colors.background.darkGray50,
          borderWidth: theme.borderWidth.thin,
          borderColor: theme.colors.background.white10,
        }}
      >
        <Search size={theme.iconSize.lg} color={theme.colors.text.primary} />
      </Pressable>
    );
  } else if (isAiEnabled && cameraMode !== 'barcode-scan') {
    bottomRightControl = (
      <Pressable
        onPress={() => setIsContextModalVisible(true)}
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{
          backgroundColor: theme.colors.background.darkGray50,
          borderWidth: theme.borderWidth.thin,
          borderColor: theme.colors.background.white10,
          opacity: getContextButtonOpacity(
            hideCameraModePicker,
            cameraMode,
            theme.colors.opacity.strong
          ),
        }}
      >
        <MessageSquareText
          size={theme.iconSize.lg}
          color={getContextIconColor(cameraMode, aiContext, {
            gray500: theme.colors.text.gray500,
            accent: theme.colors.text.accent,
            primary: theme.colors.text.primary,
          })}
        />
      </Pressable>
    );
  }

  if (!visible) {
    return null;
  }

  return (
    <>
      <SmartCameraShell
        visible={visible}
        onClose={handleClose}
        permissionGranted={permissionGranted}
        onRequestPermission={onRequestPermission}
        cameraSlot={
          isCameraActive ? (
            <CameraView
              key={`camera-${barcode.cameraResumeKey}`}
              ref={cameraRef}
              style={{ flex: 1 }}
              facing="back"
              enableTorch={flashEnabled}
              active={true}
              onBarcodeScanned={isBarcodeScanning ? barcode.handleLiveBarcodeScanned : undefined}
              barcodeScannerSettings={{
                barcodeTypes: [
                  'qr',
                  'ean13',
                  'ean8',
                  'upc_a',
                  'upc_e',
                  'code128',
                  'code39',
                  'code93',
                ],
              }}
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: theme.colors.background.darkGreenSolid }} />
          )
        }
        isLoading={barcode.isSearchingBarcode || isProcessingAi}
        cameraMode={cameraMode}
        flashEnabled={flashEnabled}
        onFlashToggle={handleFlashToggle}
        onGalleryPress={handleGalleryPress}
        onShutterPress={handleTakePicture}
        bottomRightControl={bottomRightControl}
        showModePicker={!hideCameraModePicker}
        isAiEnabled={isAiEnabled}
        isAIVisionEnabled={isAIVisionEnabled}
        onModeChange={handleModeChange}
      />

      {/* Context Modal */}
      {isContextModalVisible ? (
        <AINutritionTrackingContextModal
          visible={isContextModalVisible}
          onClose={() => setIsContextModalVisible(false)}
          onApply={handleApplyContext}
          initialDescription={draftContext.description}
          initialTags={draftContext.tags}
          onDraftChange={setDraftContext}
        />
      ) : null}

      {/* Barcode Text Search Sheet */}
      {isBarcodeTextSearchModalVisible ? (
        <BarcodeTextSearchSheet
          visible={isBarcodeTextSearchModalVisible}
          value={barcodeTextSearchValue}
          onChangeText={setBarcodeTextSearchValue}
          onClose={() => setIsBarcodeTextSearchModalVisible(false)}
          onSubmit={handleBarcodeTextSearchSubmit}
        />
      ) : null}

      {/* Food Details Modal */}
      {isFoodDetailsModalVisible ? (
        <FoodMealTrackingDetailsModal
          visible={isFoodDetailsModalVisible}
          onClose={handleFoodDetailsClose}
          barcode={productFromAiLabel ? null : barcode.detectedBarcode}
          productFromSearch={productFromAiLabel ?? undefined}
          onBarcodeLookupComplete={barcode.handleBarcodeLookupComplete}
          onFoodTracked={handleClose}
          isAiEnabled={isAiEnabled}
          canEdit={!!productFromAiLabel}
          initialDate={logDate}
          initialMealType={mealTypeForLog}
        />
      ) : null}

      {/* Food Not Found Modal */}
      {barcode.isFoodNotFoundModalVisible ? (
        <FoodNotFoundModal
          visible={barcode.isFoodNotFoundModalVisible}
          onClose={barcode.handleFoodNotFoundClose}
          onTryAiScan={handleAiCameraPress}
          onSearchAgain={handleScanBarcodePress}
          onCreateCustom={handleCreateCustomFood}
          isAiEnabled={isAiEnabled}
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
          trackFoodAfterSave={true}
          onClose={handleNewCustomFoodClose}
          isAiEnabled={isAiEnabled}
        />
      ) : null}

      {/* Food Search Modal */}
      {isFoodSearchModalVisible ? (
        <FoodSearchModal
          visible={isFoodSearchModalVisible}
          onClose={() => setIsFoodSearchModalVisible(false)}
          mealType={selectedMealType}
          initialTab={foodSearchInitialTab}
          onBarcodeScanPress={handleScanBarcodePress}
          onCreatePress={handleCreateCustomFood}
          isAiEnabled={isAiEnabled}
        />
      ) : null}

      {/* Log Meal Modal */}
      {isLogMealModalVisible && selectedMealForLogging ? (
        <LogMealModal
          visible={isLogMealModalVisible}
          onClose={() => {
            setIsLogMealModalVisible(false);
            setSelectedMealForLogging(null);
            setAiIngredients(undefined);
            setAiPhotoUri(undefined);
          }}
          meal={selectedMealForLogging}
          ingredients={aiIngredients}
          onLogMeal={handleLogMeal}
          initialDate={logDate}
        />
      ) : null}
      {showConfetti ? <ConfettiOverlay /> : null}
    </>
  );
}
