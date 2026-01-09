import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, Platform, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Home, Timer, Dumbbell, TrendingUp, Star, Trophy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { Button } from './theme/Button';
import { GradientText } from './GradientText';

type WorkoutSummaryCelebrationProps = {
  visible: boolean;
  onClose: () => void;
  onGoHome: () => void;
  onShareSummary?: () => void;
  totalTime?: string; // e.g., "45m"
  volume?: string; // e.g., "12,450 kg"
  personalRecords?: number; // e.g., 2
};

type StatRowProps = {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string | number;
  valueSuffix?: string;
  iconBgColor: string;
  iconColor: string;
  showDivider?: boolean;
  showStarIcon?: boolean;
};

function StatRow({
  icon: Icon,
  label,
  value,
  valueSuffix,
  iconBgColor,
  iconColor,
  showDivider = true,
  showStarIcon = false,
}: StatRowProps) {
  return (
    <View
      className={`flex-row items-center justify-between ${showDivider ? 'border-b border-white/5 pb-4' : ''}`}>
      <View className="flex-row items-center gap-3">
        <View className="rounded-lg p-2" style={{ backgroundColor: iconBgColor }}>
          <Icon size={20} color={iconColor} />
        </View>
        <Text className="font-medium text-text-secondary">{label}</Text>
      </View>
      <View className="flex-row items-center gap-1">
        {showStarIcon && <Star size={16} color="#fbbf24" fill="#fbbf24" />}
        <Text className="text-2xl font-bold tracking-tight text-text-primary">{value}</Text>
        {valueSuffix && (
          <Text className="text-sm font-normal text-text-tertiary">{valueSuffix}</Text>
        )}
      </View>
    </View>
  );
}

export function WorkoutSummaryCelebration({
  visible,
  onClose,
  onGoHome,
  onShareSummary,
  totalTime = '45m',
  volume = '12,450 kg',
  personalRecords = 2,
}: WorkoutSummaryCelebrationProps) {
  const { t } = useTranslation();
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim1 = useRef(new Animated.Value(0.6)).current;
  const glowAnim2 = useRef(new Animated.Value(0.6)).current;
  const star1Anim = useRef(new Animated.Value(1)).current;
  const star2Anim = useRef(new Animated.Value(1)).current;
  const star3Anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Floating animation for trophy
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Glow pulse animations
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim1, {
            toValue: 0.8,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim1, {
            toValue: 0.6,
            duration: 1500,
            useNativeDriver: false,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.delay(750),
          Animated.timing(glowAnim2, {
            toValue: 0.8,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim2, {
            toValue: 0.6,
            duration: 1500,
            useNativeDriver: false,
          }),
        ])
      ).start();

      // Star pulse animations
      const createStarPulse = (anim: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1.2,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
          ])
        );
      };

      createStarPulse(star1Anim, 0).start();
      createStarPulse(star2Anim, 400).start();
      createStarPulse(star3Anim, 800).start();
    }
  }, [visible, floatAnim, glowAnim1, glowAnim2, star1Anim, star2Anim, star3Anim]);

  const floatTranslateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  // Web-specific styles for proper viewport positioning
  const webModalStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed' as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
        } as any)
      : {};

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS !== 'web'}>
      <View className="flex-1 bg-bg-primary" style={webModalStyle}>
        <View className="flex-1 items-center justify-center px-6 py-8">
          {/* Background Glow Effects */}
          <Animated.View
            className="absolute left-1/2 top-1/4 h-64 w-64 rounded-full blur-3xl"
            style={{
              backgroundColor: 'rgba(99, 102, 241, 0.2)',
              transform: [{ translateX: -128 }, { translateY: -128 }],
              opacity: glowAnim1,
            }}
          />
          <Animated.View
            className="absolute left-1/2 top-1/3 h-48 w-48 rounded-full blur-3xl"
            style={{
              backgroundColor: 'rgba(41, 224, 142, 0.2)',
              transform: [{ translateX: -96 }, { translateY: -96 }],
              opacity: glowAnim2,
            }}
          />

          {/* Trophy Icon with Stars */}
          <Animated.View
            className="relative mb-8"
            style={{
              transform: [{ translateY: floatTranslateY }],
            }}>
            <View
              className="relative z-10 h-32 w-32 items-center justify-center rounded-full border"
              style={{
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderColor: theme.colors.background.white5,
                shadowColor: theme.colors.accent.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.1,
                shadowRadius: 40,
                elevation: 20,
              }}>
              <LinearGradient
                colors={['rgba(99, 102, 241, 0.1)', 'rgba(41, 224, 142, 0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 64,
                }}
              />
              <Trophy size={64} color={theme.colors.accent.primary} strokeWidth={1.5} />
            </View>

            {/* Stars */}
            <Animated.View
              className="absolute -right-2 -top-2"
              style={{
                transform: [{ scale: star1Anim }, { rotate: '12deg' }],
              }}>
              <Star size={20} color="#fbbf24" fill="#fbbf24" />
            </Animated.View>
            <Animated.View
              className="absolute -bottom-1 -left-4"
              style={{
                transform: [{ scale: star2Anim }, { rotate: '-12deg' }],
              }}>
              <Star
                size={18}
                color={theme.colors.accent.primary}
                fill={theme.colors.accent.primary}
              />
            </Animated.View>
            <Animated.View
              className="absolute -left-2 top-0"
              style={{
                transform: [{ scale: star3Anim }, { rotate: '-45deg' }],
              }}>
              <Star size={14} color="#818cf8" fill="#818cf8" />
            </Animated.View>
          </Animated.View>

          {/* Title */}
          <GradientText
            colors={['#c7d2fe', '#ffffff', '#a7f3d0']}
            style={{
              fontSize: 36,
              fontWeight: '800',
              textAlign: 'center',
              letterSpacing: -0.5,
              marginBottom: 8,
            }}>
            You Crushed It!
          </GradientText>

          {/* Subtitle */}
          <Text className="mb-10 text-center text-sm font-medium text-text-secondary">
            Workout feedback submitted successfully.
          </Text>

          {/* Stats Card */}
          <View
            className="mb-8 w-full overflow-hidden rounded-[20px] border p-6"
            style={{
              backgroundColor: 'rgba(27, 50, 39, 0.8)',
              borderColor: theme.colors.background.white5,
              borderWidth: 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}>
            {/* Top gradient line */}
            <LinearGradient
              colors={['#818cf8', theme.colors.accent.primary, '#34d399']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 6,
                opacity: 0.5,
              }}
            />

            <View className="gap-6">
              <StatRow
                icon={Timer}
                label="Total Time"
                value={totalTime.replace(/\s*(m|min|minutes?)/i, '')}
                valueSuffix={totalTime.match(/\s*(m|min|minutes?)/i)?.[1] || 'm'}
                iconBgColor="rgba(59, 130, 246, 0.1)"
                iconColor="#3b82f6"
              />
              <StatRow
                icon={Dumbbell}
                label="Volume"
                value={volume.replace(/\s*(kg|g|lbs?)/i, '').trim()}
                valueSuffix={volume.match(/\s*(kg|g|lbs?)/i)?.[1] || 'kg'}
                iconBgColor="rgba(41, 224, 142, 0.1)"
                iconColor={theme.colors.accent.primary}
              />
              <StatRow
                icon={TrendingUp}
                label="Personal Records"
                value={personalRecords}
                iconBgColor="rgba(251, 191, 36, 0.1)"
                iconColor="#fbbf24"
                showDivider={false}
                showStarIcon={true}
              />
            </View>
          </View>

          {/* Spacer */}
          <View className="flex-1" />

          {/* Go Home Button */}
          <Button
            label="Go Home"
            icon={Home}
            variant="accent"
            size="md"
            width="full"
            onPress={onGoHome}
            style={{ marginBottom: 16 }}
          />

          {/* Share Summary Link */}
          <Pressable onPress={onShareSummary}>
            <Text className="text-center text-xs font-medium uppercase tracking-wider text-text-tertiary">
              Share Summary
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
