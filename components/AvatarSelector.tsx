import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Dumbbell, Zap, Activity, Trophy, Target, User } from 'lucide-react-native';
import { theme } from '../theme';
import { AvatarIcon } from '../types/AvatarIcon';
import { getAvatarIcon } from '../utils/avatarUtils';

interface AvatarSelectorProps {
  selectedAvatar: AvatarIcon;
  onAvatarSelect: (avatar: AvatarIcon) => void;
}

const avatarOptions: { icon: AvatarIcon; component: React.ComponentType<any> }[] = [
  { icon: 'person', component: User },
  { icon: 'fitness_center', component: Dumbbell },
  { icon: 'bolt', component: Zap },
  { icon: 'monitoring', component: Activity },
  { icon: 'directions_run', component: Target },
  { icon: 'emoji_events', component: Trophy },
];

export function AvatarSelector({ selectedAvatar, onAvatarSelect }: AvatarSelectorProps) {
  return (
    <View className="flex-col gap-2">
      <Text className="ml-1 text-sm font-medium text-text-secondary">Choose Avatar</Text>

      <View className="flex-row items-center gap-4 rounded-2xl border border-white/10 bg-bg-card p-4">
        {/* Default avatar with gradient background */}
        <View className="flex-shrink-0">
          <View
            className="h-20 w-20 items-center justify-center rounded-full border-4"
            style={{
              borderColor: theme.colors.accent.primary,
              backgroundColor: theme.colors.accent.primary20,
            }}
          >
            {React.createElement(getAvatarIcon(selectedAvatar), {
              size: 40,
              color: theme.colors.accent.primary,
            })}
          </View>
        </View>

        {/* Divider */}
        <View className="h-12 w-px flex-shrink-0 bg-white/10" />

        {/* Avatar options */}
        <View className="flex-1 flex-row gap-3 overflow-x-auto">
          {avatarOptions.map(({ icon, component: IconComponent }) => (
            <Pressable
              key={icon}
              className={`h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                selectedAvatar === icon
                  ? 'bg-accent-primary10 border-accent-primary'
                  : 'border-transparent bg-bg-card'
              }`}
              onPress={() => onAvatarSelect(icon)}
            >
              <IconComponent
                size={28}
                color={
                  selectedAvatar === icon ? theme.colors.accent.primary : theme.colors.text.tertiary
                }
              />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
