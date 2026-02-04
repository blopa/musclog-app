import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { theme } from '../../theme';
import { Button } from '../theme/Button';
import { StepperInput } from '../theme/StepperInput';
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
  onCreatePortion?: (portion: { name: string; weight: number; icon: string }) => void;
};

export function CreateFoodPortionModal({
  visible,
  onClose,
  onCreatePortion,
}: CreateFoodPortionModalProps) {
  const [portionName, setPortionName] = useState('');
  const [weight, setWeight] = useState(100);
  const [selectedIcon, setSelectedIcon] = useState('ramen-dining');

  const handleCreatePortion = () => {
    if (portionName.trim() && weight && selectedIcon) {
      onCreatePortion?.({
        name: portionName.trim(),
        weight: weight,
        icon: selectedIcon,
      });
      // Reset form
      setPortionName('');
      setWeight(100);
      setSelectedIcon('ramen-dining');
      onClose();
    }
  };

  const handleCancel = () => {
    // Reset form
    setPortionName('');
    setWeight(100);
    setSelectedIcon('ramen-dining');
    onClose();
  };

  const incrementWeight = () => {
    setWeight(weight + 10);
  };

  const decrementWeight = () => {
    if (weight > 0) {
      setWeight(weight - 10);
    }
  };

  const footer = (
    <View className="flex-row gap-4">
      <Button label="Cancel" variant="secondary" onPress={handleCancel} width="flex-1" size="lg" />
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
            <Text className="px-1 text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">
              Portion Name
            </Text>
            <TextInput
              className="bg-card-dark/50 focus:border-primary focus:ring-primary block w-full rounded-xl border border-border-dark px-4 py-4 text-white placeholder-text-muted/50 transition-all focus:outline-none focus:ring-1"
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
          <StepperInput
            label="Weight (grams)"
            value={weight}
            onIncrement={incrementWeight}
            onDecrement={decrementWeight}
            onChangeValue={setWeight}
            unit="g"
          />

          {/* Icon Selection */}
          <View className="space-y-3">
            <Text className="px-1 text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">
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
                      className="flex h-14 w-14 items-center justify-center rounded-xl transition-all"
                      style={{
                        backgroundColor:
                          selectedIcon === icon
                            ? theme.colors.accent.primary20
                            : theme.colors.background.cardElevated,
                        borderColor:
                          selectedIcon === icon
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
