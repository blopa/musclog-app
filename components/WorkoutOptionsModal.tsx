import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, Animated } from 'react-native';
import { X, List, Settings, Square } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

type WorkoutOptionsModalProps = {
  visible: boolean;
  onClose: () => void;
  onPreviewWorkout?: () => void;
  onWorkoutSettings?: () => void;
  onEndWorkout?: () => void;
};

type OptionItemProps = {
  icon: React.ComponentType<{ size: number; color: string }>;
  iconColor: string;
  iconBgColor: string;
  title: string;
  description: string;
  titleColor?: string;
  descriptionColor?: string;
  onPress: () => void;
};

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

export function WorkoutOptionsModal({
  visible,
  onClose,
  onPreviewWorkout,
  onWorkoutSettings,
  onEndWorkout,
}: WorkoutOptionsModalProps) {
  const { t } = useTranslation();
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
      <Pressable className="flex-1 bg-black/60" onPress={onClose}>
        <View className="flex-1 justify-end">
          {/* Modal Content */}
          <Animated.View
            className="rounded-t-3xl border-t border-border-dark"
            style={{
              transform: [{ translateY: slideAnim }],
              backgroundColor: theme.colors.background.cardElevated,
            }}>
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-border-dark p-6">
              <Text className="text-2xl font-bold text-text-primary">
                {t('workoutOptions.title')}
              </Text>
              <Pressable
                className="active:bg-bg-card-elevated h-10 w-10 items-center justify-center rounded-full bg-bg-overlay"
                onPress={onClose}>
                <X size={theme.iconSize.md} color={theme.colors.text.secondary} />
              </Pressable>
            </View>

            {/* Options List */}
            <View className="gap-3 p-6">
              <OptionItem
                icon={List}
                iconColor={theme.colors.text.primary}
                iconBgColor={`${theme.colors.text.primary}20`}
                title={t('workoutOptions.previewWorkout')}
                description={t('workoutOptions.previewWorkoutDesc')}
                onPress={() => {
                  onPreviewWorkout?.();
                  onClose();
                }}
              />
              <OptionItem
                icon={Settings}
                iconColor={theme.colors.text.primary}
                iconBgColor={`${theme.colors.text.primary}20`}
                title={t('workoutOptions.workoutSettings')}
                description={t('workoutOptions.workoutSettingsDesc')}
                onPress={() => {
                  onWorkoutSettings?.();
                  onClose();
                }}
              />
              <OptionItem
                icon={Square}
                iconColor={theme.colors.status.error}
                iconBgColor={`${theme.colors.status.error}20`}
                title={t('workoutOptions.endWorkout')}
                description={t('workoutOptions.endWorkoutDesc')}
                titleColor={theme.colors.status.error}
                descriptionColor={theme.colors.status.warning}
                onPress={() => {
                  onEndWorkout?.();
                  onClose();
                }}
              />
            </View>

            {/* Footer */}
            <View className="items-center pb-8">
              <Text className="text-sm font-medium" style={{ color: theme.colors.status.info }}>
                MUSCLOG
              </Text>
            </View>
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}
