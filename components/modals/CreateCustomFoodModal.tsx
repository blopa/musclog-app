import {
  BarChart,
  ChevronDown,
  Cookie,
  Droplet,
  Dumbbell,
  FlaskConical,
  IceCream,
  Leaf,
  Pencil,
  PlusCircle,
  ScanLine,
  Waves,
  Wine,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { theme } from '../../theme';
import { MacroInput } from '../MacroInput';
import { Button } from '../theme/Button';
import { SegmentedControl } from '../theme/SegmentedControl';
import { TextInput } from '../theme/TextInput';
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
  const [barcode, setBarcode] = useState('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>('100g');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [alcohol, setAlcohol] = useState('');
  const [monoFat, setMonoFat] = useState('');
  const [polyFat, setPolyFat] = useState('');
  const [microOpen, setMicroOpen] = useState(false);
  const { t } = useTranslation();

  const handleSave = () => {
    const foodData = {
      foodName,
      barcode,
      measurementUnit,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      sugar,
      alcohol,
      monoFat,
      polyFat,
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
                <MacroInput
                  label={t('food.newCustomFood.sugar')}
                  value={sugar}
                  onChange={(value) => handleNumericChange(value, setSugar)}
                  topRightElement={
                    <IceCream size={theme.iconSize.sm} color={theme.colors.status.pink500} />
                  }
                  variant="accent"
                  size="half"
                />
                <MacroInput
                  label={t('food.newCustomFood.alcohol')}
                  value={alcohol}
                  onChange={(value) => handleNumericChange(value, setAlcohol)}
                  topRightElement={
                    <Wine size={theme.iconSize.sm} color={theme.colors.status.indigo} />
                  }
                  variant="info"
                  size="half"
                />
                <MacroInput
                  label={t('food.newCustomFood.monounsatFat')}
                  value={monoFat}
                  onChange={(value) => handleNumericChange(value, setMonoFat)}
                  topRightElement={
                    <Droplet size={theme.iconSize.sm} color={theme.colors.status.teal400} />
                  }
                  variant="accent"
                  size="half"
                />
                <MacroInput
                  label={t('food.newCustomFood.polyunsatFat')}
                  value={polyFat}
                  onChange={(value) => handleNumericChange(value, setPolyFat)}
                  topRightElement={
                    <Waves size={theme.iconSize.sm} color={theme.colors.status.violet500} />
                  }
                  variant="accent"
                  size="half"
                />
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
