import { LucideIcon, RefreshCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type ErrorStateCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  buttonLabel?: string;
  onButtonPress?: () => void;
};

export function ErrorStateCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  onButtonPress,
}: ErrorStateCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const defaultButtonLabel = buttonLabel || t('common.tryAgain');
  return (
    <View className="border-status-error/20 bg-status-error/5 flex-col items-center gap-4 rounded-lg border-2 border-dashed p-6">
      {/* Icon */}
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: theme.colors.status.error10 }}
      >
        <Icon size={theme.iconSize.xl} color={theme.colors.status.error} />
      </View>

      {/* Content */}
      <View className="items-center">
        <Text className="text-text-primary mb-1 text-center font-bold">{title}</Text>
        <Text className="text-text-secondary text-center text-sm">{description}</Text>
      </View>

      {/* Button */}
      {onButtonPress ? (
        <Pressable
          className="border-accent-primary mt-2 flex-row items-center gap-2 rounded-lg border px-6 py-2 active:scale-95"
          onPress={onButtonPress}
        >
          <RefreshCw size={theme.iconSize.sm} color={theme.colors.accent.primary} />
          <Text className="text-accent-primary text-sm font-bold">{defaultButtonLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
