import {
  Activity,
  Apple,
  BarChart,
  Battery,
  Beaker,
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
  PlusCircle,
  ScanLine,
  Shield,
  Sparkles,
  Stethoscope,
  Sun,
  Syringe,
  TestTube,
  Thermometer,
  Waves,
  Wine,
  Zap,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { theme } from '../../theme';
import { MacroInput } from '../MacroInput';
import { Button } from '../theme/Button';
import { SegmentedControl } from '../theme/SegmentedControl';
import { TextInput } from '../theme/TextInput';
import { ToggleInput } from '../theme/ToggleInput';
import { BarcodeCameraModal } from './BarcodeCameraModal';
import { FullScreenModal } from './FullScreenModal';

type MeasurementUnit = '100g' | 'serving' | 'container';

type NewCustomFoodModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: (data: any) => void;
};

export default function CreateCustomFoodModal({
  visible,
  onClose,
  onSave,
}: NewCustomFoodModalProps) {
  const [foodName, setFoodName] = useState('');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>('100g');
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
  const { t } = useTranslation();

  const isSaveDisabled = !foodName.trim();

  const handleSave = () => {
    const foodData = {
      foodName,
      brand,
      barcode,
      imageUrl,
      isFavorite,
      measurementUnit,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      micronutrients,
    };

    if (onSave) {
      onSave(foodData);
    }
    onClose();
  };

  // Filter to only allow numeric input
  const handleNumericChange = (value: string, setter: (val: string) => void) => {
    // Remove any non-numeric characters (allow digits only)
    const numericValue = value.replace(/[^0-9]/g, '');
    setter(numericValue);
  };

  // Handle micronutrient changes
  const handleMicronutrientChange = (key: keyof typeof micronutrients, value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    setMicronutrients((prev) => ({
      ...prev,
      [key]: numericValue,
    }));
  };

  const handleBarcodeScanned = (scannedBarcode: string) => {
    setBarcode(scannedBarcode);
    setShowBarcodeScanner(false);
  };

  const openBarcodeScanner = () => {
    setShowBarcodeScanner(true);
  };

  const measurementOptions = [
    { label: t('food.newCustomFood.measurementOptions.per100g'), value: '100g' },
    { label: t('food.newCustomFood.measurementOptions.perServing'), value: 'serving' },
    { label: t('food.newCustomFood.measurementOptions.container'), value: 'container' },
  ];

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
      label: 'Monounsaturated Fat',
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
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('food.newCustomFood.title')}
      footer={
        <Button
          label={t('common.save')}
          variant="gradientCta"
          size="md"
          width="full"
          disabled={isSaveDisabled}
          icon={PlusCircle}
          onPress={handleSave}
        />
      }
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-6 px-4 pb-40 pt-6">
          {/* Food Name */}
          <TextInput
            label={t('food.newCustomFood.foodName')}
            value={foodName}
            onChangeText={setFoodName}
            placeholder={t('food.newCustomFood.foodNamePlaceholder')}
            icon={<Pencil size={theme.iconSize.md} color={theme.colors.text.tertiary} />}
          />

          {/* Barcode */}
          <View className="relative">
            <TextInput
              label={t('food.newCustomFood.barcode')}
              value={barcode}
              onChangeText={setBarcode}
              placeholder={t('food.newCustomFood.barcodePlaceholder')}
            />
            <Pressable
              className="absolute right-2 items-center justify-center"
              style={{
                ...(Platform.OS !== 'web'
                  ? {
                      top: theme.size['14'] / 2,
                    }
                  : {
                      top: theme.size['18'] / 2,
                    }),
                width: theme.size['10'],
                height: theme.size['10'],
                backgroundColor: theme.colors.accent.primary10,
                borderRadius: theme.borderRadius.sm,
              }}
              onPress={openBarcodeScanner}
            >
              <ScanLine size={theme.iconSize.md} color={theme.colors.accent.primary} />
            </Pressable>
          </View>

          {/* Brand */}
          <TextInput
            label={t('food.newCustomFood.brand')}
            value={brand}
            onChangeText={setBrand}
            placeholder={t('food.newCustomFood.brandPlaceholder')}
            icon={<Cookie size={theme.iconSize.md} color={theme.colors.text.tertiary} />}
          />

          {/* Image URL */}
          <TextInput
            label={t('food.newCustomFood.imageUrl')}
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder={t('food.newCustomFood.imageUrlPlaceholder')}
            icon={<Activity size={theme.iconSize.md} color={theme.colors.text.tertiary} />}
          />

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

          {/* Measurement Unit */}
          <View>
            <Text className="mb-2 ml-1 text-sm font-medium text-text-secondary">
              {t('food.newCustomFood.measurementUnit')}
            </Text>
            <SegmentedControl
              options={measurementOptions}
              value={measurementUnit}
              onValueChange={(value) => setMeasurementUnit(value as MeasurementUnit)}
              variant="elevated"
            />
          </View>

          {/* Macronutrients Header */}
          <View className="flex-row items-center gap-2">
            <BarChart size={theme.iconSize.lg} color={theme.colors.accent.primary} />
            <Text className="text-xl font-bold text-text-primary">
              {t('food.newCustomFood.macronutrients')}
            </Text>
          </View>

          {/* Calories */}
          <MacroInput
            label={t('food.newCustomFood.calories')}
            value={calories}
            onChange={(value) => handleNumericChange(value, setCalories)}
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
              topRightElement={
                <Dumbbell size={theme.iconSize.sm} color={theme.colors.status.emeraldLight} />
              }
              variant="success"
              size="half"
            />
            <MacroInput
              label={t('food.newCustomFood.carbs')}
              value={carbs}
              onChange={(value) => handleNumericChange(value, setCarbs)}
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
      </ScrollView>
      <BarcodeCameraModal
        visible={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onBarcodeScanned={handleBarcodeScanned}
      />
    </FullScreenModal>
  );
}
