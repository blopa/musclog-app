import { ChevronRight } from 'lucide-react-native';
import { ComponentType, ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { BottomPopUp } from './BottomPopUp';

export type BottomPopUpMenuItem = {
  icon: ComponentType<{ size: number; color: string }>;
  iconColor: string;
  iconBgColor: string;
  title: string;
  description: string;
  titleColor?: string;
  descriptionColor?: string;
  onPress: () => void;
  /** When true, the menu will not automatically close when this item is pressed */
  keepOpenOnPress?: boolean;
};

type BottomPopUpMenuProps = {
  visible: boolean;
  onClose?: () => void;
  title: string;
  subtitle?: string;
  items?: BottomPopUpMenuItem[];
  children?: ReactNode;
  footer?: ReactNode;
  maxHeight?: number | 'auto' | `${number}%`;
  headerIcon?: ReactNode;
  fullWidthItems?: boolean;
  /** When false, content is not wrapped in ScrollView (e.g. for sticky header + scrollable list) */
  scrollable?: boolean;
  isLoading?: boolean;
  loadingTitle?: string;
};

type OptionItemProps = BottomPopUpMenuItem;

function OptionItem({
  icon: Icon,
  iconColor,
  iconBgColor,
  title,
  description,
  titleColor,
  descriptionColor,
  onPress,
}: OptionItemProps) {
  const theme = useTheme();
  // On Android, Pressable inside ScrollView often needs two taps because ScrollView captures the first touch.
  // unstable_pressDelay lets the first tap register (press fires after delay if no scroll).
  const pressableProps =
    Platform.OS === 'android' ? { onPress, unstable_pressDelay: 130 as const } : { onPress };

  return (
    <Pressable className="flex-row items-center gap-4 py-3 active:opacity-70" {...pressableProps}>
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBgColor || theme.colors.background.iconDarker }}
      >
        <Icon size={theme.iconSize.md} color={iconColor || theme.colors.accent.secondary} />
      </View>
      <View className="flex-1">
        <Text
          className="text-lg font-bold"
          style={{ color: titleColor || theme.colors.text.primary }}
        >
          {title}
        </Text>
        <Text
          className="mt-0.5 text-sm"
          style={{ color: descriptionColor || theme.colors.text.secondary }}
        >
          {description}
        </Text>
      </View>
      <ChevronRight size={theme.iconSize.md} color={theme.colors.text.secondary} />
    </Pressable>
  );
}

export function BottomPopUpMenu({
  visible,
  onClose,
  title,
  subtitle,
  items,
  children,
  footer,
  maxHeight,
  headerIcon,
  scrollable = true,
  isLoading = false,
  loadingTitle,
}: BottomPopUpMenuProps) {
  const theme = useTheme();

  return (
    <BottomPopUp
      visible={visible}
      onClose={isLoading ? undefined : onClose}
      title={title}
      subtitle={subtitle}
      maxHeight={maxHeight}
      headerIcon={headerIcon}
      footer={footer}
      scrollable={scrollable}
    >
      {isLoading ? (
        <View className="items-center justify-center p-12">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
          {loadingTitle ? (
            <Text className="mt-4 text-center text-lg font-bold text-text-primary">
              {loadingTitle}
            </Text>
          ) : null}
        </View>
      ) : (
        children ||
        (items && (
          <View className="p-6">
            {items.map((item, index) => (
              <View
                key={index}
                style={
                  index < items.length - 1
                    ? { borderBottomWidth: 1, borderBottomColor: theme.colors.background.white10 }
                    : undefined
                }
              >
                <OptionItem
                  icon={item.icon}
                  iconColor={item.iconColor}
                  iconBgColor={item.iconBgColor}
                  title={item.title}
                  description={item.description}
                  titleColor={item.titleColor}
                  descriptionColor={item.descriptionColor}
                  onPress={() => {
                    item.onPress();
                    if (!item.keepOpenOnPress) {
                      onClose?.();
                    }
                  }}
                />
              </View>
            ))}
          </View>
        ))
      )}
    </BottomPopUp>
  );
}
