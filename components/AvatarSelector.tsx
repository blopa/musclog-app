import { ComponentType, createElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { AvatarColor } from '../types/AvatarColor';
import { AvatarIcon } from '../types/AvatarIcon';
import { getAvatarBackgroundColor, getAvatarColor } from '../utils/avatarColorUtils';
import { getAvatarIcon } from '../utils/avatarUtils';

interface AvatarSelectorProps {
  selectedAvatar: AvatarIcon;
  selectedColor: AvatarColor;
  onAvatarSelect: (avatar: AvatarIcon) => void;
  onColorSelect?: (color: AvatarColor) => void;
  avatarOptions: { icon: AvatarIcon; component: ComponentType<any> }[];
  showColorPicker?: boolean;
  label: string;
}

const colorOptions: AvatarColor[] = [
  'emerald',
  'blue',
  'purple',
  'pink',
  'orange',
  'teal',
  'yellow',
  'indigo',
];

export function AvatarSelector({
  selectedAvatar,
  selectedColor,
  onAvatarSelect,
  onColorSelect,
  avatarOptions,
  showColorPicker = true,
  label,
}: AvatarSelectorProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View className="flex-col gap-2">
      <Text className="ml-1 text-sm font-medium text-text-secondary">{label}</Text>

      <View className="flex-row items-center gap-4 rounded-2xl border border-white/10 bg-bg-card p-4">
        {/* Default avatar with gradient background */}
        <View className="flex-shrink-0">
          <View
            className="h-20 w-20 items-center justify-center rounded-full border-4"
            style={{
              borderColor: getAvatarColor(theme, selectedColor),
              backgroundColor: getAvatarBackgroundColor(theme, selectedColor),
            }}
          >
            {createElement(getAvatarIcon(selectedAvatar), {
              size: 40,
              color: getAvatarColor(theme, selectedColor),
            })}
          </View>
        </View>

        {/* Divider */}
        <View className="h-12 w-px flex-shrink-0 bg-white/10" />

        {/* Avatar options */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.gap.md }}
          className="flex-1"
        >
          {avatarOptions.map(({ icon, component: IconComponent }) => (
            <Pressable
              key={icon}
              className={`h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                selectedAvatar === icon ? 'border-transparent' : 'border-transparent bg-bg-card'
              }`}
              onPress={() => onAvatarSelect(icon)}
            >
              <IconComponent
                size={28}
                color={
                  selectedAvatar === icon
                    ? getAvatarColor(theme, selectedColor)
                    : theme.colors.text.tertiary
                }
              />
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Color Selection */}
      {showColorPicker ? (
        <View className="flex-col gap-2">
          <Text className="ml-1 text-sm font-medium text-text-secondary">{t('chooseColor')}</Text>
          <View
            className="rounded-2xl border border-white/10 bg-bg-card"
            style={{
              paddingHorizontal: theme.spacing.padding['3half'],
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: theme.spacing.gap.md,
                paddingVertical: theme.spacing.padding.base,
              }}
            >
              {colorOptions.map((color) => (
                <Pressable
                  key={color}
                  className={`h-12 w-12 items-center justify-center rounded-full border-2 ${
                    selectedColor === color ? 'border-white/50' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: getAvatarColor(theme, color) }}
                  onPress={() => onColorSelect?.(color)}
                >
                  {selectedColor === color ? (
                    <View className="h-2 w-2 rounded-full bg-white" />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );
}
