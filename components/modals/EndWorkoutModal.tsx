import { LinearGradient } from 'expo-linear-gradient';
import { Flag, Save, Trash2, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, Platform, Pressable, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { Button } from '../theme/Button';

type EndWorkoutModalProps = {
  visible: boolean;
  onClose: () => void;
  onFinishAndSave?: () => void | Promise<void>;
  onFinishAndDiscard?: () => void | Promise<void>;
};

export function EndWorkoutModal({
  visible,
  onClose,
  onFinishAndSave,
  onFinishAndDiscard,
}: EndWorkoutModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

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
      statusBarTranslucent={Platform.OS !== 'web'}
    >
      {/* Backdrop */}
      <Pressable
        className="flex-1 items-center justify-center p-4"
        style={[{ backgroundColor: theme.colors.overlay.black60 }, webBackdropStyle]}
        onPress={onClose}
      >
        {/* Modal Content */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ width: '100%', maxWidth: theme.size['384'] }}
        >
          <Animated.View
            style={{
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
              borderRadius: theme.borderRadius['3xl'],
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border.dark,
              overflow: 'hidden',
              width: '100%',
            }}
          >
            <LinearGradient
              colors={[
                theme.colors.background.cardElevated,
                theme.colors.background.card,
                theme.colors.background.secondaryDark,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: theme.borderRadius['3xl'],
              }}
            >
              {/* Gradient Header */}
              <LinearGradient
                colors={[
                  theme.colors.status.purple40,
                  theme.colors.accent.secondary10,
                  'transparent',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderBottomWidth: theme.borderWidth.thin,
                  borderBottomColor: theme.colors.border.dark,
                }}
              >
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
                    onPress={onClose}
                  >
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
                  onPress={async () => {
                    if (isSaving) {
                      return;
                    }

                    setIsSaving(true);
                    // Small delay to allow React to render the loading state before closing
                    await new Promise<void>((resolve) => setTimeout(resolve, 1));
                    try {
                      await (onFinishAndSave?.() ?? Promise.resolve());
                      // Don't call onClose — parent either navigates (screen unmounts) or hides this modal via state; closing first would cause a flash.
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  loading={isSaving}
                  disabled={isSaving || isDiscarding}
                />

                <Button
                  label={t('endWorkout.finishAndDiscard')}
                  icon={Trash2}
                  variant="discard"
                  size="sm"
                  width="full"
                  onPress={async () => {
                    if (isDiscarding) {
                      return;
                    }

                    setIsDiscarding(true);
                    // Small delay to allow React to render the loading state before closing
                    await new Promise<void>((resolve) => setTimeout(resolve, 1));
                    try {
                      await (onFinishAndDiscard?.() ?? Promise.resolve());
                      // Don't call onClose — parent navigates or updates state; closing first would cause a flash.
                    } finally {
                      setIsDiscarding(false);
                    }
                  }}
                  loading={isDiscarding}
                  disabled={isSaving || isDiscarding}
                />
              </View>
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
