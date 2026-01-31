import { lazy, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { theme } from '../../theme';
import { GenericCard } from './GenericCard';
const Button = lazy(() => import('../theme/Button').then(({ Button }) => ({ default: Button })));

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
                color: theme.colors.text.gray300,
              }}
            >
              {description}
            </Text>
          ) : (
            description
          )}
        </View>

        <View className="flex-row items-center justify-between">
          {hasAction ? (
            <>
              <Button
                label={t('notifications.startNow')}
                size="sm"
                width="auto"
                onPress={onActionPress}
              />
              <Text className="text-sm" style={{ color: theme.colors.text.gray500 }}>
                {time}
              </Text>
            </>
          ) : (
            <Text className="text-sm" style={{ color: theme.colors.text.gray500 }}>
              {time}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <GenericCard variant="highlighted">
      <View className="p-5">{content}</View>
    </GenericCard>
  );
}
