import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Flag, Save, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

type EndWorkoutModalProps = {
  visible: boolean;
  onClose: () => void;
  onFinishAndSave?: () => void;
  onFinishAndDiscard?: () => void;
};

export function EndWorkoutModal({
  visible,
  onClose,
  onFinishAndSave,
  onFinishAndDiscard,
}: EndWorkoutModalProps) {
  const { t } = useTranslation();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

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
        <View className="flex-1 items-center justify-center px-6">
          {/* Modal Content */}
          <View>
            <Animated.View
              style={{
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
                borderRadius: theme.borderRadius['3xl'],
                borderWidth: 1,
                borderColor: theme.colors.border.dark,
                overflow: 'hidden',
                width: '100%',
              }}>
              <LinearGradient
                colors={[
                  theme.colors.background.cardElevated,
                  theme.colors.background.card,
                  theme.colors.background.cardDark,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: theme.borderRadius['3xl'],
                  minHeight: '100%',
                }}>
                {/* Header */}
                <View className="flex-row items-center justify-between border-b border-border-dark p-6">
                  <View className="flex-row items-center gap-3">
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-bg-overlay">
                      <Flag
                        size={theme.iconSize.sm}
                        color={theme.colors.accent.secondary}
                        fill={theme.colors.accent.secondary}
                      />
                    </View>
                    <Text className="text-2xl font-bold text-text-primary">
                      {t('endWorkout.title')}
                    </Text>
                  </View>
                  <Pressable
                    className="active:bg-bg-card-elevated h-10 w-10 items-center justify-center rounded-full bg-bg-overlay"
                    onPress={onClose}>
                    <X size={theme.iconSize.md} color={theme.colors.text.secondary} />
                  </Pressable>
                </View>

                {/* Content */}
                <View className="p-6">
                  <Text className="text-base leading-relaxed text-text-primary">
                    {t('endWorkout.confirmation')}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View className="gap-3 px-6 pb-6">
                  <Pressable
                    className="flex-row items-center justify-center gap-3 rounded-2xl bg-accent-primary py-4 active:opacity-90"
                    onPress={() => {
                      onFinishAndSave?.();
                      onClose();
                    }}>
                    <Save size={theme.iconSize.md} color={theme.colors.text.primary} />
                    <Text className="text-lg font-semibold text-text-primary">
                      {t('endWorkout.finishAndSave')}
                    </Text>
                  </Pressable>

                  <Pressable
                    className="border-status-error flex-row items-center justify-center gap-3 rounded-2xl border py-4 active:opacity-90"
                    style={{ backgroundColor: `${theme.colors.status.error}15` }}
                    onPress={() => {
                      onFinishAndDiscard?.();
                      onClose();
                    }}>
                    <Trash2 size={theme.iconSize.md} color={theme.colors.status.error} />
                    <Text
                      className="text-lg font-semibold"
                      style={{ color: theme.colors.status.error }}>
                      {t('endWorkout.finishAndDiscard')}
                    </Text>
                  </Pressable>
                </View>

                {/* Footer */}
                <View className="items-center pb-6">
                  <Text className="text-sm font-medium" style={{ color: theme.colors.status.info }}>
                    MUSCLOG
                  </Text>
                </View>
              </LinearGradient>
            </Animated.View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
