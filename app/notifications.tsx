import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Sparkles, Dumbbell, CheckCircle2, ThumbsUp, Clock } from 'lucide-react-native';
import { MasterLayout } from '../components/MasterLayout';
import { NotificationCard } from '../components/NotificationCard';

const NOTIFICATIONS_DATA = [
  {
    section: 'TODAY',
    items: [
      {
        id: 1,
        type: 'ai-insight' as const,
        icon: <Sparkles size={24} color="#ffffff" />,
        iconBg: 'bg-blue-600',
        title: 'AI Insight',
        description:
          'Based on your recent lifts, try increasing your protein intake by 15g today for optimal recovery.',
        time: '2 hours ago',
        unread: true,
      },
      {
        id: 2,
        type: 'workout-reminder' as const,
        icon: <Dumbbell size={24} color="#f97316" />,
        iconBg: 'bg-[#1a2420]',
        title: 'Workout Reminder',
        description: (
          <Text className="text-[15px] leading-relaxed text-gray-300">
            Ready for <Text className="font-semibold">Upper Body Power</Text>?{'\n'}Scheduled for
            6:00 PM today.
          </Text>
        ),
        time: '4 hours ago',
        hasAction: true,
      },
    ],
  },
  {
    section: 'YESTERDAY',
    items: [
      {
        id: 3,
        type: 'workout-completed' as const,
        icon: <CheckCircle2 size={24} color="#34d399" />,
        iconBg: 'bg-[#1a2420]',
        title: 'Workout Completed!',
        description: (
          <Text className="text-[15px] leading-relaxed text-gray-300">
            Great job crushing <Text className="font-semibold">Morning Run</Text>. You burned 310
            kcal.
          </Text>
        ),
        time: 'Yesterday, 8:45 AM',
      },
      {
        id: 4,
        type: 'kudos' as const,
        icon: <ThumbsUp size={24} color="#3b82f6" />,
        iconBg: 'bg-[#1a2420]',
        title: 'Kudos Received',
        description: (
          <Text className="text-[15px] leading-relaxed text-gray-300">
            Sarah and 3 others liked your recent milestone:{' '}
            <Text className="italic">{'"New Squat PR!"'}</Text>
          </Text>
        ),
        time: 'Yesterday, 2:15 PM',
      },
    ],
  },
  {
    section: 'EARLIER',
    items: [
      {
        id: 5,
        type: 'weekly-report' as const,
        icon: <Clock size={24} color="#a855f7" />,
        iconBg: 'bg-[#1a2420]',
        title: 'Weekly Report Ready',
        description: 'Your progress report for last week is available. Check your stats.',
        time: 'Mon, 9:00 AM',
      },
    ],
  },
];

export default function NotificationsScreen() {
  const router = useRouter();

  return (
    <MasterLayout>
      <View className="flex-1">
        {/* Header */}
        <View className="border-b border-[#1a2f2a] bg-[#0a1f1a]">
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center gap-4">
              <Pressable onPress={() => router.back()}>
                <ArrowLeft size={24} color="#ffffff" />
              </Pressable>
              <Text className="text-2xl font-bold text-white">Notifications</Text>
            </View>
            <Pressable>
              <Text className="text-sm font-semibold text-[#22c55e]">CLEAR ALL</Text>
            </Pressable>
          </View>
        </View>

        {/* Notifications List */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-8 p-4">
            {NOTIFICATIONS_DATA.map((section) => (
              <View key={section.section} className="gap-4">
                <Text className="text-xs font-semibold uppercase tracking-wider text-gray-400">
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
                        // Handle start workout action
                      }}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
          {/* Bottom spacing for navigation */}
          <View className="h-24" />
        </ScrollView>
      </View>
    </MasterLayout>
  );
}
