import {
  AlignLeft,
  BarChart,
  Cookie,
  Droplet,
  Dumbbell,
  Edit3,
  Leaf,
  PlusCircle,
  ScanLine,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { BarcodeInput } from '@/components/BarcodeInput';
import { BottomPopUp } from '@/components/BottomPopUp';
import { useCameraPermissions } from '@/components/CameraView';
import {
  type FoodDetailsNutritionSectionMode,
  FoodNutritionSectionCard,
} from '@/components/cards/FoodNutritionSectionCard';
import { MacroInput } from '@/components/MacroInput';
import {
  micronutrientFormStringsFromMicros,
  MicronutrientsExpandableSection,
} from '@/components/MicronutrientsExpandableSection';
import { ServingSizeSelector } from '@/components/ServingSizeSelector';
import { Button } from '@/components/theme/Button';
import { TextInput } from '@/components/theme/TextInput';
import type { MicrosData } from '@/database/models';
import { FoodService } from '@/database/services';
import { useAlternateBarcodeSource } from '@/hooks/useAlternateBarcodeSource';
import { useFoodEditForm } from '@/hooks/useFoodEditForm';
import { useFoodProductDetails } from '@/hooks/useFoodProductDetails';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { isSuccessFoodDetailProductState } from '@/types/guards/openFoodFacts';
import {
  areCoreMacrosEffectivelyZero,
  EMPTY_PRODUCT_NUTRITION,
  getProductBarcodeFromSearchProduct,
  inferBarcodeNutritionSource,
  microsFromNutrition,
  parseProductNutritionPer100g,
  parseServingSizeFromProduct,
} from '@/utils/externalFoodProduct';
import { formatAppRoundedDecimal } from '@/utils/formatAppNumber';
import { handleError } from '@/utils/handleError';
import {
  applyInferredCaloriesFromMacrosIfNeeded,
  inferCaloriesFromMacrosPer100g,
  toFiniteMacro,
} from '@/utils/inferCaloriesFromMacros';
import { getDecimalSeparator } from '@/utils/localizedDecimalInput';
import { applyMusclogQualityToFoodRecord } from '@/utils/musclogProduct';
import { extractLabelsFromOFFProduct, getProductName } from '@/utils/openFoodFactsMapper';
import { roundToDecimalPlaces } from '@/utils/roundDecimal';

import { BarcodeCameraModal } from './BarcodeCameraModal';

type ScannedFoodDetailsModalProps = {
  visible: boolean;
  onClose: () => void;
  barcode: string;
  onAddFood?: (food: { food: any; amount: number }) => void;
};

export function ScannedFoodDetailsModal({
  visible,
  onClose,
  barcode,
  onAddFood,
}: ScannedFoodDetailsModalProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const locale = useMemo(
    () => i18n.resolvedLanguage ?? i18n.language,
    [i18n.resolvedLanguage, i18n.language]
  );
  const decimalSeparator = useMemo(() => getDecimalSeparator(locale), [locale]);
  const { intuitiveEatingMode, alwaysAllowFoodEditing } = useSettings();
  const [permission, requestPermission] = useCameraPermissions();
  const [isBarcodeScannerVisible, setIsBarcodeScannerVisible] = useState(false);
  const [amount, setAmount] = useState(100);
  const [localCanEdit, setLocalCanEdit] = useState(alwaysAllowFoodEditing);

  const { data: productData, isLoading, error } = useFoodProductDetails(barcode);

  // Once every other provider has been exhausted, fall back to manual editing.
  const enableEditing = useCallback(() => setLocalCanEdit(true), []);

  // "Try another source" cross-provider lookup + its state cluster (refetched details, in-flight,
  // exhausted-all-sources).
  const {
    refetchedProductDetails,
    isRefetchingSource,
    alternateSourceLookupFailed,
    tryAnotherSource: handleTryAnotherSource,
    reset: resetAlternateSource,
  } = useAlternateBarcodeSource({
    barcode,
    productDetails: productData,
    errorContext: 'ScannedFoodDetailsModal.handleTryAnotherSource',
    onExhausted: enableEditing,
  });

  const effectiveProductDetails = refetchedProductDetails ?? productData;
  const currentSource = inferBarcodeNutritionSource(effectiveProductDetails, null);
  const mode: FoodDetailsNutritionSectionMode = 'externalProduct';
  const scaleFactor = amount / 100;

  const isScannedProductSuccess = Boolean(
    effectiveProductDetails &&
    (isSuccessFoodDetailProductState(effectiveProductDetails) ||
      (effectiveProductDetails as any)?.source === 'usda' ||
      (effectiveProductDetails as any)?.source === 'musclog')
  );

  useEffect(() => {
    const syncEdit = () => {
      setLocalCanEdit(alwaysAllowFoodEditing);
    };
    syncEdit();
  }, [alwaysAllowFoodEditing]);

  const rawNutritionalData = useMemo(() => {
    if (isSuccessFoodDetailProductState(effectiveProductDetails)) {
      const detailsSource =
        inferBarcodeNutritionSource(effectiveProductDetails, null) ?? 'openfood';
      return parseProductNutritionPer100g(detailsSource, effectiveProductDetails.product);
    }

    return { ...EMPTY_PRODUCT_NUTRITION };
  }, [effectiveProductDetails]);

  const baseNutritionalData = useMemo(
    () => applyInferredCaloriesFromMacrosIfNeeded(rawNutritionalData),
    [rawNutritionalData]
  );

  const baseMicrosPer100g = useMemo(
    (): MicrosData => microsFromNutrition(rawNutritionalData),
    [rawNutritionalData]
  );

  const inferredCaloriesPer100g = useMemo(
    () =>
      inferCaloriesFromMacrosPer100g(
        rawNutritionalData.protein,
        rawNutritionalData.carbs,
        rawNutritionalData.fat,
        rawNutritionalData.fiber,
        rawNutritionalData.alcohol
      ),
    [
      rawNutritionalData.protein,
      rawNutritionalData.carbs,
      rawNutritionalData.fat,
      rawNutritionalData.fiber,
      rawNutritionalData.alcohol,
    ]
  );

  // Edit-pop-up state + shared edit handlers (overrides feed the derived nutrition below).
  const {
    editedOverrides,
    editForm,
    setEditForm,
    isEditPopUpVisible,
    editMicroOpen,
    setEditMicroOpen,
    openEditPopUp,
    closeEditPopUp,
    saveEditPopUp: handleSaveEditPopUp,
    acceptInferredCalories: handleAcceptInferredCalories,
    handleEditFormNumericChange,
    reset: resetEditForm,
  } = useFoodEditForm({ decimalSeparator, inferredCaloriesPer100g });

  useEffect(() => {
    if (!visible) {
      const reset = () => {
        setAmount(100);
        resetEditForm();
        resetAlternateSource();
        setLocalCanEdit(alwaysAllowFoodEditing);
      };
      reset();
    }
  }, [visible, alwaysAllowFoodEditing, resetEditForm, resetAlternateSource]);

  const effectiveMicrosPer100g = useMemo(
    () => ({
      ...baseMicrosPer100g,
      ...(editedOverrides?.micros ?? {}),
    }),
    [baseMicrosPer100g, editedOverrides?.micros]
  );

  const showCaloriesTooLowWarning = useMemo(() => {
    const rawCal = toFiniteMacro(rawNutritionalData.calories);
    return (
      rawCal > 0 &&
      inferredCaloriesPer100g > 0 &&
      (rawCal < inferredCaloriesPer100g * 0.7 || rawCal > inferredCaloriesPer100g * 1.3) &&
      editedOverrides?.calories == null
    );
  }, [rawNutritionalData.calories, inferredCaloriesPer100g, editedOverrides?.calories]);

  const nutritionalData = useMemo(() => {
    const macroBase =
      editedOverrides &&
      (editedOverrides.calories != null ||
        editedOverrides.protein != null ||
        editedOverrides.carbs != null ||
        editedOverrides.fat != null ||
        editedOverrides.fiber != null)
        ? {
            ...baseNutritionalData,
            calories: editedOverrides.calories ?? baseNutritionalData.calories,
            protein: editedOverrides.protein ?? baseNutritionalData.protein,
            carbs: editedOverrides.carbs ?? baseNutritionalData.carbs,
            fat: editedOverrides.fat ?? baseNutritionalData.fat,
            fiber: editedOverrides.fiber ?? baseNutritionalData.fiber,
          }
        : baseNutritionalData;

    const pickMicro = (key: 'sugar' | 'saturatedFat' | 'sodium') => {
      const v = effectiveMicrosPer100g[key];
      return typeof v === 'number' && Number.isFinite(v) ? v : (macroBase as any)[key];
    };

    const pickMicro2 = (key: 'alcohol' | 'potassium' | 'magnesium' | 'zinc') => {
      const v = effectiveMicrosPer100g[key];
      return typeof v === 'number' && Number.isFinite(v) ? v : ((macroBase as any)[key] ?? 0);
    };

    return {
      ...macroBase,
      sugar: pickMicro('sugar'),
      saturatedFat: pickMicro('saturatedFat'),
      sodium: pickMicro('sodium'),
      alcohol: pickMicro2('alcohol'),
      potassium: pickMicro2('potassium'),
      magnesium: pickMicro2('magnesium'),
      zinc: pickMicro2('zinc'),
    };
  }, [baseNutritionalData, editedOverrides, effectiveMicrosPer100g]);

  const hasAllZeroMacros = useMemo(() => {
    if (refetchedProductDetails || isLoading || !effectiveProductDetails) {
      return false;
    }

    return areCoreMacrosEffectivelyZero(baseNutritionalData);
  }, [refetchedProductDetails, isLoading, effectiveProductDetails, baseNutritionalData]);

  const hasNoNutrition = useMemo(() => {
    if (currentSource !== 'openfood' || !isSuccessFoodDetailProductState(effectiveProductDetails)) {
      return false;
    }

    const product = effectiveProductDetails.product;
    return (
      product.no_nutrition_data === 'on' ||
      product.no_nutrition_data === 1 ||
      !product.nutriments ||
      Object.keys(product.nutriments).length === 0
    );
  }, [currentSource, effectiveProductDetails]);

  const getCurrentName = () => {
    if (editedOverrides?.name?.trim()) {
      return editedOverrides.name.trim();
    }

    if (isSuccessFoodDetailProductState(effectiveProductDetails)) {
      return getProductName(effectiveProductDetails);
    }

    if ((effectiveProductDetails as any)?.source === 'musclog') {
      return (effectiveProductDetails as any).product?.name || t('food.unknownFood');
    }

    if ((effectiveProductDetails as any)?.source === 'usda') {
      return (effectiveProductDetails as any).product?.description || t('food.unknownFood');
    }

    return t('food.unknownFood');
  };

  const getCurrentBrand = useCallback(() => {
    if ((effectiveProductDetails as any)?.source === 'musclog') {
      return (effectiveProductDetails as any).product?.brand || '';
    }

    if ((effectiveProductDetails as any)?.source === 'usda') {
      const product = (effectiveProductDetails as any).product;
      return product?.brandOwner || product?.brandName || '';
    }

    if (isSuccessFoodDetailProductState(effectiveProductDetails)) {
      return effectiveProductDetails.product?.brands || '';
    }

    return '';
  }, [effectiveProductDetails]);

  const getCurrentCategory = useCallback(() => {
    if ((effectiveProductDetails as any)?.source === 'musclog') {
      return (effectiveProductDetails as any).product?.brand || t('food.generic');
    }

    if ((effectiveProductDetails as any)?.source === 'usda') {
      const product = (effectiveProductDetails as any).product;
      const brand = product?.brandOwner || product?.brandName;
      const category = product?.foodCategory || product?.dataType;
      if (brand && category) {
        return `${brand} • ${category}`;
      }

      return brand || category || t('food.generic');
    }

    if (isSuccessFoodDetailProductState(effectiveProductDetails)) {
      const product = effectiveProductDetails.product;
      const brand = product?.brands;
      const categories = product?.categories;
      if (brand && categories) {
        return `${brand} • ${categories}`;
      }

      return brand || categories || t('food.generic');
    }

    return t('food.generic');
  }, [effectiveProductDetails, t]);

  const getCurrentDescription = () => {
    if (editedOverrides?.description != null) {
      return editedOverrides.description.trim();
    }

    if ((effectiveProductDetails as any)?.source === 'musclog') {
      return (effectiveProductDetails as any).product?.description || '';
    }

    if ((effectiveProductDetails as any)?.source === 'usda') {
      return (effectiveProductDetails as any).product?.ingredients || '';
    }

    if (isSuccessFoodDetailProductState(effectiveProductDetails)) {
      return (effectiveProductDetails.product as any)?.ingredients_text || '';
    }

    return '';
  };

  const parsedProductServingSize = useMemo(() => {
    if (!isScannedProductSuccess) {
      return undefined;
    }

    const product = (effectiveProductDetails as any)?.product;
    return parseServingSizeFromProduct(product);
  }, [effectiveProductDetails, isScannedProductSuccess]);

  const parsedProductMeasures = useMemo(() => {
    if ((effectiveProductDetails as any)?.source !== 'usda') {
      return undefined;
    }

    const product = (effectiveProductDetails as any).product;
    const result: { name: string; gramWeight: number }[] = [];
    const measures: { disseminationText?: string; gramWeight?: number }[] =
      product?.foodMeasures ?? product?._raw?.foodMeasures ?? [];
    for (const m of measures) {
      if (m.gramWeight && m.gramWeight > 0 && m.disseminationText) {
        result.push({ name: m.disseminationText, gramWeight: m.gramWeight });
      }
    }

    const portions: { gramWeight?: number; portionDescription?: string; modifier?: string }[] =
      product?.foodPortions ?? [];
    for (const p of portions) {
      if (!p.gramWeight || p.gramWeight <= 0) {
        continue;
      }

      const name = p.portionDescription || p.modifier;
      if (!name) {
        continue;
      }

      if (!result.some((r) => r.gramWeight === p.gramWeight)) {
        result.push({ name, gramWeight: p.gramWeight });
      }
    }

    return result.length > 0 ? result : undefined;
  }, [effectiveProductDetails]);

  const scaledFood = useMemo(
    () => ({
      name: getCurrentName(),
      category: getCurrentCategory(),
      calories: roundToDecimalPlaces(nutritionalData.calories * scaleFactor),
      protein: roundToDecimalPlaces(nutritionalData.protein * scaleFactor),
      carbs: roundToDecimalPlaces(nutritionalData.carbs * scaleFactor),
      fat: roundToDecimalPlaces(nutritionalData.fat * scaleFactor),
      source: currentSource ?? undefined,
    }),
    [
      getCurrentName,
      getCurrentCategory,
      nutritionalData.calories,
      nutritionalData.protein,
      nutritionalData.carbs,
      nutritionalData.fat,
      scaleFactor,
      currentSource,
    ]
  );

  // Gathers the modal-specific initial values, then hands off to the shared edit-pop-up state.
  const handleOpenEditPopUp = useCallback(() => {
    const productCode = getProductBarcodeFromSearchProduct(
      (effectiveProductDetails as any)?.product
    );
    const currentBarcode = editedOverrides?.barcode ?? barcode ?? productCode ?? '';

    openEditPopUp({
      name: getCurrentName(),
      barcode: currentBarcode,
      description: getCurrentDescription(),
      calories: formatAppRoundedDecimal(locale, nutritionalData.calories, 2),
      protein: formatAppRoundedDecimal(locale, nutritionalData.protein, 2),
      carbs: formatAppRoundedDecimal(locale, nutritionalData.carbs, 2),
      fat: formatAppRoundedDecimal(locale, nutritionalData.fat, 2),
      fiber: formatAppRoundedDecimal(locale, nutritionalData.fiber, 2),
      micronutrients: micronutrientFormStringsFromMicros(effectiveMicrosPer100g, locale),
    });
  }, [
    effectiveProductDetails,
    editedOverrides?.barcode,
    barcode,
    getCurrentName,
    getCurrentDescription,
    locale,
    nutritionalData.calories,
    nutritionalData.protein,
    nutritionalData.carbs,
    nutritionalData.fat,
    nutritionalData.fiber,
    effectiveMicrosPer100g,
    openEditPopUp,
  ]);

  const handleAddFood = useCallback(async () => {
    if (!isScannedProductSuccess) {
      return;
    }

    const saveBarcode = editedOverrides?.barcode?.trim() || barcode;

    try {
      const existingFood = await FoodService.getFoodByBarcode(saveBarcode);
      if (existingFood) {
        if (editedOverrides || refetchedProductDetails) {
          await existingFood.update((record: any) => {
            record.name = getCurrentName();
            record.barcode = saveBarcode;
            record.description = getCurrentDescription();
            record.brand = getCurrentBrand();
            record.calories = nutritionalData.calories;
            record.protein = nutritionalData.protein;
            record.carbs = nutritionalData.carbs;
            record.fat = nutritionalData.fat;
            record.fiber = nutritionalData.fiber;
            record.micros = effectiveMicrosPer100g;
            if (currentSource) {
              record.source = currentSource;
            }

            const bp = (effectiveProductDetails as any)?.product;
            if (bp) {
              if ((effectiveProductDetails as any).source === 'musclog') {
                applyMusclogQualityToFoodRecord(record, bp);
              } else {
                if (typeof bp.nutriscore_grade === 'string' && bp.nutriscore_grade) {
                  record.nutriscore = bp.nutriscore_grade.toLowerCase();
                }

                if (typeof bp.ecoscore_grade === 'string' && bp.ecoscore_grade) {
                  record.ecoscore = bp.ecoscore_grade.toLowerCase();
                }

                if (typeof bp.nova_group === 'number') {
                  record.novaGroup = bp.nova_group;
                }

                const extractedLabels = extractLabelsFromOFFProduct(bp);
                if (extractedLabels != null) {
                  record.labels = extractedLabels;
                }
              }
            }
          });
        }

        onAddFood?.({ food: existingFood, amount });
        onClose();
        return;
      }

      if ((effectiveProductDetails as any)?.source === 'usda') {
        const baseProduct = (effectiveProductDetails as any).product;
        const usdaProduct = {
          ...baseProduct,
          description: editedOverrides?.name?.trim() || baseProduct.description,
          gtinUpc: saveBarcode || baseProduct.gtinUpc,
          ingredients: getCurrentDescription() || baseProduct.ingredients,
        };

        const newFood = await FoodService.createFromUSDAProduct(
          usdaProduct,
          {
            calories: nutritionalData.calories,
            protein: nutritionalData.protein,
            carbs: nutritionalData.carbs,
            fat: nutritionalData.fat,
            fiber: nutritionalData.fiber,
            sugar: nutritionalData.sugar,
            saturatedFat: nutritionalData.saturatedFat,
            sodium: nutritionalData.sodium,
            micros: effectiveMicrosPer100g,
          },
          null,
          saveBarcode
        );

        onAddFood?.({ food: newFood, amount });
        onClose();
        return;
      }

      if ((effectiveProductDetails as any)?.source === 'musclog') {
        const baseProduct = (effectiveProductDetails as any).product;
        const musclogProduct = {
          ...baseProduct,
          name: getCurrentName(),
          description: getCurrentDescription(),
        };

        const newFood = await FoodService.createFromMusclogProduct(
          musclogProduct,
          {
            calories: nutritionalData.calories,
            protein: nutritionalData.protein,
            carbs: nutritionalData.carbs,
            fat: nutritionalData.fat,
            fiber: nutritionalData.fiber,
            sugar: nutritionalData.sugar,
            saturatedFat: nutritionalData.saturatedFat,
            sodium: nutritionalData.sodium,
            micros: effectiveMicrosPer100g,
          },
          saveBarcode
        );

        onAddFood?.({ food: newFood, amount });
        onClose();
        return;
      }

      if (isSuccessFoodDetailProductState(effectiveProductDetails)) {
        const baseProduct = effectiveProductDetails.product as any;
        const offProduct = {
          ...baseProduct,
          product_name: getCurrentName(),
          code: saveBarcode || baseProduct.code || '',
          ingredients_text: getCurrentDescription() || baseProduct.ingredients_text,
        };

        const newFood = await FoodService.createFromV3Product(
          offProduct,
          {
            calories: nutritionalData.calories,
            protein: nutritionalData.protein,
            carbs: nutritionalData.carbs,
            fat: nutritionalData.fat,
            fiber: nutritionalData.fiber,
            sugar: nutritionalData.sugar,
            saturatedFat: nutritionalData.saturatedFat,
            sodium: nutritionalData.sodium,
            micros: effectiveMicrosPer100g,
            nutriscore:
              typeof baseProduct.nutriscore_grade === 'string' && baseProduct.nutriscore_grade
                ? baseProduct.nutriscore_grade.toLowerCase()
                : undefined,
            ecoscore:
              typeof baseProduct.ecoscore_grade === 'string' && baseProduct.ecoscore_grade
                ? baseProduct.ecoscore_grade.toLowerCase()
                : undefined,
            novaGroup:
              typeof baseProduct.nova_group === 'number' ? baseProduct.nova_group : undefined,
            labels: extractLabelsFromOFFProduct(baseProduct),
          },
          null
        );

        onAddFood?.({ food: newFood, amount });
        onClose();
      }
    } catch (saveError) {
      handleError(saveError, 'ScannedFoodDetailsModal.handleAddFood', {
        showSnackbar: false,
      });
    }
  }, [
    isScannedProductSuccess,
    editedOverrides,
    barcode,
    refetchedProductDetails,
    getCurrentName,
    getCurrentDescription,
    getCurrentBrand,
    nutritionalData,
    effectiveMicrosPer100g,
    currentSource,
    onAddFood,
    amount,
    onClose,
    effectiveProductDetails,
  ]);

  if (!visible) {
    return null;
  }

  const renderMainContent = () => {
    if (isLoading && !refetchedProductDetails) {
      return (
        <View className="flex-1 items-center justify-center py-8">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
          <Text
            style={{
              marginTop: theme.spacing.padding.md,
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.tertiary,
            }}
          >
            {t('common.loading')}
          </Text>
        </View>
      );
    }

    if (error || !isScannedProductSuccess) {
      return (
        <View className="flex-1 items-center justify-center py-8">
          <Text
            style={{
              fontSize: theme.typography.fontSize.base,
              color: theme.colors.text.secondary,
              textAlign: 'center',
            }}
          >
            {t('food.addFoodItemToMeal.barcodeNotFound')}
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.spacing.padding.lg }}
      >
        <FoodNutritionSectionCard
          food={scaledFood}
          canEdit={localCanEdit || hasNoNutrition}
          mode={mode}
          showIncompleteWarning={hasNoNutrition}
          onEditPress={handleOpenEditPopUp}
          nutritionalData={nutritionalData}
          servingSize={amount}
          isLoadingDetails={isLoading}
          onTryAnotherSource={
            hasAllZeroMacros && !alternateSourceLookupFailed ? handleTryAnotherSource : undefined
          }
          isRefetchingSource={isRefetchingSource}
          alternateSourceNotFound={alternateSourceLookupFailed ? hasAllZeroMacros : false}
          caloriesTooLowWarning={
            showCaloriesTooLowWarning
              ? {
                  inferredCalories: roundToDecimalPlaces(inferredCaloriesPer100g, 2),
                  onAccept: handleAcceptInferredCalories,
                }
              : undefined
          }
          intuitiveMode={intuitiveEatingMode}
        />

        <View pointerEvents="none" style={{ height: theme.spacing.padding.base }} />

        <ServingSizeSelector
          value={amount}
          onChange={setAmount}
          productServingSize={parsedProductServingSize}
          productMeasures={parsedProductMeasures}
        />
      </ScrollView>
    );
  };

  return (
    <>
      <BottomPopUp
        visible={visible}
        onClose={onClose}
        title={t('food.addFoodItemToMeal.scannedFoodDetails')}
        subtitle={barcode}
        headerIcon={<ScanLine size={theme.iconSize.lg} color={theme.colors.accent.primary} />}
        footer={
          isScannedProductSuccess ? (
            <Button
              label={t('food.addFoodItemToMeal.addFoodToMeal')}
              variant="gradientCta"
              size="md"
              width="full"
              icon={PlusCircle}
              onPress={handleAddFood}
            />
          ) : null
        }
        maxHeight="88%"
      >
        {renderMainContent()}
      </BottomPopUp>

      <BottomPopUp
        visible={isEditPopUpVisible ? editForm !== null : false}
        onClose={closeEditPopUp}
        title={t('food.foodDetails.editFoodInfo')}
        subtitle={t('food.foodDetails.editFoodInfoSubtitle')}
        headerIcon={
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.status.purple20 }}
          >
            <Edit3 size={theme.iconSize.md} color={theme.colors.accent.primary} />
          </View>
        }
        footer={
          <Button
            label={t('common.save')}
            variant="gradientCta"
            size="sm"
            width="full"
            onPress={handleSaveEditPopUp}
          />
        }
      >
        {editForm ? (
          <View className="gap-5">
            <TextInput
              label={t('food.foodDetails.foodName')}
              value={editForm.name}
              onChangeText={(text) =>
                setEditForm((prev) => (prev ? { ...prev, name: text } : null))
              }
              placeholder={t('food.foodDetails.foodNamePlaceholder')}
              icon={<Edit3 size={theme.iconSize.md} color={theme.colors.text.tertiary} />}
            />

            <BarcodeInput
              label={t('food.foodDetails.barcode')}
              value={editForm.barcode}
              onChangeText={(text) =>
                setEditForm((prev) => (prev ? { ...prev, barcode: text } : null))
              }
              placeholder={t('food.foodDetails.barcodePlaceholder')}
              onScanPress={() => setIsBarcodeScannerVisible(true)}
            />

            <TextInput
              label={t('food.foodDetails.description')}
              value={editForm.description}
              onChangeText={(text) =>
                setEditForm((prev) => (prev ? { ...prev, description: text } : null))
              }
              placeholder={t('food.foodDetails.descriptionPlaceholder')}
              icon={<AlignLeft size={theme.iconSize.md} color={theme.colors.text.tertiary} />}
              multiline
            />

            <View className="flex-row items-center gap-2">
              <BarChart size={theme.iconSize.lg} color={theme.colors.accent.primary} />
              <Text className="text-xl font-bold text-text-primary">
                {t('food.newCustomFood.macronutrients')}
              </Text>
            </View>

            <Text className="text-xs font-bold uppercase tracking-widest text-text-secondary">
              {t('food.foodDetails.macrosPer100g')}
            </Text>

            <MacroInput
              label={t('food.newCustomFood.calories')}
              value={editForm.calories}
              onChange={handleEditFormNumericChange('calories')}
              allowDecimals
              topRightElement={
                <View
                  className="rounded-full px-2"
                  style={{
                    paddingVertical: theme.spacing.padding.xsHalf,
                    backgroundColor: theme.colors.accent.primary10,
                  }}
                >
                  <Text className="text-xs font-medium text-accent-primary">
                    {t('food.common.kcal')}
                  </Text>
                </View>
              }
              variant="default"
              size="full"
            />

            <View className="flex-row flex-wrap gap-4">
              <MacroInput
                label={t('food.newCustomFood.protein')}
                value={editForm.protein}
                onChange={handleEditFormNumericChange('protein')}
                allowDecimals
                topRightElement={
                  <Dumbbell size={theme.iconSize.sm} color={theme.colors.status.emeraldLight} />
                }
                variant="success"
                size="half"
              />
              <MacroInput
                label={t('food.newCustomFood.carbs')}
                value={editForm.carbs}
                onChange={handleEditFormNumericChange('carbs')}
                allowDecimals
                topRightElement={
                  <Cookie size={theme.iconSize.sm} color={theme.colors.status.amber} />
                }
                variant="warning"
                size="half"
              />
              <MacroInput
                label={t('food.newCustomFood.fat')}
                value={editForm.fat}
                onChange={handleEditFormNumericChange('fat')}
                allowDecimals
                topRightElement={
                  <Droplet size={theme.iconSize.sm} color={theme.colors.status.red400} />
                }
                variant="error"
                size="half"
              />
              <MacroInput
                label={t('food.macros.fiber')}
                value={editForm.fiber}
                onChange={handleEditFormNumericChange('fiber')}
                allowDecimals
                topRightElement={
                  <Leaf size={theme.iconSize.sm} color={theme.colors.status.emerald} />
                }
                variant="success"
                size="half"
              />
            </View>

            <MicronutrientsExpandableSection
              microOpen={editMicroOpen}
              onToggleMicro={() => setEditMicroOpen((o) => !o)}
              values={editForm.micronutrients}
              decimalSeparator={decimalSeparator}
              onMicronutrientChange={(key, value) =>
                setEditForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        micronutrients: { ...prev.micronutrients, [key]: value },
                      }
                    : null
                )
              }
            />
          </View>
        ) : null}
      </BottomPopUp>
      {isBarcodeScannerVisible ? (
        <BarcodeCameraModal
          visible={isBarcodeScannerVisible}
          onClose={() => setIsBarcodeScannerVisible(false)}
          onBarcodeScanned={(data) =>
            setEditForm((prev) => (prev ? { ...prev, barcode: data } : null))
          }
          showBarcodeTextSearch={true}
          permissionGranted={permission?.granted ?? null}
          onRequestPermission={requestPermission}
        />
      ) : null}
    </>
  );
}
