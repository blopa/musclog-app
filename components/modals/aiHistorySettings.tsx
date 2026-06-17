import type { TFunction } from 'i18next';
import { CalendarRange, Dumbbell } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUpMenu, type BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';
import { PickerButton } from '@/components/theme/PickerButton';
import type { NutritionLogHistoryDays, WorkoutHistoryDays } from '@/constants/settings';
import { useTheme } from '@/hooks/useTheme';

/** Both history settings share the same day-count union. */
type HistoryDays = NutritionLogHistoryDays | WorkoutHistoryDays;

type HistoryKind = 'nutrition' | 'workout';

type HistoryConfig = {
  /** Translation-key prefix under `settings.aiSettings`, e.g. `nutritionLogHistoryDays`. */
  keyPrefix: string;
  icon: ComponentType<{ size: number; color: string }>;
};

const HISTORY_DAY_OPTIONS: readonly HistoryDays[] = ['none', '7', '30', '60', '90'];

const HISTORY_CONFIG: Record<HistoryKind, HistoryConfig> = {
  nutrition: { keyPrefix: 'nutritionLogHistoryDays', icon: CalendarRange },
  workout: { keyPrefix: 'workoutHistoryDays', icon: Dumbbell },
};

function optionLabel(t: TFunction, keyPrefix: string, option: HistoryDays): string {
  return t(`settings.aiSettings.${keyPrefix}${option === 'none' ? 'None' : option}`);
}

function buildMenuItems(
  t: TFunction,
  { keyPrefix, icon }: HistoryConfig,
  style: { iconColor: string; iconBgColor: string },
  onSelect: (value: HistoryDays) => void
): BottomPopUpMenuItem[] {
  return HISTORY_DAY_OPTIONS.map((option) => ({
    icon,
    iconColor: style.iconColor,
    iconBgColor: style.iconBgColor,
    title: optionLabel(t, keyPrefix, option),
    description:
      option === 'none'
        ? t(`settings.aiSettings.${keyPrefix}NoneDescription`)
        : t(`settings.aiSettings.${keyPrefix}OptionDescription`, { days: option }),
    onPress: () => onSelect(option),
  }));
}

type HistoryPickerFieldProps = {
  kind: HistoryKind;
  value: HistoryDays;
  onChange: (value: HistoryDays) => void;
};

/**
 * Bordered "history days" picker card plus its selection menu. Used by both the main
 * AI settings screen and the coach quick-settings modal; `kind` switches the translation
 * keys and icon between the nutrition-log and workout variants.
 */
export function HistoryPickerField({ kind, value, onChange }: HistoryPickerFieldProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [menuVisible, setMenuVisible] = useState(false);

  const config = HISTORY_CONFIG[kind];
  const Icon = config.icon;
  const title = t(`settings.aiSettings.${config.keyPrefix}`);
  const subtitle = t(`settings.aiSettings.${config.keyPrefix}Subtitle`);

  const menuItems = buildMenuItems(
    t,
    config,
    { iconColor: theme.colors.accent.primary, iconBgColor: theme.colors.accent.primary10 },
    (option) => {
      onChange(option);
      setMenuVisible(false);
    }
  );

  return (
    <>
      <View
        className="rounded-lg border bg-bg-card p-4"
        style={{ borderColor: theme.colors.border.light, borderWidth: theme.borderWidth.thin }}
      >
        <Text className="mb-3 text-sm font-medium text-text-secondary">{title}</Text>
        <PickerButton
          label={optionLabel(t, config.keyPrefix, value)}
          icon={<Icon size={theme.iconSize.lg} color={theme.colors.text.secondary} />}
          onPress={() => setMenuVisible(true)}
        />
        <Text className="mt-3 text-xs text-text-secondary">{subtitle}</Text>
      </View>

      <BottomPopUpMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        title={title}
        subtitle={subtitle}
        items={menuItems}
      />
    </>
  );
}
