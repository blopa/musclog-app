import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';

export function UpNextLabel() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View className="flex-row items-start justify-between">
      <View className="flex-1" />
      <View
        className="rounded-full border bg-accent-primary/10 px-2"
        style={{
          borderColor: theme.colors.accent.primary20,
          paddingVertical: theme.spacing.padding.xsHalf,
        }}
      >
        <Text
          className="font-bold uppercase tracking-widest text-accent-primary"
          style={{ fontSize: theme.typography.fontSize.xs }}
        >
          {t('restTimer.upNext')}
        </Text>
      </View>
    </View>
  );
}
