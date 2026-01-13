import React, { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { BottomPopUp } from './BottomPopUp';
import { theme } from '../theme';

export type BottomPopUpMenuItem = {
  icon: React.ComponentType<{ size: number; color: string }>;
  iconColor: string;
  iconBgColor: string;
  title: string;
  description: string;
  titleColor?: string;
  descriptionColor?: string;
  onPress: () => void;
};

type BottomPopUpMenuProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items?: BottomPopUpMenuItem[];
  children?: ReactNode;
  footer?: ReactNode;
  maxHeight?: number | 'auto' | `${number}%`;
  headerIcon?: ReactNode;
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
  return (
    <Pressable
      className="active:bg-bg-card-elevated flex-row items-center gap-4 rounded-2xl border border-border-default bg-bg-overlay p-4"
      onPress={onPress}>
      <View
        className="h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: iconBgColor }}>
        <Icon size={theme.iconSize.md} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text
          className="text-lg font-semibold"
          style={{ color: titleColor || theme.colors.text.primary }}>
          {title}
        </Text>
        <Text
          className="mt-0.5 text-sm"
          style={{ color: descriptionColor || theme.colors.text.secondary }}>
          {description}
        </Text>
      </View>
      <View className="h-6 w-6 items-center justify-center">
        <Text className="text-lg" style={{ color: theme.colors.text.secondary }}>
          ›
        </Text>
      </View>
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
}: BottomPopUpMenuProps) {
  return (
    <BottomPopUp
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      maxHeight={maxHeight}
      headerIcon={headerIcon}
      footer={footer}>
      {children ||
        (items && (
          <View className="gap-3 p-6">
            {items.map((item, index) => (
              <OptionItem
                key={index}
                icon={item.icon}
                iconColor={item.iconColor}
                iconBgColor={item.iconBgColor}
                title={item.title}
                description={item.description}
                titleColor={item.titleColor}
                descriptionColor={item.descriptionColor}
                onPress={() => {
                  item.onPress();
                  onClose();
                }}
              />
            ))}
          </View>
        ))}
    </BottomPopUp>
  );
}
