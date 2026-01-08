import React, { ReactNode } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Platform } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { theme } from '../theme';

type FullScreenModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  scrollable?: boolean;
};

export function FullScreenModal({
  visible,
  onClose,
  title,
  subtitle,
  headerRight,
  children,
  scrollable = true,
}: FullScreenModalProps) {
  const content = scrollable ? (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View className="flex-1">{children}</View>
  );

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS !== 'web'}
    >
      <View className="flex-1 bg-bg-primary">
        {/* Header */}
        <View className="flex-row items-center gap-4 border-b border-border-light bg-bg-primary px-4 py-4">
          <Pressable className="-ml-2 rounded-full p-2" onPress={onClose}>
            <ArrowLeft size={theme.iconSize.md} color={theme.colors.text.primary} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xl font-bold tracking-tight text-text-primary">{title}</Text>
            {subtitle && <Text className="mt-0.5 text-sm text-text-secondary">{subtitle}</Text>}
          </View>
          {headerRight && <View className="-mr-2">{headerRight}</View>}
        </View>

        {/* Content */}
        {content}
      </View>
    </Modal>
  );
}

