import MaterialIcons from '@react-native-vector-icons/material-icons/static';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';

type DailyHomeFooterProps = {
  steps: number | null;
  onStepsPress: () => void;
  energyBalance: {
    burned: number;
    eaten: number;
    balance: number;
    direction: 'deficit' | 'surplus' | 'even';
  } | null;
};

export function DailyHomeFooter({ steps, onStepsPress, energyBalance }: DailyHomeFooterProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();

  if (steps === null && !energyBalance) {
    return null;
  }

  return (
    <View className="mt-3 flex-row flex-wrap items-center gap-x-2 gap-y-1">
      {steps !== null ? <Pressable
          onPress={onStepsPress}
          className="flex-row items-center rounded-full px-2 py-1"
          style={{ backgroundColor: theme.colors.background.card }}
      >
          <MaterialIcons
            name="directions-walk"
            size={14}
            color={theme.colors.accent.primary}
            style={{ marginRight: 4 }}
          />
          <Text className="text-xs font-medium" style={{ color: theme.colors.text.primary }}>
            {formatInteger(steps)}
          </Text>
        </Pressable> : null}

      {energyBalance ? <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
          {t('home.energyBalance', {
            burned: formatInteger(energyBalance.burned),
            eaten: formatInteger(energyBalance.eaten),
            balance: formatInteger(energyBalance.balance),
            direction: t(`home.energyDirection.${energyBalance.direction}`),
          })}
        </Text> : null}
    </View>
  );
}
