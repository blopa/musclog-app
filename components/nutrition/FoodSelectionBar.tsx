import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { IconButton } from '@/components/theme/IconButton';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';

type FoodSelectionBarProps = {
  itemCount: number;
  calories: number;
  /** Intuitive eating hides calorie figures everywhere, this bar included. */
  intuitiveMode: boolean;
  onClose: () => void;
  onActionsPress: () => void;
};

/**
 * Pinned to the bottom of the food diary while a long-press selection runs: what is selected,
 * a way out, and the one button that opens what can be done with it.
 */
export function FoodSelectionBar({
  itemCount,
  calories,
  intuitiveMode,
  onClose,
  onActionsPress,
}: FoodSelectionBarProps) {
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();

  return (
    <View
      className="absolute bottom-0 left-0 right-0 flex-row items-center gap-3 border-t border-border-light bg-bg-card px-4 py-2"
      testID="food-selection-bar"
    >
      <IconButton
        icon={X}
        variant="ghost"
        size="sm"
        accessibilityLabel={t('food.selection.clear')}
        onPress={onClose}
      />
      <View className="min-w-0 flex-1">
        <Text className="text-base font-semibold tabular-nums text-text-primary" numberOfLines={1}>
          {t('food.selection.count', { count: itemCount })}
        </Text>
        {intuitiveMode ? null : (
          <Text className="text-xs tabular-nums text-text-secondary" numberOfLines={1}>
            {t('common.amount_kcal', {
              amount: formatInteger(Math.round(calories), { useGrouping: false }),
            })}
          </Text>
        )}
      </View>
      <Button
        label={t('food.selection.actions')}
        variant="accent"
        size="sm"
        onPress={onActionsPress}
        testID="food-selection-actions"
      />
    </View>
  );
}
