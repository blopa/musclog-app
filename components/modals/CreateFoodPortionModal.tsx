import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { theme } from '../../theme';
import { Button } from '../theme/Button';
import { FullScreenModal } from './FullScreenModal';

const FOOD_ICONS = [
  'restaurant',
  'ramen-dining',
  'dinner-dining',
  'bakery-dining',
  'local-cafe',
  'nutrition',
] as const;

type CreateFoodPortionModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreatePortion?: (portion: {
    name: string;
    weight: number;
    icon: string;
  }) => void;
};

export function CreateFoodPortionModal({
  visible,
  onClose,
  onCreatePortion,
}: CreateFoodPortionModalProps) {
  const [portionName, setPortionName] = useState('');
  const [weight, setWeight] = useState('100');
  const [selectedIcon, setSelectedIcon] = useState('ramen-dining');

  const handleCreatePortion = () => {
    if (portionName.trim() && weight && selectedIcon) {
      onCreatePortion?.({
        name: portionName.trim(),
        weight: parseInt(weight, 10),
        icon: selectedIcon,
      });
      // Reset form
      setPortionName('');
      setWeight('100');
      setSelectedIcon('ramen-dining');
      onClose();
    }
  };

  const handleCancel = () => {
    // Reset form
    setPortionName('');
    setWeight('100');
    setSelectedIcon('ramen-dining');
    onClose();
  };

  const decrementWeight = () => {
    const currentWeight = parseInt(weight, 10) || 0;
    if (currentWeight > 0) {
      setWeight(String(currentWeight - 10));
    }
  };

  const incrementWeight = () => {
    const currentWeight = parseInt(weight, 10) || 0;
    setWeight(String(currentWeight + 10));
  };

  const footer = (
    <View className="flex-row gap-4">
      <Button
        label="Cancel"
        variant="secondary"
        onPress={handleCancel}
        width="flex-1"
        size="lg"
      />
      <Button
        label="Create Portion"
        onPress={handleCreatePortion}
        width="flex-2"
        size="lg"
        variant="gradientCta"
      />
    </View>
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title="Create Food Portion"
      footer={footer}
    >
      <View className="flex-1 px-4 pt-4">
        <View className="space-y-6">
          {/* Portion Name Input */}
          <View className="space-y-2">
            <Text className="text-text-muted text-[10px] font-bold uppercase tracking-[0.15em] px-1">
              Portion Name
            </Text>
            <TextInput
              className="block w-full rounded-xl border border-border-dark bg-card-dark/50 py-4 px-4 text-white placeholder-text-muted/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
              placeholder="e.g., Large Bowl or Slice"
              placeholderTextColor={theme.colors.text.muted}
              value={portionName}
              onChangeText={setPortionName}
              style={{
                color: theme.colors.text.primary,
                backgroundColor: theme.colors.background.cardElevated,
                borderColor: theme.colors.border.dark,
                borderRadius: theme.borderRadius.xl,
              }}
            />
          </View>

          {/* Weight Input */}
          <View className="space-y-2">
            <Text className="text-text-muted text-[10px] font-bold uppercase tracking-[0.15em] px-1">
              Weight (grams)
            </Text>
            <View className="flex-row items-center gap-3">
              <Pressable
                className="w-14 h-14 rounded-xl bg-card-dark border border-border-dark/50 flex items-center justify-center active:bg-border-dark/30 transition-all"
                onPress={decrementWeight}
                style={{
                  backgroundColor: theme.colors.background.card,
                  borderColor: theme.colors.border.dark,
                }}
              >
                <MaterialIcons
                  name="remove"
                  size={theme.iconSize.lg}
                  color={theme.colors.text.primary}
                />
              </Pressable>
              <View className="flex-1 relative">
                <TextInput
                  className="block w-full text-center rounded-xl border border-border-dark bg-card-dark/50 py-4 px-4 font-bold text-xl focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                  style={{
                    color: theme.colors.text.primary,
                    backgroundColor: theme.colors.background.cardElevated,
                    borderColor: theme.colors.border.dark,
                    borderRadius: theme.borderRadius.xl,
                    fontSize: theme.typography.fontSize['2xl'],
                    fontWeight: theme.typography.fontWeight.bold,
                    textAlign: 'center',
                  }}
                />
                <Text
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted/50 font-medium"
                  style={{
                    color: theme.colors.text.muted,
                    top: '50%',
                    transform: [{ translateY: -12 }],
                  }}
                >
                  g
                </Text>
              </View>
              <Pressable
                className="w-14 h-14 rounded-xl bg-card-dark border border-border-dark/50 flex items-center justify-center active:bg-border-dark/30 transition-all"
                onPress={incrementWeight}
                style={{
                  backgroundColor: theme.colors.background.card,
                  borderColor: theme.colors.border.dark,
                }}
              >
                <MaterialIcons
                  name="add"
                  size={theme.iconSize.lg}
                  color={theme.colors.text.primary}
                />
              </Pressable>
            </View>
          </View>

          {/* Icon Selection */}
          <View className="space-y-3">
            <Text className="text-text-muted text-[10px] font-bold uppercase tracking-[0.15em] px-1">
              Select Icon
            </Text>
            <View
              className="rounded-xl p-3"
              style={{
                backgroundColor: theme.colors.background.secondary,
                borderColor: theme.colors.border.dark,
                borderWidth: 1,
              }}
            >
              <View className="flex-row gap-3 overflow-x-auto">
                {FOOD_ICONS.map((icon) => (
                  <Pressable
                    key={icon}
                    className="flex-shrink-0"
                    onPress={() => setSelectedIcon(icon)}
                  >
                    <View
                      className="w-14 h-14 rounded-xl flex items-center justify-center transition-all"
                      style={{
                        backgroundColor: selectedIcon === icon
                          ? theme.colors.accent.primary20
                          : theme.colors.background.cardElevated,
                        borderColor: selectedIcon === icon
                          ? theme.colors.accent.primary
                          : theme.colors.border.dark,
                        borderWidth: 1,
                        ...(selectedIcon === icon && {
                          shadowColor: theme.colors.accent.primary,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.4,
                          shadowRadius: 8,
                          elevation: 4,
                        }),
                      }}
                    >
                      <MaterialIcons
                        name={icon}
                        size={theme.iconSize.lg}
                        color={
                          selectedIcon === icon
                            ? theme.colors.accent.primary
                            : theme.colors.text.primary
                        }
                      />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
