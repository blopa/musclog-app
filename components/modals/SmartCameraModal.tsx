import { MessageSquareText } from 'lucide-react-native';
import { type ComponentProps, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { MealDraftButton } from '@/components/camera/MealDraftButton';
import { MealPhotoDetailsModal } from '@/components/camera/MealPhotoDetailsModal';
import { useCameraAiProcessing } from '@/components/camera/useCameraAiProcessing';
import { useMealPhotoEstimate } from '@/components/camera/useMealPhotoEstimate';
import { CameraView, type CameraViewRef } from '@/components/CameraView';
import ConfettiOverlay from '@/components/ConfettiOverlay';
import {
  SmartCameraPlaceholder,
  SmartCameraRoundButton,
  SmartCameraTextSearchButton,
} from '@/components/SmartCameraActions';
import type { CameraMode } from '@/constants/camera';
import { ConfettiActivity } from '@/context/ConfettiInteractionsContext';
import { type MealType } from '@/database/models';
import { NutritionService } from '@/database/services/NutritionService';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import {
  AI_PHOTO_QUALITY,
  BARCODE_PHOTO_QUALITY,
  useCameraCaptureFlow,
} from '@/hooks/useCameraCaptureFlow';
import { useConfettiTrigger } from '@/hooks/useConfettiTrigger';
import { useEnergyUnit } from '@/hooks/useEnergyUnit';
import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake';
import { useMealPhotoLimit } from '@/hooks/useMealPhotoLimit';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { recognizeText as ocrRecognizeText } from '@/services/OcrService';
import { logTrackedMeal } from '@/services/trackedMealLogging';
import type { SearchResultProduct } from '@/types/openFoodFacts';
import {
  extractMacrosFromLabelPhoto,
  extractMacrosFromLabelText,
  type MacroEstimate,
  type TrackMealIngredient,
} from '@/utils/coachAI';
import { copyImageToDocumentDirectory, readFileAsStringAsync } from '@/utils/file';
import { handleError } from '@/utils/handleError';
import type { MealEstimateProgressLine } from '@/utils/mealEstimateProgress';
import { mealPhotoContextFromDraft } from '@/utils/mealPhotoContext';
import {
  EMPTY_MEAL_PHOTO_DRAFT,
  mealCameraControls,
  mealPhotoDraftReducer,
} from '@/utils/mealPhotoDraft';
import { showSnackbar } from '@/utils/snackbarService';

import { AddFoodModal } from './AddFoodModal';
import { AINutritionTrackingContextModal } from './AINutritionTrackingContextModal';
import { BarcodeTextSearchSheet } from './BarcodeTextSearchSheet';
import CreateCustomFoodModal from './CreateCustomFoodModal';
import { FoodMealTrackingDetailsModal } from './FoodMealTrackingDetailsModal';
import { FoodNotFoundModal } from './FoodNotFoundModal';
import { FoodSearchModal } from './FoodSearchModal';
import { type LogMealData, LogMealModal } from './LogMealModal';
import { SmartCameraShell } from './SmartCameraShell';
import { useOpticalStreamOffer } from './useOpticalStreamOffer';

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
  colors: { tertiary: string; accent: string; primary: string }
): string => {
  if (cameraMode === 'barcode-scan') {
    return colors.tertiary;
  }

  if (aiContext) {
    return colors.accent;
  }

  return colors.primary;
};

type BottomRightControlProps = {
  aiContext: { description: string; tags: string[] } | null;
  cameraMode: CameraMode;
  hideCameraModePicker: boolean;
  isAiEnabled: boolean;
  onContextPress: () => void;
  onTextSearchPress: () => void;
  showTextSearch: boolean;
  /** The detailed meal flow: the slot reopens the photo sheet instead of the pre-photo context. */
  mealDraft?: { firstPhotoUri: string; count: number; label: string; onPress: () => void } | null;
  detailedMealFlow?: boolean;
};

/**
 * The slot to the right of the shutter. A component rather than a value built in
 * the modal body, so its `useTheme()` resolves where it is rendered.
 */
function BottomRightControl({
  aiContext,
  cameraMode,
  hideCameraModePicker,
  isAiEnabled,
  onContextPress,
  onTextSearchPress,
  showTextSearch,
  mealDraft,
  detailedMealFlow,
}: BottomRightControlProps) {
  const theme = useTheme();

  if (showTextSearch) {
    return <SmartCameraTextSearchButton onPress={onTextSearchPress} />;
  }

  if (isAiEnabled && cameraMode === 'ai-meal-photo' && detailedMealFlow) {
    return mealDraft ? (
      <MealDraftButton
        uri={mealDraft.firstPhotoUri}
        count={mealDraft.count}
        accessibilityLabel={mealDraft.label}
        onPress={mealDraft.onPress}
      />
    ) : (
      <View className="h-12 w-12" />
    );
  }

  if (isAiEnabled && cameraMode !== 'barcode-scan') {
    return (
      <SmartCameraRoundButton
        size="md"
        onPress={onContextPress}
        opacity={getContextButtonOpacity(
          hideCameraModePicker,
          cameraMode,
          theme.colors.opacity.strong
        )}
      >
        <MessageSquareText
          size={theme.iconSize.lg}
          color={getContextIconColor(cameraMode, aiContext, {
            tertiary: theme.colors.text.tertiary,
            accent: theme.colors.text.accent,
            primary: theme.colors.text.primary,
          })}
        />
      </SmartCameraRoundButton>
    );
  }

  return <View className="h-12 w-12" />;
}

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
  const { t, i18n } = useTranslation();
  const { triggerConfetti, showConfetti } = useConfettiTrigger();
  const { formatEnergyWithUnit } = useEnergyUnit();
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>(
    getSafeCameraMode(mode, isAiEnabled, isAIVisionEnabled)
  );
  const { aiMealCameraFlow, aiProvider } = useSettings();
  const detailedMealFlow = aiMealCameraFlow === 'detailed';
  const [mealDraft, dispatchMealDraft] = useReducer(mealPhotoDraftReducer, EMPTY_MEAL_PHOTO_DRAFT);
  const [isMealDetailsVisible, setIsMealDetailsVisible] = useState(false);
  const mealPhotoLimit = useMealPhotoLimit(visible && detailedMealFlow, aiProvider);
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
  const [selectedMealForLogging, setSelectedMealForLogging] = useState<
    ComponentProps<typeof LogMealModal>['meal'] | null
  >(null);
  const [aiIngredients, setAiIngredients] = useState<TrackMealIngredient[] | undefined>(undefined);
  const [aiPhotoUri, setAiPhotoUri] = useState<string | undefined>(undefined);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('lunch');
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  const [mealProgress, setMealProgress] = useState<MealEstimateProgressLine | null>(null);
  const [mealPhotoError, setMealPhotoError] = useState<string | null>(null);
  // Aborts the in-flight AI request when the user taps Cancel on the processing overlay.
  const aiAbortRef = useRef<AbortController | null>(null);
  /** Synthetic product from AI label (OCR or vision) for FoodMealTrackingDetailsModal */
  const [productFromAiLabel, setProductFromAiLabel] = useState<SearchResultProduct | null>(null);

  const isBarcodeScanning = cameraMode === 'barcode-scan';
  const cameraRef = useRef<CameraViewRef>(null);
  const shouldShowBarcodeTextSearch = showBarcodeTextSearch && cameraMode === 'barcode-scan';

  const barcode = useBarcodeScanner({ visible, onBarcodeScanned, onClose });
  const { isSearchingBarcodeRef } = barcode;

  const isFoodDetailsModalVisible = barcode.detectedBarcode !== null || productFromAiLabel !== null;

  const handleClose = useCallback(() => {
    isSearchingBarcodeRef.current = false;
    onClose();
  }, [isSearchingBarcodeRef, onClose]);

  const mealCamera = mealCameraControls({
    detailedFlow: detailedMealFlow,
    isMealPhotoMode: cameraMode === 'ai-meal-photo',
    draft: mealDraft,
    limit: mealPhotoLimit,
  });

  // The camera's own close (X and Android back). While it is open only to add photos to a
  // draft, closing goes back to the details sheet instead of throwing the draft away. A running
  // estimate keeps the old behaviour (close cancels it), since the sheet cannot start another.
  const handleShellClose = () => {
    if (mealCamera.addingToDraft && !isProcessingAi) {
      setIsMealDetailsVisible(true);

      return;
    }

    handleClose();
  };

  const opticalOffer = useOpticalStreamOffer({
    detected: barcode.isOpticalStreamDetected,
    hostVisible: visible,
    onDismiss: barcode.dismissOpticalStreamHint,
    onFinished: handleClose,
  });

  // Every conditionally-rendered child modal in the JSX below MUST have its visibility
  // flag listed here — the camera is active only while none of them covers it. A flag
  // missing from this list leaves the camera feed live behind that modal.
  const isAnyChildModalVisible = [
    isMealDetailsVisible,
    isContextModalVisible,
    isBarcodeTextSearchModalVisible,
    barcode.isFoodNotFoundModalVisible,
    isFoodDetailsModalVisible,
    isAddFoodModalVisible,
    isNewCustomFoodModalVisible,
    isFoodSearchModalVisible,
    isLogMealModalVisible,
    opticalOffer.isReceiveVisible,
  ].some(Boolean);

  const isCameraActive =
    visible && !barcode.isSearchingBarcode && !isProcessingAi && !isAnyChildModalVisible;

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
      aiAbortRef.current?.abort();
      aiAbortRef.current = null;
      const reset = () => {
        setIsContextModalVisible(false);
        setIsMealDetailsVisible(false);
        dispatchMealDraft({ type: 'reset' });
        setIsBarcodeTextSearchModalVisible(false);
        setIsAddFoodModalVisible(false);
        setIsNewCustomFoodModalVisible(false);
        setIsFoodSearchModalVisible(false);
        setIsLogMealModalVisible(false);
        setProductFromAiLabel(null);
        setMealPhotoError(null);
        isSearchingBarcodeRef.current = false;
      };

      reset();
    }
  }, [visible, isSearchingBarcodeRef]);

  useEffect(() => {
    return () => {
      aiAbortRef.current?.abort();
      aiAbortRef.current = null;
    };
  }, []);

  useKeepScreenAwake(
    'smart-camera-processing',
    visible && (isProcessingAi || barcode.isSearchingBarcode)
  );

  const runCameraAiTask = useCameraAiProcessing({
    abortRef: aiAbortRef,
    setProcessing: setIsProcessingAi,
    setProgress: setMealProgress,
  });

  const submitMealEstimate = useMealPhotoEstimate({
    abortRef: aiAbortRef,
    setProcessing: setIsProcessingAi,
    setProgress: setMealProgress,
    setError: setMealPhotoError,
    onSuccess: (meal, ingredients, photo) => {
      setAiPhotoUri(photo);
      setSelectedMealForLogging(meal);
      setAiIngredients(ingredients);
      dispatchMealDraft({ type: 'reset' });
      setIsLogMealModalVisible(true);
    },
  });

  const runMealEstimate = () => {
    if (aiAbortRef.current || mealDraft.photos.length === 0) {
      return;
    }

    setIsMealDetailsVisible(false);
    void submitMealEstimate({
      photos: mealDraft.photos,
      context: mealPhotoContextFromDraft(mealDraft),
      name: mealDraft.name,
      onFailure: () => setIsMealDetailsVisible(true),
    });
  };

  const processAiPhoto = useCallback(
    async (fileUri: string) => {
      if (cameraMode === 'ai-meal-photo' && detailedMealFlow) {
        // The detailed flow collects photos first; the estimate runs from the sheet.
        setMealPhotoError(null);
        dispatchMealDraft({ type: 'addPhoto', uri: fileUri, limit: mealPhotoLimit });
        setIsMealDetailsVisible(true);

        return;
      }

      if (cameraMode === 'ai-meal-photo') {
        await submitMealEstimate({ photos: [fileUri], context: aiContext ?? undefined });

        return;
      }

      if (cameraMode !== 'ai-label-scan' || aiAbortRef.current) {
        return;
      }

      setMealPhotoError(null);
      setAiPhotoUri(fileUri);

      await runCameraAiTask({
        timerName: 'SmartCamera.aiPhoto',
        logLabel: 'Error processing AI photo',
        onError: (message) => showSnackbar('error', message),
        task: async ({ signal, config }) => {
          let result: MacroEstimate | null = null;

          // On-device meal vision identifies foods. Label scanning uses OCR and text extraction.
          if (useOcrBeforeAi || !isAIVisionEnabled || config.provider === 'on-device') {
            const ocrLanguage = i18n.resolvedLanguage ?? i18n.language;
            const { text } = await ocrRecognizeText(fileUri, ocrLanguage);
            if (signal.aborted) {
              return null;
            }

            if (!text.trim()) {
              return t('food.aiCamera.aiAnalysisFailed');
            }

            result = await extractMacrosFromLabelText(config, text, aiContext ?? undefined);
          } else {
            const base64 = await readFileAsStringAsync(fileUri, {
              encoding: 'base64',
            } as { encoding: 'base64' });
            if (signal.aborted) {
              return null;
            }

            result = await extractMacrosFromLabelPhoto(config, base64, aiContext ?? undefined);
          }

          if (signal.aborted) {
            return null;
          }

          if (!result) {
            return t('food.aiCamera.aiAnalysisFailed');
          }

          showSnackbar(
            'success',
            t('food.aiCamera.analysisSuccess', {
              name: result.name,
              kcal: formatEnergyWithUnit(result.kcal),
              protein: result.protein,
              carbs: result.carbs,
              fat: result.fat,
            })
          );
          setProductFromAiLabel(macroEstimateToSearchResultProduct(result));

          return null;
        },
      });
    },
    [
      cameraMode,
      detailedMealFlow,
      mealPhotoLimit,
      aiContext,
      formatEnergyWithUnit,
      isAIVisionEnabled,
      i18n.language,
      i18n.resolvedLanguage,
      macroEstimateToSearchResultProduct,
      runCameraAiTask,
      submitMealEstimate,
      t,
      useOcrBeforeAi,
    ]
  );

  const { takePicture, pickFromGallery } = useCameraCaptureFlow({
    cameraRef,
    quality: isBarcodeScanning ? BARCODE_PHOTO_QUALITY : AI_PHOTO_QUALITY,
    process: isBarcodeScanning ? barcode.processBarcodeImage : processAiPhoto,
    gallerySelectionLimit: mealCamera.gallerySelectionLimit,
  });

  // Barcode mode reads the live preview, so it offers no shutter at all; omitting the handler is
  // what hides the button (see SmartCameraShell's `onShutterPress`).
  // A full draft (added to from the details sheet) has no slot left: the shutter and gallery send
  // the person back to the sheet, where a photo can be removed, instead of taking a photo that
  // the draft would drop.
  const isDraftFull = mealCamera.addingToDraft && !mealCamera.canAddPhoto;

  const handleShutterPress = useCallback(() => {
    if (isDraftFull) {
      setIsMealDetailsVisible(true);

      return;
    }

    takePicture();
  }, [isDraftFull, takePicture]);

  const handleGalleryPress = useCallback(() => {
    if (isDraftFull) {
      setIsMealDetailsVisible(true);

      return;
    }

    pickFromGallery();
  }, [isDraftFull, pickFromGallery]);

  // Barcode mode reads the live preview, so it offers no shutter at all; omitting the handler is
  // what hides the button (see SmartCameraShell's `onShutterPress`).
  const shutterPress = isBarcodeScanning ? undefined : handleShutterPress;

  const handleFlashToggle = useCallback(() => {
    setFlashEnabled((prev) => !prev);
  }, []);

  const handleModeChange = useCallback((newMode: CameraMode) => {
    setMealPhotoError(null);
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
    async ({ date, time, mealType, portionGrams }: LogMealData) => {
      try {
        if (!selectedMealForLogging) {
          showSnackbar('error', t('food.aiCamera.mealLoggingFailed'));
          return;
        }

        const persistedImageUri = aiPhotoUri
          ? await copyImageToDocumentDirectory(aiPhotoUri).catch(() => undefined)
          : undefined;

        if (aiIngredients && aiIngredients.length > 0) {
          // An estimate is logged food by food, through the same logger the coach chat uses.
          await logTrackedMeal({
            ingredients: aiIngredients,
            date,
            mealType,
            portionGrams,
            mealName: selectedMealForLogging.name,
            imageUrl: persistedImageUri,
            consumedTime: time,
          });
        } else {
          // A label scan has no ingredients, so its totals are scaled to the portion.
          const baseGrams = Math.max(selectedMealForLogging.grams ?? 100, 1);
          const scale = portionGrams / baseGrams;
          await NutritionService.logCustomMeal(
            {
              name: selectedMealForLogging.name,
              calories: selectedMealForLogging.calories * scale,
              protein: selectedMealForLogging.protein * scale,
              carbs: selectedMealForLogging.carbs * scale,
              fat: selectedMealForLogging.fat * scale,
              imageUrl: persistedImageUri,
            },
            date,
            mealType,
            portionGrams,
            { loggedMealName: selectedMealForLogging.name, consumedTime: time }
          );
        }

        showSnackbar('success', t('food.aiCamera.mealLoggedSuccess'));
        triggerConfetti(ConfettiActivity.FIRST_NUTRITION_LOG);
        setIsLogMealModalVisible(false);
        setSelectedMealForLogging(null);
        setAiIngredients(undefined);
        setAiPhotoUri(undefined);
        dispatchMealDraft({ type: 'reset' });

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

  const handleBarcodeTextSearchSubmit = useCallback(() => {
    const value = barcodeTextSearchValue.trim();
    setIsBarcodeTextSearchModalVisible(false);
    setBarcodeTextSearchValue('');
    barcode.handleBarcodeTextSearchSubmit(value);
  }, [barcode, barcodeTextSearchValue]);

  const bottomRightControl = (
    <BottomRightControl
      aiContext={aiContext}
      cameraMode={cameraMode}
      hideCameraModePicker={hideCameraModePicker}
      isAiEnabled={isAiEnabled}
      onContextPress={() => setIsContextModalVisible(true)}
      onTextSearchPress={() => setIsBarcodeTextSearchModalVisible(true)}
      showTextSearch={shouldShowBarcodeTextSearch}
      detailedMealFlow={detailedMealFlow}
      mealDraft={
        mealDraft.photos.length > 0
          ? {
              firstPhotoUri: mealDraft.photos[0],
              count: mealDraft.photos.length,
              label: t('food.mealPhotos.reviewPhotos', { count: mealDraft.photos.length }),
              onPress: () => setIsMealDetailsVisible(true),
            }
          : null
      }
    />
  );

  if (!visible) {
    return null;
  }

  const barcodeNotice = isBarcodeScanning ? opticalOffer.notice : null;
  // Switching modes while adding photos to a meal draft would orphan the draft.
  const showModePicker = !hideCameraModePicker && !mealCamera.addingToDraft;

  return (
    <>
      <SmartCameraShell
        visible={visible}
        onClose={handleShellClose}
        processingStatus={mealProgress}
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
            <SmartCameraPlaceholder />
          )
        }
        isLoading={barcode.isSearchingBarcode || isProcessingAi}
        onCancelLoading={isProcessingAi ? () => aiAbortRef.current?.abort() : undefined}
        cameraMode={cameraMode}
        flashEnabled={flashEnabled}
        onFlashToggle={handleFlashToggle}
        onGalleryPress={handleGalleryPress}
        onShutterPress={shutterPress}
        bottomRightControl={bottomRightControl}
        // Keep persistent photo errors and barcode notices in the same in-flow slot.
        noticeSlot={
          cameraMode === 'ai-meal-photo' && mealPhotoError ? (
            <View className="rounded-control bg-status-error/10 p-3">
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                className="text-sm text-status-error"
              >
                {mealPhotoError}
              </Text>
            </View>
          ) : (
            barcodeNotice
          )
        }
        showModePicker={showModePicker}
        isAiEnabled={isAiEnabled}
        isAIVisionEnabled={isAIVisionEnabled}
        onModeChange={handleModeChange}
      >
        {/* Optical transfer offer — the receive screen must live inside this modal's tree. */}
        {opticalOffer.receiver}

        {/* Detailed meal flow: the photos so far and their optional details. */}
        {isMealDetailsVisible ? (
          <MealPhotoDetailsModal
            visible={isMealDetailsVisible}
            draft={mealDraft}
            dispatch={dispatchMealDraft}
            photoLimit={mealPhotoLimit}
            onAddPhoto={() => setIsMealDetailsVisible(false)}
            onEstimate={runMealEstimate}
            onDiscard={() => {
              setIsMealDetailsVisible(false);
              dispatchMealDraft({ type: 'reset' });
              setMealPhotoError(null);
            }}
            errorMessage={mealPhotoError}
          />
        ) : null}

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
            aiOutputKind={productFromAiLabel ? 'import' : undefined}
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
            isAiEnabled={isAIVisionEnabled}
          />
        ) : null}

        {/* Add Food Modal */}
        {isAddFoodModalVisible ? (
          <AddFoodModal
            visible={isAddFoodModalVisible}
            onClose={handleAddFoodClose}
            onMealTypeSelect={handleMealTypeSelect}
            onAiCameraPress={isAIVisionEnabled ? handleAiCameraPress : undefined}
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
      </SmartCameraShell>
      {showConfetti ? <ConfettiOverlay pose="eating" /> : null}
    </>
  );
}
