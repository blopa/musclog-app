import type { CameraView as CameraViewType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import type { TFunction } from 'i18next';
import {
  FileText,
  Images,
  Lightbulb,
  LightbulbOff,
  MessageSquareText,
  ScanBarcode,
  Search,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomPopUp } from '@/components/BottomPopUp';
import { CameraProcessingIndicator } from '@/components/CameraProcessingIndicator';
import { CameraView } from '@/components/CameraView';
import { type MealType } from '@/database/models';
import { NutritionService } from '@/database/services';
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
  detectBarcodes,
  openCropperAsync,
  readFileAsStringAsync,
} from '@/utils/file';
import { handleError } from '@/utils/handleError';
import { showSnackbar } from '@/utils/snackbarService';
import { generateUUID } from '@/utils/uuid';

import { AddFoodModal } from './AddFoodModal';
import { AINutritionTrackingContextModal } from './AINutritionTrackingContextModal';
import CreateCustomFoodModal from './CreateCustomFoodModal';
import { FoodMealTrackingDetailsModal } from './FoodMealTrackingDetailsModal';
import { FoodNotFoundModal } from './FoodNotFoundModal';
import { FoodSearchModal } from './FoodSearchModal';
import { FullScreenModal } from './FullScreenModal';
import { LogMealModal } from './LogMealModal';

const SMALL_SCREEN_HEIGHT = 700;

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

export type CameraMode = 'ai-meal-photo' | 'ai-label-scan' | 'barcode-scan';

const getCameraInstructionText = (cameraMode: CameraMode, t: TFunction): string => {
  switch (cameraMode) {
    case 'ai-meal-photo':
      return t('food.aiCamera.mealInstruction');
    case 'ai-label-scan':
      return t('food.aiCamera.labelInstruction');
    case 'barcode-scan':
      return t('food.aiCamera.barcodeAutoInstruction');
    default:
      return '';
  }
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

type BarcodeTextSearchSheetProps = {
  visible: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

function BarcodeTextSearchSheet({
  visible,
  value,
  onChangeText,
  onClose,
  onSubmit,
}: BarcodeTextSearchSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <BottomPopUp
      visible={visible}
      onClose={onClose}
      title={t('food.aiCamera.barcodeTextSearchTitle')}
      subtitle={t('food.aiCamera.barcodeTextSearchDescription')}
      maxHeight="55%"
      headerIcon={
        <View
          className="h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: theme.colors.background.darkGraySolid }}
        >
          <ScanBarcode size={theme.iconSize.xl} color={theme.colors.text.primary} />
        </View>
      }
    >
      <View className="pt-2">
        <Text className="mb-2 ml-1 text-xs font-bold uppercase tracking-widest text-text-secondary">
          {t('food.aiCamera.barcodeTextSearchLabel')}
        </Text>
        <View
          className="mb-6 w-full rounded-lg border px-4 py-3"
          style={{
            backgroundColor: theme.colors.background.darkGraySolid,
            borderColor: theme.colors.background.white10,
          }}
        >
          <RNTextInput
            className="w-full bg-transparent text-text-primary"
            style={{
              fontSize: theme.typography.fontSize.base,
              color: theme.colors.text.primary,
            }}
            placeholder={t('food.aiCamera.barcodeTextSearchPlaceholder')}
            placeholderTextColor={theme.colors.background.white20}
            value={value}
            onChangeText={onChangeText}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            returnKeyType="search"
            onSubmitEditing={onSubmit}
          />
        </View>

        <Pressable
          onPress={onSubmit}
          className="rounded-xl px-6 py-4 active:scale-[0.98]"
          style={{ overflow: 'hidden' }}
        >
          <LinearGradient
            colors={theme.colors.gradients.cta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View className="flex-row items-center justify-center gap-2">
            <Text className="text-sm font-bold text-white">
              {t('food.aiCamera.barcodeTextSearchSubmit')}
            </Text>
            <Search size={theme.iconSize.md} color={theme.colors.text.white} />
          </View>
        </Pressable>
      </View>
    </BottomPopUp>
  );
}

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
  const { formatRoundedDecimal } = useFormatAppNumber();
  const { height: screenHeight } = useWindowDimensions();
  const isSmallScreen = screenHeight < SMALL_SCREEN_HEIGHT;
  const cameraMaxHeight = screenHeight * (isSmallScreen ? 0.48 : 0.6);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>(
    getSafeCameraMode(mode, isAiEnabled, isAIVisionEnabled)
  );
  const [isContextModalVisible, setIsContextModalVisible] = useState(false);
  const [isBarcodeTextSearchModalVisible, setIsBarcodeTextSearchModalVisible] = useState(false);
  const [barcodeTextSearchValue, setBarcodeTextSearchValue] = useState('');
  const [isFoodDetailsModalVisible, setIsFoodDetailsModalVisible] = useState(false);
  const [isAddFoodModalVisible, setIsAddFoodModalVisible] = useState(false);
  const [isNewCustomFoodModalVisible, setIsNewCustomFoodModalVisible] = useState(false);
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);

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
  const [isSearchingBarcode, setIsSearchingBarcode] = useState(false);
  const isSearchingBarcodeRef = useRef(false);
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  const [isFoodNotFoundModalVisible, setIsFoodNotFoundModalVisible] = useState(false);
  /** Synthetic product from AI label (OCR or vision) for FoodMealTrackingDetailsModal */
  const [productFromAiLabel, setProductFromAiLabel] = useState<SearchResultProduct | null>(null);
  const isBarcodeScanning = cameraMode === 'barcode-scan';
  const cameraRef = useRef<CameraViewType>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [cameraResumeKey, setCameraResumeKey] = useState(0);
  const shouldShowBarcodeTextSearch = showBarcodeTextSearch && cameraMode === 'barcode-scan';

  // When any overlay modal is open (Food Not Found or Food Details) or we're processing AI/OCR,
  // the camera must be inactive so the feed is not live behind the modal.
  const isCameraActive =
    visible &&
    !isSearchingBarcode &&
    !isProcessingAi &&
    !isBarcodeTextSearchModalVisible &&
    !isFoodNotFoundModalVisible &&
    !isFoodDetailsModalVisible;

  /** Map AI TrackMealResponse to the shape LogMealModal expects (calories from kcal). */
  const mapTrackMealResponseToMeal = useCallback(
    (result: TrackMealResponse) => {
      // Flatten all ingredients from all meals
      const allIngredients = result.meals.flatMap((m) => m.ingredients);

      if (allIngredients.length === 0) {
        return null;
      }

      // Calculate aggregated macros
      const totalGrams = allIngredients.reduce((sum, ing) => sum + (ing.grams || 0), 0);
      const totalKcal = allIngredients.reduce((sum, ing) => sum + ing.kcal, 0);
      const totalProtein = allIngredients.reduce((sum, ing) => sum + ing.protein, 0);
      const totalCarbs = allIngredients.reduce((sum, ing) => sum + ing.carbs, 0);
      const totalFat = allIngredients.reduce((sum, ing) => sum + ing.fat, 0);

      // Use first meal's name or a generic name
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
      const safeMode = getSafeCameraMode(mode, isAiEnabled, isAIVisionEnabled);
      setCameraMode(safeMode);
    }
  }, [mode, isAiEnabled, isAIVisionEnabled]);

  // Show FoodMealTrackingDetailsModal when we have a barcode (lookup) or AI label result (synthetic product)
  useEffect(() => {
    if (detectedBarcode || productFromAiLabel) {
      setIsFoodDetailsModalVisible(true);
    } else {
      setIsFoodDetailsModalVisible(false);
    }
  }, [detectedBarcode, productFromAiLabel]);

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

  useKeepScreenAwake('smart-camera-processing', visible && (isProcessingAi || isSearchingBarcode));

  useEffect(() => {
    if (!visible) {
      setIsContextModalVisible(false);
      setIsBarcodeTextSearchModalVisible(false);
      setIsFoodDetailsModalVisible(false);
      setIsAddFoodModalVisible(false);
      setIsNewCustomFoodModalVisible(false);
      setIsFoodSearchModalVisible(false);
      setIsLogMealModalVisible(false);
      setIsFoodNotFoundModalVisible(false);
    }
  }, [visible]);

  // Handle automatic barcode detection
  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (cameraMode === 'barcode-scan' && !isSearchingBarcodeRef.current) {
        isSearchingBarcodeRef.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        if (onBarcodeScanned) {
          onBarcodeScanned(data);
          onClose();
          return;
        }

        setIsSearchingBarcode(true);
        setDetectedBarcode(data);
      }
    },
    [cameraMode, onBarcodeScanned, onClose]
  );

  const handleBarcodeTextSearchSubmit = useCallback(() => {
    const barcode = barcodeTextSearchValue.trim();

    if (!barcode) {
      showSnackbar('error', t('food.aiCamera.barcodeTextSearchRequired'));
      return;
    }

    isSearchingBarcodeRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsBarcodeTextSearchModalVisible(false);
    setBarcodeTextSearchValue('');

    if (onBarcodeScanned) {
      onBarcodeScanned(barcode);
      onClose();
      return;
    }

    setIsSearchingBarcode(true);
    setDetectedBarcode(barcode);
  }, [barcodeTextSearchValue, onBarcodeScanned, onClose, t]);

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
              setIsFoodDetailsModalVisible(true);
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
              setIsFoodDetailsModalVisible(true);
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
            // Flatten all ingredients from all meals
            const allIngredients = result.meals.flatMap((m) => m.ingredients);

            if (allIngredients.length === 0) {
              showSnackbar('error', t('food.aiCamera.aiAnalysisFailed'));
              return;
            }

            const totalKcal = allIngredients.reduce((sum, ing) => sum + ing.kcal, 0);
            const totalProtein = allIngredients.reduce((sum, ing) => sum + ing.protein, 0);
            const totalCarbs = allIngredients.reduce((sum, ing) => sum + ing.carbs, 0);
            const totalFat = allIngredients.reduce((sum, ing) => sum + ing.fat, 0);

            // Use first meal's name or a generic name
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

            // Map to LogMealModal format
            const mealForLogging = mapTrackMealResponseToMeal(result);
            if (mealForLogging) {
              setSelectedMealForLogging(mealForLogging);
              // Pass ingredients for the breakdown view
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

  const processBarcodeImage = useCallback(
    async (fileUri: string) => {
      setIsSearchingBarcode(true);

      try {
        const barcode = await detectBarcodes(fileUri);

        if (barcode) {
          if (onBarcodeScanned) {
            onBarcodeScanned(barcode);
            onClose();
            return;
          }

          setDetectedBarcode(barcode);
          setIsFoodDetailsModalVisible(true);
        } else {
          showSnackbar('error', t('food.aiCamera.noBarcodeFound'));
          isSearchingBarcodeRef.current = false;
          setIsSearchingBarcode(false);

          if (!onBarcodeScanned) {
            setIsFoodNotFoundModalVisible(true);
          }
        }
      } catch (error) {
        console.error('Error detecting barcode:', error);
        showSnackbar('error', t('food.aiCamera.cameraError'));
        isSearchingBarcodeRef.current = false;
        setIsSearchingBarcode(false);
      }
    },
    [t, onBarcodeScanned, onClose]
  );

  const handleTakePicture = useCallback(async () => {
    if (!cameraRef.current) {
      return;
    }

    // AI modes: take photo then open native crop UI
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
        // User cancelled crop or error occurred — silently ignore cancel
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('cancel') && !message.includes('Cancel')) {
          console.error('Error taking picture:', error);
          showSnackbar('error', t('food.aiCamera.cameraError'));
        }
      }
      return;
    }

    // Barcode scan mode
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

      await processBarcodeImage(cropped.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!message.includes('cancel') && !message.includes('Cancel')) {
        console.error('Error taking picture:', error);
        showSnackbar('error', t('food.aiCamera.cameraError'));
      }
    }
  }, [cameraMode, t, processAiPhoto, processBarcodeImage]);

  const handleClose = useCallback(() => {
    isSearchingBarcodeRef.current = false;
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
    setDraftContext(context);
  }, []);

  const handleFoodDetailsClose = useCallback(() => {
    setIsFoodDetailsModalVisible(false);
    setDetectedBarcode(null);
    setProductFromAiLabel(null);
    isSearchingBarcodeRef.current = false;
    setIsSearchingBarcode(false);
    setCameraResumeKey((k) => k + 1);
  }, []);

  const handleFoodNotFoundClose = useCallback(() => {
    setIsFoodDetailsModalVisible(false);
    setIsFoodNotFoundModalVisible(false);
    setDetectedBarcode(null);
    isSearchingBarcodeRef.current = false;
    setIsSearchingBarcode(false);
    setCameraResumeKey((k) => k + 1);
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

  const handleAddFoodClose = useCallback(() => {
    setIsAddFoodModalVisible(false);
  }, []);

  const handleCreateCustomFood = useCallback(() => {
    // Close any sibling sub-modal that may be open before presenting the new one.
    // On iOS, presenting a modal while a sibling modal is still active causes the
    // new presentation to be silently dropped (UIViewController hierarchy bug).
    setIsFoodNotFoundModalVisible(false);
    setIsAddFoodModalVisible(false);
    setIsFoodSearchModalVisible(false);
    setIsNewCustomFoodModalVisible(true);
  }, []);

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
        setIsLogMealModalVisible(false);
        setSelectedMealForLogging(null);
        setAiIngredients(undefined);
        setAiPhotoUri(undefined);
        // Close the camera modal after successful logging
        onClose();
      } catch (error) {
        console.error('Error logging meal:', error);
        handleError(error, 'SmartCameraModal.handleLogMeal');
        showSnackbar('error', t('food.aiCamera.mealLoggingFailed'));
      }
    },
    [selectedMealForLogging, aiIngredients, aiPhotoUri, t, onClose]
  );

  const handleScanBarcodePress = useCallback(() => {
    setCameraMode('barcode-scan');
  }, []);

  const handleSearchFoodPress = useCallback(() => {
    // If parent provided onOpenFoodSearch, use it to avoid nested modals
    if (onOpenFoodSearch) {
      onOpenFoodSearch(selectedMealType);
    } else {
      // Fallback to internal modal (for backward compatibility, though not recommended)
      setFoodSearchInitialTab('all');
      setIsFoodSearchModalVisible(true);
    }
  }, [onOpenFoodSearch, selectedMealType]);

  const handleGalleryPress = useCallback(async () => {
    try {
      // Request media library permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        showSnackbar('error', t('food.aiCamera.galleryPermissionRequired'));
        return;
      }

      // Launch image picker (no editing here — we open the cropper ourselves for AI modes)
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

            await processBarcodeImage(cropped.path);
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
  }, [cameraMode, processAiPhoto, processBarcodeImage, t]);

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
    isSearchingBarcodeRef.current = false;
    return null;
  }

  if (permissionGranted === null) {
    return (
      <FullScreenModal
        visible={visible}
        onClose={handleClose}
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

  if (!permissionGranted) {
    return (
      <FullScreenModal
        visible={visible}
        onClose={handleClose}
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
          <Pressable
            onPress={onRequestPermission}
            className="rounded-xl bg-accent-primary px-6 py-3"
          >
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
      onClose={handleClose}
      title={t('camera.title')}
      scrollable={false}
      showHeader={false}
    >
      <View className="flex-1" style={{ backgroundColor: theme.colors.text.black }}>
        <SystemBars style="light" />
        <SafeAreaView className="flex-1" edges={['top']}>
          {/* Camera Background — unmount camera when Food Not Found modal is open so feed stops */}
          <View className="absolute inset-0">
            {isCameraActive ? (
              <CameraView
                key={`camera-${cameraResumeKey}`}
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={flashEnabled}
                active={true}
                onBarcodeScanned={isBarcodeScanning ? handleBarcodeScanned : undefined}
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
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: theme.colors.background.darkGreenSolid },
                ]}
              />
            )}
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

          {/* Loading Overlay - barcode lookup */}
          {isSearchingBarcode || isProcessingAi ? (
            <View
              className="absolute inset-0 z-30"
              style={{ backgroundColor: theme.colors.overlay.black90 }}
            >
              <CameraProcessingIndicator cameraMode={cameraMode} />
            </View>
          ) : null}

          {/* Main Content - Camera Frame */}
          <View className="relative z-10 flex-1 items-center justify-center px-6">
            {/* Camera Frame Container */}
            <View
              className="relative w-full rounded-2xl"
              style={{
                aspectRatio: theme.aspectRatio.portrait,
                maxHeight: cameraMaxHeight,
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
              className="text-center text-sm font-medium drop-shadow-md"
              style={{ color: theme.colors.overlay.white90, marginTop: isSmallScreen ? 8 : 24 }}
            >
              {getCameraInstructionText(cameraMode, t)}
            </Text>
          </View>

          {/* Bottom Controls */}
          <View
            className="relative z-20 px-4 pt-4"
            style={{ paddingBottom: isSmallScreen ? 16 : 40 }}
          >
            {/* Mode Selector — only show when more than one mode is available */}
            {!hideCameraModePicker && isAiEnabled ? (
              <View
                className={isSmallScreen ? 'mb-3 w-full items-center' : 'mb-6 w-full items-center'}
              >
                <View
                  className="w-full max-w-sm flex-row items-stretch justify-between rounded-2xl p-1.5"
                  style={{
                    backgroundColor: theme.colors.background.darkGray90,
                    borderWidth: theme.borderWidth.thin,
                    borderColor: theme.colors.background.white10,
                  }}
                >
                  {/* Barcode Scan */}
                  <Pressable
                    onPress={() => handleModeChange('barcode-scan')}
                    className="flex-1 rounded-xl px-2"
                    style={[
                      { overflow: 'hidden', paddingVertical: isSmallScreen ? 8 : 10 },
                      cameraMode === 'barcode-scan' ? { backgroundColor: 'transparent' } : {},
                    ]}
                  >
                    {cameraMode === 'barcode-scan' ? (
                      <LinearGradient
                        colors={theme.colors.gradients.cta}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
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
                      {!isSmallScreen ? (
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
                      ) : null}
                    </View>
                  </Pressable>

                  {/* AI Label Scan — hidden when AI is disabled */}
                  {isAiEnabled ? (
                    <Pressable
                      onPress={() => handleModeChange('ai-label-scan')}
                      className="flex-1 rounded-xl px-2"
                      style={[
                        { overflow: 'hidden', paddingVertical: isSmallScreen ? 8 : 10 },
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
                        {!isSmallScreen ? (
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
                        ) : null}
                      </View>
                    </Pressable>
                  ) : null}

                  {/* AI Meal Photo — hidden when AI is disabled or provider doesn't support vision */}
                  {isAiEnabled && isAIVisionEnabled ? (
                    <Pressable
                      onPress={() => handleModeChange('ai-meal-photo')}
                      className="flex-1 rounded-xl px-2"
                      style={[
                        { overflow: 'hidden', paddingVertical: isSmallScreen ? 8 : 10 },
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
                        {!isSmallScreen ? (
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
                        ) : null}
                      </View>
                    </Pressable>
                  ) : null}
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
                <Images size={theme.iconSize.lg} color={theme.colors.text.primary} />
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

              {/* Barcode text search or AI context button */}
              {bottomRightControl}
            </View>
          </View>
        </SafeAreaView>

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

        {/* Barcode Text Search Modal */}
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
            barcode={productFromAiLabel ? null : detectedBarcode}
            productFromSearch={productFromAiLabel ?? undefined}
            onBarcodeLookupComplete={handleBarcodeLookupComplete}
            onFoodTracked={handleClose}
            isAiEnabled={isAiEnabled}
            canEdit={!!productFromAiLabel}
            initialDate={logDate}
            initialMealType={mealTypeForLog}
          />
        ) : null}

        {/* Food Not Found Modal */}
        {isFoodNotFoundModalVisible ? (
          <FoodNotFoundModal
            visible={isFoodNotFoundModalVisible}
            onClose={handleFoodNotFoundClose}
            onTryAiScan={handleTryAiScan}
            onSearchAgain={handleSearchAgain}
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
      </View>
    </FullScreenModal>
  );
}
