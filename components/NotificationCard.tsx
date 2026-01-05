import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { theme } from '../theme';

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
  type,
  icon,
  iconBg,
  title,
  description,
  time,
  unread,
  hasAction,
  onActionPress,
}: NotificationCardProps) {
  const isAiInsight = type === 'ai-insight';

  const content = (
    <View className="flex-row gap-4">
      {/* Icon */}
      <View
        className={`${iconBg} h-14 w-14 flex-shrink-0 items-center justify-center rounded-full`}>
        {icon}
      </View>

      {/* Content */}
      <View className="min-w-0 flex-1">
        <View className="mb-2 flex-row items-start justify-between gap-2">
          <Text className="text-lg font-semibold text-text-primary">{title}</Text>
          {unread && (
            <View className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-accent-secondary" />
          )}
        </View>
        <View className="mb-3">
          {typeof description === 'string' ? (
            <Text className="text-[15px] leading-relaxed text-gray-300">{description}</Text>
          ) : (
            description
          )}
        </View>

        <View className="flex-row items-center justify-between">
          {hasAction ? (
            <>
              <Pressable className="rounded-full bg-white px-6 py-2.5" onPress={onActionPress}>
                <Text className="text-sm font-semibold text-black">Start Now</Text>
              </Pressable>
              <Text className="text-sm text-gray-500">{time}</Text>
            </>
          ) : (
            <Text className="text-sm text-gray-500">{time}</Text>
          )}
        </View>
      </View>
    </View>
  );

  if (isAiInsight) {
    return (
      <LinearGradient
        colors={['#1a3d2f', theme.colors.background.cardDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-3xl border-2 border-border-accent p-5">
        {content}
      </LinearGradient>
    );
  }

  return <View className="rounded-3xl bg-bg-cardDark p-5">{content}</View>;
}
