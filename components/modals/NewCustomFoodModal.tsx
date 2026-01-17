import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { useTranslation } from 'react-i18next';
import { Button } from '../theme/Button';
import { TextInput } from '../theme/TextInput';
import { SegmentedControl } from '../theme/SegmentedControl';
import { CaloriesInput } from '../CaloriesInput';

type MeasurementUnit = '100g' | 'serving' | 'container';

type NewCustomFoodModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: (data: any) => void;
};

export default function NewCustomFoodModal({ visible, onClose, onSave }: NewCustomFoodModalProps) {
  const router = useRouter();
  const [foodName, setFoodName] = useState('');
  const [barcode, setBarcode] = useState('');
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
    console.log('Saving food:', {
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
    });
    // Navigate back or show success
    router.back();
  };

  const handleCancel = () => {
    router.back();
  };

  // Filter to only allow numeric input
  const handleNumericChange = (value: string, setter: (val: string) => void) => {
    // Remove any non-numeric characters (allow digits only)
    const numericValue = value.replace(/[^0-9]/g, '');
    setter(numericValue);
  };

  const measurementOptions = [
    { label: 'Per 100g', value: '100g' },
    { label: 'Per Serving', value: 'serving' },
    { label: 'Container', value: 'container' },
  ];

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('food.newCustomFood.title')}>
      <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
        {/* Main Content */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-6 px-4 pb-40 pt-6">
            {/* Food Name */}
            <TextInput
              label="Food Name"
              value={foodName}
              onChangeText={setFoodName}
              placeholder="e.g., Homemade Chicken Salad"
              icon={<Pencil size={theme.iconSize.md} color={theme.colors.text.tertiary} />}
            />

            {/* Barcode */}
            <View className="relative">
              <TextInput
                label="Barcode (Optional)"
                value={barcode}
                onChangeText={setBarcode}
                placeholder="Scan or enter barcode"
              />
              <Pressable
                className="absolute right-2 items-center justify-center"
                style={{
                  top: theme.size['18'] / 2,
                  width: theme.size['10'],
                  height: theme.size['10'],
                  backgroundColor: theme.colors.accent.primary10,
                  borderRadius: theme.borderRadius.sm,
                }}>
                <ScanLine size={theme.iconSize.md} color={theme.colors.accent.primary} />
              </Pressable>
            </View>

            {/* Measurement Unit */}
            <View>
              <Text className="mb-2 ml-1 text-sm font-medium text-text-secondary">
                Measurement Unit
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
              <Text className="text-xl font-bold text-text-primary">Macronutrients</Text>
            </View>

            {/* Calories */}
            <CaloriesInput
              label="Calories"
              value={calories}
              onChange={(value) => handleNumericChange(value, setCalories)}
              topRightElement={
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: theme.colors.accent.primary10 }}>
                  <Text className="text-xs font-medium text-accent-primary">kcal</Text>
                </View>
              }
              variant="default"
              size="full"
            />

            {/* Macro Grid */}
            <View className="flex-row flex-wrap gap-4">
              <CaloriesInput
                label="Protein"
                value={protein}
                onChange={(value) => handleNumericChange(value, setProtein)}
                topRightElement={
                  <Dumbbell size={theme.iconSize.sm} color={theme.colors.status.emeraldLight} />
                }
                variant="success"
                size="half"
              />
              <CaloriesInput
                label="Carbs"
                value={carbs}
                onChange={(value) => handleNumericChange(value, setCarbs)}
                topRightElement={
                  <Cookie size={theme.iconSize.sm} color={theme.colors.status.amber} />
                }
                variant="warning"
                size="half"
              />
              <CaloriesInput
                label="Fat"
                value={fat}
                onChange={(value) => handleNumericChange(value, setFat)}
                topRightElement={
                  <Droplet size={theme.iconSize.sm} color={theme.colors.status.red400} />
                }
                variant="error"
                size="half"
              />
              <CaloriesInput
                label="Fiber"
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
                onPress={() => setMicroOpen(!microOpen)}>
                <View className="flex-row items-center gap-2">
                  <FlaskConical size={theme.iconSize.lg} color={theme.colors.accent.primary} />
                  <Text className="text-xl font-bold text-text-primary">Micronutrients</Text>
                </View>
                <ChevronDown
                  size={theme.iconSize.lg}
                  color={theme.colors.text.tertiary}
                  style={{
                    transform: [{ rotate: microOpen ? '180deg' : '0deg' }],
                  }}
                />
              </Pressable>

              {microOpen && (
                <View className="flex-row flex-wrap gap-4">
                  <CaloriesInput
                    label="Sugar"
                    value={sugar}
                    onChange={(value) => handleNumericChange(value, setSugar)}
                    topRightElement={
                      <IceCream size={theme.iconSize.sm} color={theme.colors.status.pink500} />
                    }
                    variant="accent"
                    size="half"
                  />
                  <CaloriesInput
                    label="Alcohol"
                    value={alcohol}
                    onChange={(value) => handleNumericChange(value, setAlcohol)}
                    topRightElement={
                      <Wine size={theme.iconSize.sm} color={theme.colors.status.indigo} />
                    }
                    variant="info"
                    size="half"
                  />
                  <CaloriesInput
                    label="Monounsat. Fat"
                    value={monoFat}
                    onChange={(value) => handleNumericChange(value, setMonoFat)}
                    topRightElement={
                      <Droplet size={theme.iconSize.sm} color={theme.colors.status.teal400} />
                    }
                    variant="accent"
                    size="half"
                  />
                  <CaloriesInput
                    label="Polyunsat. Fat"
                    value={polyFat}
                    onChange={(value) => handleNumericChange(value, setPolyFat)}
                    topRightElement={
                      <Waves size={theme.iconSize.sm} color={theme.colors.status.violet500} />
                    }
                    variant="accent"
                    size="half"
                  />
                </View>
              )}
            </View>
          </View>
          <View className="gap-3 px-4 pb-8 pt-4">
            <Button
              label={t('common.save')}
              variant="gradientCta"
              size="md"
              width="full"
              icon={PlusCircle}
              onPress={handleSave}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </FullScreenModal>
  );
}
