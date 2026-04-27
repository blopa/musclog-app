import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AvatarSelector } from '@/components/AvatarSelector';
import { Button } from '@/components/theme/Button';
import { StepperInput } from '@/components/theme/StepperInput';
import { TextInput } from '@/components/theme/TextInput';
import { AvatarIcon } from '@/types/AvatarIcon';
import { getAvatarIcon } from '@/utils/avatarUtils';

import { FullScreenModal } from './FullScreenModal';

const FOOD_ICONS = [
  'restaurant',
  'ramen-dining',
  'dinner-dining',
  'bakery-dining',
  'local-cafe',
  'nutrition',
  'droplet',
  'scale',
  'egg',
  'cup',
  'lightbulb',
  'wind',
] as const;

type FoodIcon = (typeof FOOD_ICONS)[number];

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
  const [selectedIcon, setSelectedIcon] = useState<FoodIcon>('ramen-dining');
  const { t } = useTranslation();

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
      <Button
        label={t('createPortion')}
        onPress={handleCreatePortion}
        width="flex-2"
        size="sm"
        variant="gradientCta"
      />
    </View>
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('createFoodPortion')}
      footer={footer}
    >
      <View className="flex-1 px-4 pt-4">
        <View className="flex-col gap-6">
          {/* Portion Name Input */}
          <View className="space-y-2">
            <Text className="text-text-muted px-1 text-[10px] font-bold tracking-[0.15em] uppercase">
              {t('portionName')}
            </Text>
            <TextInput
              label={t('portionName')}
              value={portionName}
              onChangeText={setPortionName}
              placeholder={t('portionNamePlaceholder')}
              required
            />
          </View>

          {/* Weight Input */}
          <StepperInput
            label={t('weightGrams')}
            value={weight}
            maxFractionDigits={0}
            onIncrement={incrementWeight}
            onDecrement={decrementWeight}
            onChangeValue={setWeight}
            unit="g"
          />

          {/* Icon Selection */}
          <View className="space-y-3">
            <Text className="text-text-muted px-1 text-[10px] font-bold tracking-[0.15em] uppercase">
              {t('selectIcon')}
            </Text>
            <AvatarSelector
              avatarOptions={FOOD_ICONS.map((icon) => ({
                icon,
                component: getAvatarIcon(icon),
              }))}
              selectedAvatar={selectedIcon as AvatarIcon}
              onAvatarSelect={(avatar: AvatarIcon) => setSelectedIcon(avatar as FoodIcon)}
              selectedColor="emerald"
              label={t('chooseIcon')}
              showColorPicker={false}
            />
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
