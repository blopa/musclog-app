import { Edit, Ruler } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export type HeightPickerInputProps = {
  /** Total height in inches. */
  totalInches: number;
  onPress: () => void;
  label?: string;
  hideLabel?: boolean;
  /** When true, show placeholder text instead of a real height (e.g. unset). */
  unset?: boolean;
  unsetPlaceholder?: string;
  disabled?: boolean;
  /** Tailwind classes on the outer wrapper `View`. */
  className?: string;
};

/** Format total inches as "5 ft 7 in". */
export function formatImperialHeight(totalInches: number): string {
  const totalRounded = Math.round(totalInches);
  const feet = Math.floor(totalRounded / 12);
  const inches = totalRounded % 12;
  return `${feet} ft ${inches} in`;
}

export function HeightPickerInput({
  totalInches,
  onPress,
  label,
  hideLabel = false,
  unset = false,
  unsetPlaceholder,
  disabled = false,
  className,
}: HeightPickerInputProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const showUnsetPlaceholder = Boolean(unset && unsetPlaceholder);
  const display = formatImperialHeight(totalInches);

  return (
    <View className={className}>
      {!hideLabel ? (
        <Text className="ml-1 mb-2 text-sm font-medium text-text-secondary">
          {label ?? t('editFitnessDetails.height')}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        className="rounded-lg border border-white/10 bg-bg-cardDark"
        onPress={onPress}
        disabled={disabled}
      >
        <View className="flex-row items-center justify-between p-3">
          <View className="min-w-0 flex-1 flex-row items-center gap-2">
            <View
              className="h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.colors.status.indigo20 }}
            >
              <Ruler size={theme.iconSize.sm} color={theme.colors.accent.primary} />
            </View>
            <View className="min-w-0 flex-1">
              {showUnsetPlaceholder ? (
                <Text className="font-medium text-text-tertiary">{unsetPlaceholder}</Text>
              ) : (
                <Text className="font-medium text-text-primary">{display}</Text>
              )}
            </View>
          </View>
          <View className="shrink-0 justify-center pl-2">
            <Edit size={theme.iconSize.xs} color={theme.colors.text.secondary} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}
