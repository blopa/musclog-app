import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Flag, Save, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { Button } from './theme/Button';

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

  // Web-specific styles for proper viewport positioning
  const webBackdropStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed' as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        } as any)
      : {};

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS !== 'web'}>
      {/* Backdrop */}
      <Pressable
        className="flex-1"
        style={[{ backgroundColor: theme.colors.overlay.black60 }, webBackdropStyle]}
        onPress={onClose}>
        <View
          className="flex-1 items-center justify-center px-6"
          style={
            Platform.OS === 'web'
              ? ({ display: 'flex', alignItems: 'center', justifyContent: 'center' } as any)
              : undefined
          }>
          {/* Modal Content */}
          <View>
            <Animated.View
              style={{
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
                borderRadius: theme.borderRadius['3xl'],
                borderWidth: theme.borderWidth.thin,
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
                {/* Gradient Header */}
                <LinearGradient
                  colors={[
                    theme.colors.status.purple40,
                    theme.colors.accent.secondary10,
                    'transparent',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="border-b border-border-dark">
                  <View className="flex-row items-center justify-between p-6">
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
                </LinearGradient>

                {/* Content */}
                <View className="p-6">
                  <Text className="text-base leading-relaxed text-text-primary">
                    {t('endWorkout.confirmation')}
                  </Text>
                </View>

                {/* Action Buttons */}
                <View className="gap-3 px-6 pb-6">
                  <Button
                    label={t('endWorkout.finishAndSave')}
                    icon={Save}
                    size="sm"
                    width="full"
                    onPress={() => {
                      onFinishAndSave?.();
                      onClose();
                    }}
                  />

                  <Button
                    label={t('endWorkout.finishAndDiscard')}
                    icon={Trash2}
                    variant="discard"
                    size="sm"
                    width="full"
                    onPress={() => {
                      onFinishAndDiscard?.();
                      onClose();
                    }}
                  />
                </View>
              </LinearGradient>
            </Animated.View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
