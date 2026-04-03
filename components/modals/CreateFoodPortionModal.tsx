import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useSettings } from '../../hooks/useSettings';
import { AvatarIcon } from '../../types/AvatarIcon';
import { getAvatarIcon } from '../../utils/avatarUtils';
import { displayToGrams, getMassUnitLabel, gramsToDisplay } from '../../utils/unitConversion';
import { AvatarSelector } from '../AvatarSelector';
import { Button } from '../theme/Button';
import { StepperInput } from '../theme/StepperInput';
import { TextInput } from '../theme/TextInput';
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
  const { units } = useSettings();
  const massUnit = getMassUnitLabel(units);
  const [portionName, setPortionName] = useState('');
  const [displayWeight, setDisplayWeight] = useState(100);
  const [selectedIcon, setSelectedIcon] = useState<FoodIcon>('ramen-dining');
  const { t } = useTranslation();

  // Initialize display weight based on units when modal becomes visible
  useEffect(() => {
    if (visible) {
      const initialGrams = 100;
      setDisplayWeight(gramsToDisplay(initialGrams, units));
    }
  }, [visible, units]);

  const handleCreatePortion = () => {
    if (portionName.trim() && displayWeight && selectedIcon) {
      const gramWeight = displayToGrams(displayWeight, units);
      onCreatePortion?.({
        name: portionName.trim(),
        weight: gramWeight,
        icon: selectedIcon,
      });
      // Reset form
      setPortionName('');
      setDisplayWeight(gramsToDisplay(100, units));
      setSelectedIcon('ramen-dining');
      onClose();
    }
  };

  const incrementWeight = () => {
    const step = units === 'imperial' ? 0.5 : 10;
    setDisplayWeight((prev) => Math.round((prev + step) * 10) / 10);
  };

  const decrementWeight = () => {
    const step = units === 'imperial' ? 0.5 : 10;
    setDisplayWeight((prev) => Math.max(0, Math.round((prev - step) * 10) / 10));
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
            <Text className="px-1 text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">
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
            label={units === 'imperial' ? t('food.unitOz') : t('weightGrams')}
            value={displayWeight}
            maxFractionDigits={units === 'imperial' ? 1 : 0}
            onIncrement={incrementWeight}
            onDecrement={decrementWeight}
            onChangeValue={setDisplayWeight}
            unit={massUnit}
          />

          {/* Icon Selection */}
          <View className="space-y-3">
            <Text className="px-1 text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">
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
