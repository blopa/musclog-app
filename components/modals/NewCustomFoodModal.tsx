import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput as RNTextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Pencil,
  ScanLine,
  BarChart,
  Dumbbell,
  Cookie,
  Droplet,
  Leaf,
  FlaskConical,
  IceCream,
  Wine,
  Waves,
  ChevronDown,
  PlusCircle,
} from 'lucide-react-native';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { useTranslation } from 'react-i18next';
import { Button } from '../theme/Button';
import { TextInput } from '../theme/TextInput';
import { SegmentedControl } from '../theme/SegmentedControl';

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
                  top: 36, // Label (~20px) + gap-2 (8px) + (input height 56px - button height 40px) / 2 = 28 + 8 = 36
                  width: 40,
                  height: 40,
                  backgroundColor: theme.colors.accent.primary10,
                  borderRadius: 8,
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
            <View
              className="rounded-xl border border-white/10 bg-bg-card p-5"
              style={{
                borderColor: theme.colors.background.white10,
                shadowColor: theme.colors.accent.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.1,
                shadowRadius: 15,
                elevation: 2,
              }}>
              <View className="mb-1 flex-row items-start justify-between">
                <Text className="text-xs font-bold uppercase tracking-widest text-text-secondary">
                  Calories
                </Text>
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: theme.colors.accent.primary10 }}>
                  <Text className="text-xs font-medium text-accent-primary">kcal</Text>
                </View>
              </View>
              <RNTextInput
                value={calories}
                onChangeText={(value) => handleNumericChange(value, setCalories)}
                placeholder="0"
                placeholderTextColor={theme.colors.text.tertiary + '50'}
                keyboardType="numeric"
                selectTextOnFocus
                className="w-full border-0 bg-transparent p-0 text-5xl font-bold text-text-primary"
                style={{
                  fontSize: 48,
                  lineHeight: 56,
                }}
              />
            </View>

            {/* Macro Grid */}
            <View className="flex-row flex-wrap gap-4">
              <MacroInput
                label="Protein"
                icon={Dumbbell}
                color="#29e08e"
                value={protein}
                onChange={setProtein}
              />
              <MacroInput
                label="Carbs"
                icon={Cookie}
                color="#fbbf24"
                value={carbs}
                onChange={setCarbs}
              />
              <MacroInput
                label="Fat"
                icon={Droplet}
                color="#f87171"
                value={fat}
                onChange={setFat}
              />
              <MacroInput
                label="Fiber"
                icon={Leaf}
                color="#a78bfa"
                value={fiber}
                onChange={setFiber}
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
                  <MacroInput
                    label="Sugar"
                    icon={IceCream}
                    color="#ec4899"
                    value={sugar}
                    onChange={setSugar}
                  />
                  <MacroInput
                    label="Alcohol"
                    icon={Wine}
                    color="#6366f1"
                    value={alcohol}
                    onChange={setAlcohol}
                  />
                  <MacroInput
                    label="Monounsat. Fat"
                    icon={Droplet}
                    color="#2dd4bf"
                    value={monoFat}
                    onChange={setMonoFat}
                    smallLabel
                  />
                  <MacroInput
                    label="Polyunsat. Fat"
                    icon={Waves}
                    color="#8b5cf6"
                    value={polyFat}
                    onChange={setPolyFat}
                    smallLabel
                  />
                </View>
              )}
            </View>
          </View>
          <View className="gap-3 pb-8 pt-4 px-4">
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

type MacroInputProps = {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  value: string;
  onChange: (val: string) => void;
  smallLabel?: boolean;
};

function MacroInput({
  label,
  icon: Icon,
  color,
  value,
  onChange,
  smallLabel = false,
}: MacroInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View
      className="rounded-xl border bg-bg-card p-4"
      style={{
        width: '47%',
        borderColor: isFocused ? color : theme.colors.background.white10,
        backgroundColor: theme.colors.background.card,
        shadowColor: isFocused ? color : 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: isFocused ? 2 : 0,
      }}>
      <View className="mb-2 flex-row items-center justify-between">
        <Text
          className={`font-bold uppercase tracking-wider text-text-secondary ${
            smallLabel ? 'text-[10px] tracking-tight' : 'text-xs'
          }`}>
          {label}
        </Text>
        <Icon size={theme.iconSize.sm} color={color} />
      </View>
      <View className="flex-row items-baseline">
        <RNTextInput
          value={value}
          onChangeText={(text) => {
            // Filter to only allow numeric input
            const numericValue = text.replace(/[^0-9]/g, '');
            onChange(numericValue);
          }}
          placeholder="0"
          placeholderTextColor={theme.colors.text.tertiary + '50'}
          keyboardType="numeric"
          selectTextOnFocus
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="flex-1 border-0 bg-transparent p-0 text-3xl font-bold text-text-primary"
          style={{
            fontSize: 30,
            lineHeight: 36,
          }}
        />
        <Text className="ml-1 text-sm font-medium text-text-secondary">g</Text>
      </View>
      {isFocused && (
        <View
          className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl"
          style={{ backgroundColor: color }}
        />
      )}
    </View>
  );
}
