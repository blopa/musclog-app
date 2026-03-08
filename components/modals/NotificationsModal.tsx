import { CheckCircle2, Clock, Dumbbell, Sparkles, ThumbsUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { NotificationCard } from '../cards/NotificationCard';
import { FullScreenModal } from './FullScreenModal';

type NotificationsModalProps = {
  visible: boolean;
  onClose: () => void;
  onClearAll?: () => void;
};

export function NotificationsModal({ visible, onClose, onClearAll }: NotificationsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const NOTIFICATIONS_DATA = [
    {
      section: t('notifications.sections.today'),
      items: [
        {
          id: 1,
          type: 'ai-insight' as const,
          icon: <Sparkles size={theme.iconSize.md} color={theme.colors.text.primary} />,
          iconBg: theme.colors.status.info,
          title: t('notifications.types.aiInsight.title'),
          description: t('notifications.types.aiInsight.description'),
          time: '2 hours ago',
          unread: true,
        },
        {
          id: 2,
          type: 'workout-reminder' as const,
          icon: <Dumbbell size={theme.iconSize.md} color={theme.colors.status.warning} />,
          iconBg: theme.colors.background.iconDarkest,
          title: t('notifications.types.workoutReminder.title'),
          description: (
            <Text
              className="leading-relaxed"
              style={{
                fontSize: theme.typography.fontSize.base,
                color: theme.colors.text.gray300,
              }}
            >
              {t('notifications.types.workoutReminder.description', {
                workoutName: 'Upper Body Power',
                time: '6:00 PM',
              })}
            </Text>
          ),
          time: '4 hours ago',
          hasAction: true,
        },
      ],
    },
    {
      section: t('notifications.sections.yesterday'),
      items: [
        {
          id: 3,
          type: 'workout-completed' as const,
          icon: <CheckCircle2 size={theme.iconSize.md} color={theme.colors.accent.secondary} />,
          iconBg: theme.colors.background.iconDarkest,
          title: t('notifications.types.workoutCompleted.title'),
          description: (
            <Text
              className="leading-relaxed"
              style={{
                fontSize: theme.typography.fontSize.base,
                color: theme.colors.text.gray300,
              }}
            >
              {t('notifications.types.workoutCompleted.description', {
                workoutName: 'Morning Run',
                calories: 310,
              })}
            </Text>
          ),
          time: 'Yesterday, 8:45 AM',
        },
        {
          id: 4,
          type: 'kudos' as const,
          icon: <ThumbsUp size={theme.iconSize.md} color={theme.colors.status.info} />,
          iconBg: theme.colors.background.iconDarkest,
          title: t('notifications.types.kudosReceived.title'),
          description: (
            <Text
              className="leading-relaxed"
              style={{
                fontSize: theme.typography.fontSize.base,
                color: theme.colors.text.gray300,
              }}
            >
              {t('notifications.types.kudosReceived.description', {
                name: 'Sarah',
                count: 3,
                milestone: 'New Squat PR!',
              })}
            </Text>
          ),
          time: 'Yesterday, 2:15 PM',
        },
      ],
    },
    {
      section: t('notifications.sections.earlier'),
      items: [
        {
          id: 5,
          type: 'weekly-report' as const,
          icon: <Clock size={theme.iconSize.md} color={theme.colors.status.purple} />,
          iconBg: theme.colors.background.iconDarkest,
          title: t('notifications.types.weeklyReport.title'),
          description: t('notifications.types.weeklyReport.description'),
          time: 'Mon, 9:00 AM',
        },
      ],
    },
  ];

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('notifications.header.title')}
      headerRight={
        <Pressable onPress={onClearAll}>
          <Text className="text-sm font-semibold text-text-accent">
            {t('notifications.header.clearAll')}
          </Text>
        </Pressable>
      }
    >
      <View className="gap-8 p-4">
        {NOTIFICATIONS_DATA.map((section) => (
          <View key={section.section} className="gap-4">
            <Text className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {section.section}
            </Text>
            <View className="gap-3">
              {section.items.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  type={notification.type}
                  icon={notification.icon}
                  iconBg={notification.iconBg}
                  title={notification.title}
                  description={notification.description}
                  time={notification.time}
                  unread={'unread' in notification ? notification.unread : undefined}
                  hasAction={'hasAction' in notification ? notification.hasAction : undefined}
                  onActionPress={() => {
                    // TODO: Implement start workout action when notification has action
                  }}
                />
              ))}
            </View>
          </View>
        ))}
        {/* Bottom spacing for navigation */}
        <View className="h-24" />
      </View>
    </FullScreenModal>
  );
}
