import type { LucideIcon } from 'lucide-react-native';
import {
  Apple,
  Coffee,
  Droplet,
  EggFried,
  Flame,
  Soup,
  UtensilsCrossed,
  Wheat,
  Zap,
} from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';

import { MenuButton } from '@/components/theme/MenuButton';
import { ZoomableThumbnail } from '@/components/ZoomableThumbnail';
import { type MealType } from '@/database/models';
import { useEnergyUnit } from '@/hooks/useEnergyUnit';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { blurFilter } from '@/utils/blurFilter';

import { CardSelectionCheck } from './CardSelectionCheck';
import { GenericCard } from './GenericCard';

type MealGroupCardProps = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: MealType;
  imageUrl?: string;
  onPress?: () => void;
  onMorePress?: () => void;
  onLongPress?: () => void;
  /** A selection is running: the menu button gives way to a checkbox. */
  selectionMode?: boolean;
  selected?: boolean;
  intuitiveMode?: boolean;
  /** Compact: small photo, one-line name, kcal only (macros are in the details modal). */
  variant?: 'default' | 'compact';
  /** Exact time the meal was eaten, shown in the time-grouped diary. */
  timeLabel?: string;
};

const MacroItem = ({
  icon: Icon,
  value,
  label,
  unit,
  shortLabel,
  valueMode = 'decimal1',
  intuitiveMode = false,
}: {
  icon: LucideIcon;
  value: number;
  label?: string;
  unit?: string;
  shortLabel?: string;
  valueMode?: 'integer' | 'decimal1';
  intuitiveMode?: boolean;
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger, formatRoundedDecimal } = useFormatAppNumber();

  const displayValue =
    valueMode === 'integer'
      ? formatInteger(Math.round(value), { useGrouping: false })
      : formatRoundedDecimal(value, 1);

  return (
    <View className="flex-row items-center gap-1">
      <Icon size={12} color={theme.colors.text.secondary} />
      <Text
        className="text-xs text-text-secondary"
        style={intuitiveMode ? blurFilter(4) : undefined}
      >
        {t('food.macroValueFormat', {
          value: intuitiveMode ? '0' : displayValue,
          unit: unit || '',
          label: label || shortLabel || '',
        })}
      </Text>
    </View>
  );
};

const getMealIconAndColor = (
  mealType: MealType,
  theme: ReturnType<typeof useTheme>
): { Icon: typeof UtensilsCrossed; bgColor: string; iconColor: string } => {
  switch (mealType) {
    case 'breakfast':
      return {
        Icon: EggFried,
        bgColor: theme.colors.status.warning10,
        iconColor: theme.colors.status.warning,
      };
    case 'lunch':
      return {
        Icon: Soup,
        bgColor: theme.colors.status.brandVivid10,
        iconColor: theme.colors.status.brandVivid,
      };
    case 'dinner':
      return {
        Icon: UtensilsCrossed,
        bgColor: theme.colors.status.indigo10,
        iconColor: theme.colors.status.indigo,
      };
    case 'snack':
      return {
        Icon: Apple,
        bgColor: theme.colors.status.amber10,
        iconColor: theme.colors.status.amber,
      };
    case 'other':
      return {
        Icon: Coffee,
        bgColor: theme.colors.status.neutralWash,
        iconColor: theme.colors.text.secondary,
      };
    default:
      return {
        Icon: UtensilsCrossed,
        bgColor: theme.colors.status.indigo10,
        iconColor: theme.colors.status.indigo,
      };
  }
};

export const MealGroupCard = memo(function MealGroupCard({
  name,
  calories,
  protein,
  carbs,
  fat,
  mealType,
  imageUrl,
  onPress,
  onMorePress,
  onLongPress,
  selectionMode = false,
  selected = false,
  intuitiveMode = false,
  variant = 'default',
  timeLabel,
}: MealGroupCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { toDisplay, unitLabel } = useEnergyUnit();
  const isCompact = variant === 'compact';

  const { Icon, bgColor, iconColor } = getMealIconAndColor(mealType, theme);

  // While a selection runs the menu button gives way to the card's checkbox.
  let trailingControl = null;
  if (selectionMode) {
    trailingControl = <CardSelectionCheck selected={selected} />;
  } else if (onMorePress) {
    trailingControl = <MenuButton size="md" onPress={onMorePress} className="flex-shrink-0" />;
  }

  return (
    <GenericCard
      variant="flat"
      isPressable={!!onPress}
      onPress={onPress}
      onLongPress={onLongPress}
      selected={selected}
    >
      <View className={`flex-row items-center ${isCompact ? 'gap-3 px-4 py-2' : 'gap-4 p-4'}`}>
        {/* Meal icon or photo */}
        <View
          className={`flex-shrink-0 items-center justify-center overflow-hidden rounded-control ${
            isCompact ? 'h-10 w-10' : 'h-16 w-16'
          }`}
          style={{ backgroundColor: imageUrl ? undefined : bgColor }}
        >
          {imageUrl ? (
            <ZoomableThumbnail uri={imageUrl}>
              <Image
                source={{ uri: imageUrl }}
                className={isCompact ? 'h-10 w-10' : 'h-16 w-16'}
                resizeMode="cover"
              />
            </ZoomableThumbnail>
          ) : (
            <Icon size={theme.iconSize.lg} color={iconColor} />
          )}
        </View>

        <View className="min-w-0 flex-1">
          {/* Meal name + badge */}
          <View className="mb-1 flex-row items-center gap-2">
            <Text
              className={`flex-1 font-semibold text-text-primary ${isCompact ? 'text-base' : 'text-lg'}`}
              numberOfLines={isCompact ? 1 : 2}
            >
              {name}
            </Text>
            <View
              className="rounded-tag px-2 py-0.5"
              style={{ backgroundColor: theme.colors.status.indigo10 }}
            >
              <Text className="text-xs font-semibold" style={{ color: theme.colors.status.indigo }}>
                {t('food.mealGroup.badge')}
              </Text>
            </View>
          </View>

          {/* Calories row */}
          <View className="mb-0.5 flex-row flex-wrap items-center gap-x-3 gap-y-0.5">
            {timeLabel ? (
              <Text className="text-xs font-semibold tabular-nums text-text-primary">
                {timeLabel}
              </Text>
            ) : null}
            <MacroItem
              icon={Flame}
              value={toDisplay(calories)}
              label={unitLabel}
              valueMode="integer"
              intuitiveMode={intuitiveMode}
            />
          </View>

          {/* Macros row */}
          {isCompact ? null : (
            <View className="flex-row flex-wrap items-center gap-x-3 gap-y-0.5">
              <MacroItem
                icon={Zap}
                value={protein}
                label={t('food.macros.protein')}
                shortLabel={t('food.macros.proteinShort')}
                unit="g"
                intuitiveMode={intuitiveMode}
              />
              <MacroItem
                icon={Wheat}
                value={carbs}
                label={t('food.macros.carbs')}
                shortLabel={t('food.macros.carbsShort')}
                unit="g"
                intuitiveMode={intuitiveMode}
              />
              <MacroItem
                icon={Droplet}
                value={fat}
                label={t('food.macros.fat')}
                shortLabel={t('food.macros.fatShort')}
                unit="g"
                intuitiveMode={intuitiveMode}
              />
            </View>
          )}
        </View>

        {trailingControl}
      </View>
    </GenericCard>
  );
});
