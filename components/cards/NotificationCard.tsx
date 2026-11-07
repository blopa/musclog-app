import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './GenericCard';

type NotificationCardProps = {
  type: 'ai-insight' | 'workout-reminder' | 'workout-completed' | 'kudos' | 'weekly-report';
  icon: ReactNode;
  iconBg: string;
  title: string;
  description: ReactNode;
  time: string;
  unread?: boolean;
  hasAction?: boolean;
  onActionPress?: () => void;
};

export function NotificationCard({
  type, // TODO: implement different styles based on type
  icon,
  iconBg,
  title,
  description,
  time,
  unread,
  hasAction,
  onActionPress,
}: NotificationCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const content = (
    <View className="flex-row gap-4">
      {/* Icon */}
      <View
        className="h-14 w-14 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </View>

      {/* Content */}
      <View className="min-w-0 flex-1">
        <View className="mb-2 flex-row items-start justify-between gap-2">
          <Text className="text-lg font-semibold text-text-primary">{title}</Text>
          {unread ? (
            <View className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-accent-secondary" />
          ) : null}
        </View>
        <View className="mb-3">
          {typeof description === 'string' ? (
            <Text
              className="leading-relaxed"
              style={{
                fontSize: theme.typography.fontSize.base,
                color: theme.colors.text.secondary,
              }}
            >
              {description}
            </Text>
          ) : (
            description
          )}
        </View>

        {/* The action and the time share the row while both fit; otherwise the time drops to its
            own line instead of being cut off by the card's edge. */}
        <View className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {hasAction ? (
            <>
              <Button
                label={t('notifications.startNow')}
                size="sm"
                width="auto"
                onPress={onActionPress}
              />
              <Text className="min-w-0 text-sm" style={{ color: theme.colors.text.tertiary }}>
                {time}
              </Text>
            </>
          ) : (
            <Text className="min-w-0 text-sm" style={{ color: theme.colors.text.tertiary }}>
              {time}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <GenericCard variant="flat">
      <View className="p-5">{content}</View>
    </GenericCard>
  );
}
