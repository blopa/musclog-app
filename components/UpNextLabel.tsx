import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

export function UpNextLabel() {
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
