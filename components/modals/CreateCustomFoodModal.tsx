import * as ImagePicker from 'expo-image-picker';
import {
  AlignLeft,
  Apple,
  BarChart,
  Battery,
  Beaker,
  Camera,
  Carrot,
  ChevronDown,
  Cookie,
  Droplet,
  Dumbbell,
  FlaskConical,
  Heart,
  IceCream,
  Leaf,
  Pencil,
  Pill,
  Plus,
  PlusCircle,
  Scale,
  Shield,
  Sparkles,
  Stethoscope,
  Sun,
  TestTube,
  Thermometer,
  Trash2,
  Waves,
  Wine,
  X,
  Zap,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { BarcodeInput } from '@/components/BarcodeInput';
import { useCameraPermissions } from '@/components/CameraView';
import { FilterTabs } from '@/components/FilterTabs';
import { MacroInput } from '@/components/MacroInput';
import { Button } from '@/components/theme/Button';
import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { TextInput } from '@/components/theme/TextInput';
import { ToggleInput } from '@/components/theme/ToggleInput';
import type { MealType } from '@/database/models';
import Food from '@/database/models/Food';
import FoodPortion from '@/database/models/FoodPortion';
import { FoodService } from '@/database/services';
import { useFoodPortions } from '@/hooks/useFoodPortions';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { manualEntryCarbsConvention, totalCarbsFromSource } from '@/utils/carbsConvention';
import { deleteFoodImage, saveFoodImage } from '@/utils/file';
import { getFoodPortionIconComponent } from '@/utils/foodPortionIcons';
import { handleError } from '@/utils/handleError';
import {
  getDecimalSeparator,
  parseLocalizedDecimalString,
  sanitizeLocalizedDecimalInput,
} from '@/utils/localizedDecimalInput';
import { showSnackbar } from '@/utils/snackbarService';
import { getMassUnitLabel, gramsToDisplay } from '@/utils/unitConversion';

import { BarcodeCameraModal } from './BarcodeCameraModal';
import { FoodMealTrackingDetailsModal } from './FoodMealTrackingDetailsModal';
import { FullScreenModal } from './FullScreenModal';
import { PortionSizesPickerModal } from './PortionSizesPickerModal';

type NewCustomFoodModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: (data: any) => void;
  trackFoodAfterSave?: boolean;
  /** When false, the "Try AI Camera" option in FoodNotFoundModal is hidden. Defaults to true. */
  isAiEnabled?: boolean;
  /** Pre-selected meal type to use when tracking the newly created food. */
  initialMealType?: MealType;
};

export default function CreateCustomFoodModal({
  visible,
  onClose,
  onSave,
  trackFoodAfterSave = false,
  isAiEnabled = true,
  initialMealType,
}: NewCustomFoodModalProps) {
  const theme = useTheme();
  const { units, includeFiberInCarbs } = useSettings();
  const [permission, requestPermission] = useCameraPermissions();
  const [isBarcodeScannerVisible, setIsBarcodeScannerVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createdFood, setCreatedFood] = useState<Food | null>(null);
  const [isFoodDetailsVisible, setIsFoodDetailsVisible] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [barcode, setBarcode] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [micronutrients, setMicronutrients] = useState({
    sugar: '',
    alcohol: '',
    monoFat: '',
    polyFat: '',
    monounsaturatedFat: '',
    saturatedFat: '',
    transFat: '',
    unsaturatedFat: '',
    zinc: '',
    vitaminK: '',
    vitaminC: '',
    vitaminB12: '',
    vitaminA: '',
    vitaminE: '',
    thiamin: '',
    selenium: '',
    vitaminB6: '',
    pantothenicAcid: '',
    niacin: '',
    calcium: '',
    iodine: '',
    molybdenum: '',
    vitaminD: '',
    manganese: '',
    magnesium: '',
    folicAcid: '',
    copper: '',
    iron: '',
    chromium: '',
    caffeine: '',
    cholesterol: '',
    phosphorus: '',
    chloride: '',
    folate: '',
    biotin: '',
    sodium: '',
    riboflavin: '',
    potassium: '',
  });
  const [microOpen, setMicroOpen] = useState(false);
  const [showPortionPicker, setShowPortionPicker] = useState(false);
  const [selectedPortionIds, setSelectedPortionIds] = useState<string[]>([]);
  const [nutritionBasis, setNutritionBasis] = useState<'per_100g' | 'per_serving'>('per_100g');
  const [servingName, setServingName] = useState('');

  useEffect(() => {
    if (!visible) {
      const reset = () => {
        setIsFoodDetailsVisible(false);
        setIsBarcodeScannerVisible(false);
        setShowPortionPicker(false);
      };
      reset();
    }
  }, [visible]);

  const { t, i18n } = useTranslation();
  const decimalSeparator = useMemo(
    () => getDecimalSeparator(i18n.resolvedLanguage ?? i18n.language),
    [i18n.resolvedLanguage, i18n.language]
  );

  const {
    portions,
    isLoading: isLoadingPortions,
    refresh: refreshPortions,
  } = useFoodPortions({
    mode: 'all',
    visible: visible,
    // Must match PortionSizesPickerModal so selected user/custom portions resolve for chips
    includeAllPortionSources: true,
  });
  const { formatInteger } = useFormatAppNumber();

  const selectedPortionsOrdered = useMemo(() => {
    return selectedPortionIds
      .map((id) => portions.find((p) => p.id === id))
      .filter((p): p is FoodPortion => p != null);
  }, [selectedPortionIds, portions]);

  const isSaveDisabled = !foodName.trim();

  const handleRemovePortion = (portionId: string) => {
    setSelectedPortionIds((prev) => prev.filter((id) => id !== portionId));
  };

  const handleSave = async () => {
    const foodData = {
      foodName,
      brand,
      barcode,
      imageUrl,
      isFavorite,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      micronutrients,
    };

    // If caller wants to track food after save, create the Food in DB here
    if (trackFoodAfterSave) {
      setIsSaving(true);
      try {
        // Parse numeric values
        const parsedFiber = Math.max(0, parseLocalizedDecimalString(fiber, decimalSeparator));
        const nutrition = {
          calories: Math.max(0, parseLocalizedDecimalString(calories, decimalSeparator)),
          protein: Math.max(0, parseLocalizedDecimalString(protein, decimalSeparator)),
          // The DB always stores total carbs. The entered value is total or net depending on the
          // user's "include fiber in carbs" setting; normalize to total before saving.
          carbs: totalCarbsFromSource(manualEntryCarbsConvention(includeFiberInCarbs), {
            carbs: Math.max(0, parseLocalizedDecimalString(carbs, decimalSeparator)),
            fiber: parsedFiber,
          }),
          fat: Math.max(0, parseLocalizedDecimalString(fat, decimalSeparator)),
          fiber: parsedFiber,
        };

        // Determine serving amount/unit based on selected portion
        let servingAmount = 100;
        let servingUnit = 'g';

        if (nutritionBasis === 'per_100g' && selectedPortionIds.length > 0) {
          // Use the first selected portion as the default serving size
          const selectedPortion = portions.find((p) => selectedPortionIds.includes(p.id));
          if (selectedPortion?.gramWeight != null) {
            servingAmount = selectedPortion.gramWeight;
            servingUnit = selectedPortion.name.toLowerCase();
          }
        }

        const newFood = await FoodService.createCustomFood(
          foodName,
          nutrition,
          brand || undefined,
          servingAmount,
          servingUnit,
          description || undefined,
          {
            nutritionBasis,
            servingName:
              servingName.trim() || foodName.trim() || t('food.newCustomFood.oneServing'),
            selectedPortionIds,
            imageUrl: imageUrl || undefined,
          }
        );

        setCreatedFood(newFood);

        // Call onSave with created food object for parent if provided
        if (onSave) {
          onSave({ ...foodData, createdFood: newFood });
        }

        // Open FoodDetailsModal to allow tracking/editing the newly created food
        setIsFoodDetailsVisible(true);
      } catch (err) {
        handleError(err, 'CreateCustomFoodModal.handleSave', {
          snackbarMessage: t('food.newCustomFood.errorSaving'),
        });
      } finally {
        setIsSaving(false);
      }

      // Keep the modal open while the details modal is shown; parent closes after details modal if needed
      return;
    }

    // Default behavior: call onSave and close
    if (onSave) {
      onSave({ ...foodData, nutritionBasis, servingName, selectedPortionIds });
    }
    onClose();
  };

  const handleNumericChange = (value: string, setter: (val: string) => void) => {
    setter(sanitizeLocalizedDecimalInput(value, decimalSeparator, 2));
  };

  const handleMicronutrientChange = (key: keyof typeof micronutrients, value: string) => {
    setMicronutrients((prev) => ({
      ...prev,
      [key]: sanitizeLocalizedDecimalInput(value, decimalSeparator, 2),
    }));
  };

  const openBarcodeScanner = () => {
    setIsBarcodeScannerVisible(true);
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showSnackbar('error', t('food.smartCamera.galleryPermissionRequired'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const permanentUri = await saveFoodImage(result.assets[0].uri, imageUrl || undefined);
        setImageUrl(permanentUri);
      }
    } catch (error) {
      handleError(error, 'CreateCustomFoodModal.handlePickImage', {
        snackbarMessage: t('food.newCustomFood.errorSaving'),
      });
    }
  };

  const handleRemoveImage = async () => {
    if (imageUrl) {
      await deleteFoodImage(imageUrl);
    }
    setImageUrl('');
  };

  const micronutrientsData = [
    {
      key: 'sugar' as const,
      label: t('food.newCustomFood.sugar'),
      value: micronutrients.sugar,
      icon: IceCream,
      iconColor: theme.colors.status.pink500,
      variant: 'accent' as const,
    },
    {
      key: 'alcohol' as const,
      label: t('food.newCustomFood.alcohol'),
      value: micronutrients.alcohol,
      icon: Wine,
      iconColor: theme.colors.status.indigo,
      variant: 'info' as const,
    },
    {
      key: 'monoFat' as const,
      label: t('food.newCustomFood.monounsatFat'),
      value: micronutrients.monoFat,
      icon: Droplet,
      iconColor: theme.colors.status.teal400,
      variant: 'success' as const,
    },
    {
      key: 'polyFat' as const,
      label: t('food.newCustomFood.polyunsatFat'),
      value: micronutrients.polyFat,
      icon: Waves,
      iconColor: theme.colors.status.violet500,
      variant: 'warning' as const,
    },
    {
      key: 'monounsaturatedFat' as const,
      label: t('food.newCustomFood.monounsatFat'),
      value: micronutrients.monounsaturatedFat,
      icon: Droplet,
      iconColor: theme.colors.status.emerald,
      variant: 'success' as const,
    },
    {
      key: 'saturatedFat' as const,
      label: 'Saturated Fat',
      value: micronutrients.saturatedFat,
      icon: Heart,
      iconColor: theme.colors.status.red400,
      variant: 'error' as const,
    },
    {
      key: 'transFat' as const,
      label: 'Trans Fat',
      value: micronutrients.transFat,
      icon: Zap,
      iconColor: theme.colors.status.amber,
      variant: 'warning' as const,
    },
    {
      key: 'unsaturatedFat' as const,
      label: 'Unsaturated Fat',
      value: micronutrients.unsaturatedFat,
      icon: Waves,
      iconColor: theme.colors.status.teal400,
      variant: 'success' as const,
    },
    {
      key: 'zinc' as const,
      label: 'Zinc',
      value: micronutrients.zinc,
      icon: Shield,
      iconColor: theme.colors.status.emeraldVeryLight,
      variant: 'default' as const,
    },
    {
      key: 'vitaminK' as const,
      label: 'Vitamin K',
      value: micronutrients.vitaminK,
      icon: Pill,
      iconColor: theme.colors.status.purple400,
      variant: 'accent' as const,
    },
    {
      key: 'vitaminC' as const,
      label: 'Vitamin C',
      value: micronutrients.vitaminC,
      icon: Sun,
      iconColor: theme.colors.status.amber,
      variant: 'warning' as const,
    },
    {
      key: 'vitaminB12' as const,
      label: 'Vitamin B12',
      value: micronutrients.vitaminB12,
      icon: Thermometer,
      iconColor: theme.colors.status.pink500,
      variant: 'accent' as const,
    },
    {
      key: 'vitaminA' as const,
      label: 'Vitamin A',
      value: micronutrients.vitaminA,
      icon: Carrot,
      iconColor: theme.colors.status.amber,
      variant: 'warning' as const,
    },
    {
      key: 'vitaminE' as const,
      label: 'Vitamin E',
      value: micronutrients.vitaminE,
      icon: Sparkles,
      iconColor: theme.colors.status.yellow,
      variant: 'warning' as const,
    },
    {
      key: 'thiamin' as const,
      label: 'Thiamin',
      value: micronutrients.thiamin,
      icon: Pill,
      iconColor: theme.colors.status.indigo,
      variant: 'info' as const,
    },
    {
      key: 'selenium' as const,
      label: 'Selenium',
      value: micronutrients.selenium,
      icon: Beaker,
      iconColor: theme.colors.status.emeraldVeryLight,
      variant: 'default' as const,
    },
    {
      key: 'vitaminB6' as const,
      label: 'Vitamin B6',
      value: micronutrients.vitaminB6,
      icon: Thermometer,
      iconColor: theme.colors.status.purple400,
      variant: 'accent' as const,
    },
    {
      key: 'pantothenicAcid' as const,
      label: 'Pantothenic Acid',
      value: micronutrients.pantothenicAcid,
      icon: Apple,
      iconColor: theme.colors.status.teal400,
      variant: 'success' as const,
    },
    {
      key: 'niacin' as const,
      label: 'Niacin',
      value: micronutrients.niacin,
      icon: Pill,
      iconColor: theme.colors.status.indigo,
      variant: 'info' as const,
    },
    {
      key: 'calcium' as const,
      label: 'Calcium',
      value: micronutrients.calcium,
      icon: Battery,
      iconColor: theme.colors.status.emeraldVeryLight,
      variant: 'default' as const,
    },
    {
      key: 'iodine' as const,
      label: 'Iodine',
      value: micronutrients.iodine,
      icon: TestTube,
      iconColor: theme.colors.status.purple400,
      variant: 'accent' as const,
    },
    {
      key: 'molybdenum' as const,
      label: 'Molybdenum',
      value: micronutrients.molybdenum,
      icon: Beaker,
      iconColor: theme.colors.status.emeraldVeryLight,
      variant: 'default' as const,
    },
    {
      key: 'vitaminD' as const,
      label: 'Vitamin D',
      value: micronutrients.vitaminD,
      icon: Sun,
      iconColor: theme.colors.status.amber,
      variant: 'warning' as const,
    },
    {
      key: 'manganese' as const,
      label: 'Manganese',
      value: micronutrients.manganese,
      icon: Beaker,
      iconColor: theme.colors.status.emeraldVeryLight,
      variant: 'default' as const,
    },
    {
      key: 'magnesium' as const,
      label: 'Magnesium',
      value: micronutrients.magnesium,
      icon: Battery,
      iconColor: theme.colors.status.emeraldVeryLight,
      variant: 'default' as const,
    },
    {
      key: 'folicAcid' as const,
      label: 'Folic Acid',
      value: micronutrients.folicAcid,
      icon: Pill,
      iconColor: theme.colors.status.pink500,
      variant: 'accent' as const,
    },
    {
      key: 'copper' as const,
      label: 'Copper',
      value: micronutrients.copper,
      icon: Battery,
      iconColor: theme.colors.status.amber,
      variant: 'warning' as const,
    },
    {
      key: 'iron' as const,
      label: 'Iron',
      value: micronutrients.iron,
      icon: Battery,
      iconColor: theme.colors.status.red400,
      variant: 'error' as const,
    },
    {
      key: 'chromium' as const,
      label: 'Chromium',
      value: micronutrients.chromium,
      icon: Beaker,
      iconColor: theme.colors.status.emeraldVeryLight,
      variant: 'default' as const,
    },
    {
      key: 'caffeine' as const,
      label: 'Caffeine',
      value: micronutrients.caffeine,
      icon: Zap,
      iconColor: theme.colors.status.amber,
      variant: 'warning' as const,
    },
    {
      key: 'cholesterol' as const,
      label: 'Cholesterol',
      value: micronutrients.cholesterol,
      icon: Heart,
      iconColor: theme.colors.status.red400,
      variant: 'error' as const,
    },
    {
      key: 'phosphorus' as const,
      label: 'Phosphorus',
      value: micronutrients.phosphorus,
      icon: Battery,
      iconColor: theme.colors.status.emeraldVeryLight,
      variant: 'default' as const,
    },
    {
      key: 'chloride' as const,
      label: 'Chloride',
      value: micronutrients.chloride,
      icon: TestTube,
      iconColor: theme.colors.status.emeraldVeryLight,
      variant: 'default' as const,
    },
    {
      key: 'folate' as const,
      label: 'Folate',
      value: micronutrients.folate,
      icon: Pill,
      iconColor: theme.colors.status.greenDark,
      variant: 'success' as const,
    },
    {
      key: 'biotin' as const,
      label: 'Biotin',
      value: micronutrients.biotin,
      icon: Stethoscope,
      iconColor: theme.colors.status.purple400,
      variant: 'accent' as const,
    },
    {
      key: 'sodium' as const,
      label: 'Sodium',
      value: micronutrients.sodium,
      icon: Battery,
      iconColor: theme.colors.status.emeraldVeryLight,
      variant: 'default' as const,
    },
    {
      key: 'riboflavin' as const,
      label: 'Riboflavin',
      value: micronutrients.riboflavin,
      icon: Pill,
      iconColor: theme.colors.status.indigo,
      variant: 'info' as const,
    },
    {
      key: 'potassium' as const,
      label: 'Potassium',
      value: micronutrients.potassium,
      icon: Battery,
      iconColor: theme.colors.status.emeraldVeryLight,
      variant: 'default' as const,
    },
  ];

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        scrollable={false}
        title={t('food.newCustomFood.title')}
        footer={
          <Button
            label={t('common.save')}
            variant="gradientCta"
            size="md"
            width="full"
            disabled={isSaveDisabled || isSaving}
            loading={isSaving}
            icon={PlusCircle}
            onPress={handleSave}
          />
        }
      >
        <KeyboardAwareScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          bottomOffset={16}
        >
          <View className="gap-6 px-4 pb-40 pt-6">
            {/* Food Name */}
            <TextInput
              label={t('food.newCustomFood.foodName')}
              value={foodName}
              onChangeText={setFoodName}
              placeholder={t('food.newCustomFood.foodNamePlaceholder')}
              icon={<Pencil size={theme.iconSize.md} color={theme.colors.text.tertiary} />}
              required
            />

            <BarcodeInput
              label={t('food.newCustomFood.barcode')}
              value={barcode}
              onChangeText={setBarcode}
              placeholder={t('food.newCustomFood.barcodePlaceholder')}
              onScanPress={openBarcodeScanner}
            />

            {/* Brand */}
            <TextInput
              label={t('food.newCustomFood.brand')}
              value={brand}
              onChangeText={setBrand}
              placeholder={t('food.newCustomFood.brandPlaceholder')}
              icon={<Cookie size={theme.iconSize.md} color={theme.colors.text.tertiary} />}
            />

            {/* Description */}
            <TextInput
              label={t('food.newCustomFood.description')}
              value={description}
              onChangeText={setDescription}
              placeholder={t('food.newCustomFood.descriptionPlaceholder')}
              icon={<AlignLeft size={theme.iconSize.md} color={theme.colors.text.tertiary} />}
              multiline
            />

            {/* Food Photo */}
            <View>
              <Text className="mb-2 ml-1 text-sm font-medium text-text-secondary">
                {t('common.photo')}
              </Text>
              {imageUrl ? (
                <View className="relative h-48 w-full overflow-hidden rounded-2xl">
                  <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
                  <View className="absolute bottom-2 right-2 flex-row gap-2">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('food.newCustomFood.addPhoto')}
                      onPress={handlePickImage}
                      style={{
                        width: 40,
                        height: 40,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: theme.borderRadius.lg,
                        backgroundColor: theme.colors.background.overlay,
                        borderWidth: theme.borderWidth.thin,
                        borderColor: theme.colors.border.default,
                      }}
                    >
                      <Camera size={theme.iconSize.sm} color={theme.colors.accent.secondary} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('common.delete')}
                      onPress={handleRemoveImage}
                      style={{
                        width: 40,
                        height: 40,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: theme.borderRadius.lg,
                        backgroundColor: theme.colors.background.overlay,
                        borderWidth: theme.borderWidth.thin,
                        borderColor: theme.colors.border.default,
                      }}
                    >
                      <Trash2 size={theme.iconSize.sm} color={theme.colors.status.error} />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('food.newCustomFood.addPhoto')}
                  onPress={handlePickImage}
                  className="h-32 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-white/5"
                >
                  <Camera size={theme.iconSize.xl} color={theme.colors.text.tertiary} />
                  <Text className="mt-2 text-sm text-text-tertiary">
                    {t('food.newCustomFood.addPhoto')}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Favorite Toggle */}
            <ToggleInput
              items={[
                {
                  key: 'favorite',
                  label: t('food.newCustomFood.addToFavorites'),
                  icon: (
                    <Heart
                      size={theme.iconSize.md}
                      color={isFavorite ? theme.colors.status.red400 : theme.colors.text.tertiary}
                      fill={isFavorite ? theme.colors.status.red400 : 'transparent'}
                    />
                  ),
                  value: isFavorite,
                  onValueChange: setIsFavorite,
                },
              ]}
            />

            {/* Portion Sizes */}
            <View>
              <Text className="mb-2 ml-1 text-sm font-medium text-text-secondary">
                {t('food.foodDetails.serving')}
              </Text>
              <FilterTabs
                tabs={[
                  { id: 'per_100g', label: t('food.portions.100g') },
                  {
                    id: 'per_serving',
                    label: t('food.foodDetails.perServing'),
                  },
                ]}
                activeTab={nutritionBasis}
                onTabChange={(id) => setNutritionBasis(id as 'per_100g' | 'per_serving')}
                showContainer={false}
              />
            </View>

            {nutritionBasis === 'per_serving' ? (
              <TextInput
                label={t('food.foodDetails.servingName')}
                value={servingName}
                onChangeText={setServingName}
                placeholder={t('food.foodDetails.servingNamePlaceholder')}
              />
            ) : null}

            <View>
              <Text className="mb-2 ml-1 text-sm font-medium text-text-secondary">
                {t('food.newCustomFood.portionSizes')}
              </Text>
              {isLoadingPortions ? (
                <SkeletonLoader width="100%" height={56} borderRadius={theme.borderRadius.lg} />
              ) : (
                <View
                  style={{
                    gap: theme.spacing.gap.base,
                  }}
                >
                  {selectedPortionsOrdered.length === 0 ? (
                    <Text className="mb-1 ml-1 text-sm text-text-tertiary">
                      {t('food.newCustomFood.selectPortionSizes')}
                    </Text>
                  ) : null}
                  {selectedPortionsOrdered.map((portion) => {
                    const IconComponent = getFoodPortionIconComponent(portion.icon) ?? Scale;
                    const displayWeight =
                      portion.gramWeight != null ? gramsToDisplay(portion.gramWeight, units) : null;
                    const gramsLabel =
                      displayWeight != null ? formatInteger(Math.round(displayWeight)) : null;
                    const massUnit = getMassUnitLabel(units);
                    return (
                      <View
                        key={portion.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderRadius: theme.borderRadius.lg,
                          borderWidth: 1,
                          borderColor: theme.colors.background.white20,
                          backgroundColor: theme.colors.background.secondary,
                          paddingHorizontal: theme.spacing.padding.md,
                          paddingVertical: theme.spacing.padding.sm,
                          gap: theme.spacing.gap.sm,
                        }}
                      >
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            flexShrink: 0,
                            borderRadius: theme.borderRadius.md,
                            backgroundColor: theme.colors.accent.primary10,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconComponent
                            size={theme.iconSize.md}
                            color={theme.colors.accent.primary}
                          />
                        </View>
                        <Text
                          className="min-w-0 flex-1 text-base font-medium text-text-primary"
                          numberOfLines={2}
                        >
                          {portion.name}
                        </Text>
                        <View
                          style={{
                            flexShrink: 0,
                            borderRadius: theme.borderRadius.full,
                            backgroundColor: theme.colors.status.emerald,
                            paddingHorizontal: theme.spacing.padding.sm,
                            paddingVertical: theme.spacing.padding.xs,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: theme.typography.fontSize.sm,
                              fontWeight: theme.typography.fontWeight.semibold,
                              color: theme.colors.text.white,
                            }}
                          >
                            {displayWeight != null
                              ? `(${gramsLabel}${massUnit})`
                              : t('food.foodDetails.namedServing')}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('food.newCustomFood.removePortion')}
                          hitSlop={12}
                          style={{ flexShrink: 0 }}
                          onPress={() => handleRemovePortion(portion.id)}
                        >
                          <X size={theme.iconSize.md} color={theme.colors.text.tertiary} />
                        </Pressable>
                      </View>
                    );
                  })}
                  <Button
                    variant="dashed"
                    width="full"
                    size="sm"
                    icon={Plus}
                    disabled={isLoadingPortions}
                    onPress={() => setShowPortionPicker(true)}
                    label={
                      selectedPortionIds.length === 0
                        ? t('food.newCustomFood.addPortionSizes')
                        : t('food.newCustomFood.addAnotherPortion')
                    }
                  />
                </View>
              )}
            </View>

            {/* Macronutrients Header */}
            <View className="flex-row items-center gap-2">
              <BarChart size={theme.iconSize.lg} color={theme.colors.accent.primary} />
              <Text className="text-xl font-bold text-text-primary">
                {t('food.newCustomFood.macronutrients')}
              </Text>
            </View>

            <Text className="text-sm text-text-secondary">
              {includeFiberInCarbs
                ? t('food.newCustomFood.carbsHintTotal')
                : t('food.newCustomFood.carbsHintNet')}
            </Text>

            {/* Calories */}
            <MacroInput
              label={t('food.newCustomFood.calories')}
              value={calories}
              onChange={(value) => handleNumericChange(value, setCalories)}
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

            {/* Macro Grid */}
            <View className="flex-row flex-wrap gap-4">
              <MacroInput
                label={t('food.newCustomFood.protein')}
                value={protein}
                onChange={(value) => handleNumericChange(value, setProtein)}
                allowDecimals
                topRightElement={
                  <Dumbbell size={theme.iconSize.sm} color={theme.colors.status.emeraldLight} />
                }
                variant="success"
                size="half"
              />
              <MacroInput
                label={
                  includeFiberInCarbs
                    ? t('food.newCustomFood.carbsTotal')
                    : t('food.newCustomFood.carbsNet')
                }
                value={carbs}
                onChange={(value) => handleNumericChange(value, setCarbs)}
                allowDecimals
                topRightElement={
                  <Cookie size={theme.iconSize.sm} color={theme.colors.status.amber} />
                }
                variant="warning"
                size="half"
              />
              <MacroInput
                label={t('food.newCustomFood.fat')}
                value={fat}
                onChange={(value) => handleNumericChange(value, setFat)}
                allowDecimals
                topRightElement={
                  <Droplet size={theme.iconSize.sm} color={theme.colors.status.red400} />
                }
                variant="error"
                size="half"
              />
              <MacroInput
                label={t('food.newCustomFood.fiber')}
                value={fiber}
                onChange={(value) => handleNumericChange(value, setFiber)}
                allowDecimals
                topRightElement={
                  <Leaf size={theme.iconSize.sm} color={theme.colors.status.purple400} />
                }
                variant="accent"
                size="half"
              />
            </View>

            {/* Micronutrients Accordion */}
            <View>
              <Pressable
                className="flex-row items-center justify-between py-4"
                onPress={() => setMicroOpen(!microOpen)}
              >
                <View className="flex-row items-center gap-2">
                  <FlaskConical size={theme.iconSize.lg} color={theme.colors.accent.primary} />
                  <Text className="text-xl font-bold text-text-primary">
                    {t('food.newCustomFood.micronutrients')}
                  </Text>
                </View>
                <ChevronDown
                  size={theme.iconSize.lg}
                  color={theme.colors.text.tertiary}
                  style={{
                    transform: [{ rotate: microOpen ? '180deg' : '0deg' }],
                  }}
                />
              </Pressable>

              {microOpen ? (
                <View className="flex-row flex-wrap gap-4">
                  {micronutrientsData.map((nutrient) => (
                    <MacroInput
                      key={nutrient.key}
                      label={nutrient.label}
                      value={nutrient.value}
                      onChange={(value: string) => handleMicronutrientChange(nutrient.key, value)}
                      allowDecimals
                      topRightElement={
                        <nutrient.icon size={theme.iconSize.sm} color={nutrient.iconColor} />
                      }
                      variant={nutrient.variant}
                      size="half"
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </KeyboardAwareScrollView>
        {isFoodDetailsVisible && createdFood ? (
          <FoodMealTrackingDetailsModal
            visible={isFoodDetailsVisible}
            onClose={() => {
              setIsFoodDetailsVisible(false);
              setCreatedFood(null);
              // After closing the details modal, close the create modal as well
              onClose();
            }}
            food={createdFood}
            isAiEnabled={isAiEnabled}
            initialMealType={initialMealType}
          />
        ) : null}
        <PortionSizesPickerModal
          visible={showPortionPicker}
          onClose={() => setShowPortionPicker(false)}
          ownerType="food"
          onConfirm={async (selectedIds) => {
            setSelectedPortionIds(selectedIds);
            await refreshPortions();
            setShowPortionPicker(false);
          }}
          selectedIds={selectedPortionIds}
        />
        {isBarcodeScannerVisible ? (
          <BarcodeCameraModal
            visible={isBarcodeScannerVisible}
            onClose={() => setIsBarcodeScannerVisible(false)}
            onBarcodeScanned={(data) => setBarcode(data)}
            showBarcodeTextSearch={true}
            permissionGranted={permission?.granted ?? null}
            onRequestPermission={requestPermission}
          />
        ) : null}
      </FullScreenModal>
    </>
  );
}
