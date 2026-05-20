import { MessageSquare } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { useUnreadChatMessages } from '@/hooks/useUnreadChatMessages';

type CoachUnreadBadgeIconProps = {
  color: string;
  size: number;
  strokeWidth: number;
};

export function CoachUnreadBadgeIcon({ color, size, strokeWidth }: CoachUnreadBadgeIconProps) {
  const unreadChatMessages = useUnreadChatMessages();

  return (
    <View className="relative">
      <MessageSquare size={size} color={color} strokeWidth={strokeWidth} />
      {unreadChatMessages > 0 ? (
        <View
          className="absolute -right-1.5 -top-1.5 h-4 w-4 items-center justify-center rounded-full bg-red-500"
          style={{ minWidth: 14, minHeight: 14 }}
        >
          <Text className="text-[10px] font-bold leading-none text-white">
            {unreadChatMessages > 9 ? '9+' : unreadChatMessages}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
