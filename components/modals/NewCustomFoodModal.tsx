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
            <View>
              <Text className="mb-2 ml-1 text-sm font-medium text-text-secondary">Food Name</Text>
              <View className="relative">
                <RNTextInput
                  value={foodName}
                  onChangeText={setFoodName}
                  placeholder="e.g., Homemade Chicken Salad"
                  placeholderTextColor={theme.colors.text.tertiary + '80'}
                  className="h-14 w-full rounded-xl border border-white/10 bg-bg-card px-4 pr-12 text-lg font-medium text-text-primary"
                  style={{
                    borderColor: theme.colors.background.white10,
                  }}
                />
                <View
                  className="absolute right-4"
                  style={{
                    top: '50%',
                    transform: [{ translateY: -theme.iconSize.md / 2 }],
                  }}>
                  <Pencil size={theme.iconSize.md} color={theme.colors.text.tertiary} />
                </View>
              </View>
            </View>

            {/* Barcode */}
            <View>
              <Text className="mb-2 ml-1 text-sm font-medium text-text-secondary">
                Barcode (Optional)
              </Text>
              <View className="relative flex-row items-center">
                <RNTextInput
                  value={barcode}
                  onChangeText={setBarcode}
                  placeholder="Scan or enter barcode"
                  placeholderTextColor={theme.colors.text.tertiary + '80'}
                  className="h-14 flex-1 rounded-xl border border-white/10 bg-bg-card px-4 pr-14 text-lg font-medium text-text-primary"
                  style={{
                    borderColor: theme.colors.background.white10,
                  }}
                />
                <Pressable
                  className="absolute right-2 rounded-lg p-2"
                  style={{ backgroundColor: theme.colors.accent.primary10 }}>
                  <ScanLine size={theme.iconSize.md} color={theme.colors.accent.primary} />
                </Pressable>
              </View>
            </View>

            {/* Measurement Unit */}
            <View>
              <Text className="mb-2 ml-1 text-sm font-medium text-text-secondary">
                Measurement Unit
              </Text>
              <View
                className="h-12 rounded-xl bg-bg-card p-1"
                style={{ backgroundColor: theme.colors.background.card }}>
                <View className="h-full flex-row">
                  {measurementOptions.map((option) => (
                    <Pressable
                      key={option.value}
                      className={`h-full flex-1 items-center justify-center rounded-lg px-2 ${
                        measurementUnit === option.value ? 'bg-bg-cardElevated' : ''
                      }`}
                      onPress={() => setMeasurementUnit(option.value as MeasurementUnit)}
                      style={
                        measurementUnit === option.value
                          ? {
                              backgroundColor: theme.colors.background.cardElevated,
                              shadowColor: theme.colors.background.black10,
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 1,
                              shadowRadius: 2,
                              elevation: 1,
                            }
                          : {}
                      }>
                      <Text
                        className={`text-sm font-semibold ${
                          measurementUnit === option.value
                            ? 'text-text-primary'
                            : 'text-text-tertiary'
                        }`}>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
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
                onChangeText={setCalories}
                placeholder="0"
                placeholderTextColor={theme.colors.text.tertiary + '50'}
                keyboardType="numeric"
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
          onChangeText={onChange}
          placeholder="0"
          placeholderTextColor={theme.colors.text.tertiary + '50'}
          keyboardType="numeric"
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
