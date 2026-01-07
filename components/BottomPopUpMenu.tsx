import React, { useEffect, useRef, ReactNode } from 'react';
import { View, Text, Pressable, Modal, Animated } from 'react-native';
import { X } from 'lucide-react-native';
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
}: BottomPopUpMenuProps) {
  const slideAnim = useRef(new Animated.Value(300)).current; // Start off-screen

  useEffect(() => {
    if (visible) {
      // Slide up when modal becomes visible
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      // Slide down when modal is hidden
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      {/* Backdrop */}
      <Pressable
        className="flex-1"
        style={{ backgroundColor: theme.colors.overlay.black60 }}
        onPress={onClose}>
        <View className="flex-1 justify-end">
          {/* Modal Content */}
          <Animated.View
            className="border-t border-border-dark"
            style={{
              transform: [{ translateY: slideAnim }],
              backgroundColor: theme.colors.background.cardElevated,
              overflow: 'hidden',
              borderTopLeftRadius: theme.borderRadius['3xl'],
              borderTopRightRadius: theme.borderRadius['3xl'],
            }}>
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-border-dark p-6">
              <View className="flex-1">
                <Text className="text-2xl font-bold text-text-primary">{title}</Text>
                {subtitle && <Text className="mt-1 text-sm text-text-secondary">{subtitle}</Text>}
              </View>
              <Pressable
                className="active:bg-bg-card-elevated h-10 w-10 items-center justify-center rounded-full bg-bg-overlay"
                onPress={onClose}>
                <X size={theme.iconSize.md} color={theme.colors.text.secondary} />
              </Pressable>
            </View>

            {/* Content */}
            {children ? (
              <View className="p-6">{children}</View>
            ) : items ? (
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
            ) : null}

            {/* Footer */}
            {footer && <View className="border-t border-border-dark px-6 pb-6 pt-2">{footer}</View>}
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}
