import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { LucideChartSpline, Sparkles, Key, CheckCircle2 } from 'lucide-react-native';
import { theme } from '../theme';
import { FullScreenModal } from './FullScreenModal';
import { GoogleGeminiIllustration } from './GoogleGeminiIllustration';

// Illustration Component
type ConnectGoogleAccountModalProps = {
  visible: boolean;
  onClose: () => void;
  onConnect?: () => void;
  onMaybeLater?: () => void;
};

export function ConnectGoogleAccountModal({
  visible,
  onClose,
  onConnect,
  onMaybeLater,
}: ConnectGoogleAccountModalProps) {
  // Google logo URL from the HTML
  const googleLogoUrl =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDD-q3Yh6AXDMBPsNrW8_Mtje_mP-T7JtL2ix7KBpT5JakMhY0GH9ZzVeFieftJtlvRrROPrN33q5WGo5cV_-PvS1s3jww8amWF0-_e3BB18Amq9No7czYlpbhTXQFTg_uB7w32EFnRneY58tBVGkSQhbzcEgTlIw5kyLmYeMA7dv2HjDQsmK8zswC2hZ-zjH9L9Gm27tWZzdxTNAqLHqrKEjUS12QIYBvVRvUFJGFbDRaXMCSeRipp9EwzLNFjBFjdTliadeykQ2CB';

  // Background image URL from the HTML
  const backgroundImageUrl =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBIUHHpLboa-7oRhIVkiQfJlErR0GL5ntRD8oyMWVpa6uB4tGMdsX6LIlnAAIdkFL4BKrPedtVAuVvXfJVSlwUJhiRZJicaFaSI2SVcksaQbJt8h-TZ-GTwmoxVs96uxnle3cZi0de4o3rX7zv9W9iqh7cFiLzT1F0Hj62866bpdABQPz4ujVrWRLTrbU4SHg2a1ZFVM79TkxqXTVsms0B29rdyIiGlDP73-Jb9YfS9_DTpueq2UvyVdxJLHz4nyJHdM_vZk7PAh7O7';

  const handleConnect = () => {
    onConnect?.();
    onClose();
  };

  const handleMaybeLater = () => {
    onMaybeLater?.();
    onClose();
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title="Connect Google Account"
      scrollable={true}
      footer={
        <View className="bg-transparent px-5 pb-2 pt-4">
          <Pressable
            onPress={handleConnect}
            className="w-full flex-row items-center justify-center gap-3 rounded-full bg-white px-6 py-4 active:scale-[0.98]"
            style={theme.shadows.lg}>
            <Image source={{ uri: googleLogoUrl }} className="h-6 w-6" resizeMode="contain" />
            <Text className="text-lg font-semibold" style={{ color: theme.colors.text.black }}>
              Connect with Google
            </Text>
          </Pressable>
          <Pressable
            onPress={handleMaybeLater}
            className="mt-4 w-full items-center justify-center rounded-lg px-4 py-2">
            <Text className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
              Maybe later
            </Text>
          </Pressable>
        </View>
      }>
      <View className="flex-1 px-5 pb-6">
        {/* Main Visual Card */}
        <GoogleGeminiIllustration
          googleLogoUrl={googleLogoUrl}
          backgroundImageUrl={backgroundImageUrl}
        />

        {/* Title and Description */}
        <View className="mb-8 text-center">
          <Text className="mb-3 text-center text-3xl font-extrabold leading-tight tracking-tight text-text-primary">
            Unlock <Text style={{ color: theme.colors.accent.primary }}>AI Insights</Text>
          </Text>
          <Text className="px-2 text-center text-base font-normal leading-relaxed text-text-secondary">
            Unlock personalized AI insights by connecting your Google account for seamless
            integration with your own Gemini key.
          </Text>
        </View>

        {/* Feature Cards */}
        <View className="mb-8 gap-3">
          {/* Deep Analysis */}
          <View className="relative">
            {/* Glow effect */}
            <View
              className="absolute"
              style={{
                top: -1,
                left: -1,
                right: -1,
                bottom: -1,
                borderRadius: theme.borderRadius.xl,
                backgroundColor: theme.colors.accent.primary,
                opacity: 0.2,
                shadowColor: theme.colors.accent.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
              }}
            />
            <View className="relative flex-row items-center gap-4 rounded-xl border border-white/5 bg-bg-cardDark p-4">
              <View
                className="h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: theme.colors.accent.primary10 }}>
                <LucideChartSpline size={theme.iconSize.md} color={theme.colors.accent.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-text-primary">Deep Analysis</Text>
                <Text className="text-xs text-text-secondary">Personalized workout breakdown</Text>
              </View>
              <CheckCircle2 size={20} color={theme.colors.accent.primary} />
            </View>
          </View>

          {/* Gemini Powered */}
          <View className="relative">
            {/* Glow effect */}
            <View
              className="absolute"
              style={{
                top: -1,
                left: -1,
                right: -1,
                bottom: -1,
                borderRadius: theme.borderRadius.xl,
                backgroundColor: theme.colors.accent.primary,
                opacity: 0.2,
                shadowColor: theme.colors.accent.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
              }}
            />
            <View className="relative flex-row items-center gap-4 rounded-xl border border-white/5 bg-bg-cardDark p-4">
              <View
                className="h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: theme.colors.accent.primary10 }}>
                <Sparkles size={theme.iconSize.md} color={theme.colors.accent.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-text-primary">Gemini Powered</Text>
                <Text className="text-xs text-text-secondary">
                  Advanced LLM fitness intelligence
                </Text>
              </View>
              <CheckCircle2 size={20} color={theme.colors.accent.primary} />
            </View>
          </View>

          {/* Secure Token */}
          <View className="relative">
            {/* Glow effect */}
            <View
              className="absolute"
              style={{
                top: -1,
                left: -1,
                right: -1,
                bottom: -1,
                borderRadius: theme.borderRadius.xl,
                backgroundColor: theme.colors.accent.primary,
                opacity: 0.2,
                shadowColor: theme.colors.accent.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
              }}
            />
            <View className="relative flex-row items-center gap-4 rounded-xl border border-white/5 bg-bg-cardDark p-4">
              <View
                className="h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: theme.colors.accent.primary10 }}>
                <Key size={theme.iconSize.md} color={theme.colors.accent.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-text-primary">Secure Token</Text>
                <Text className="text-xs text-text-secondary">
                  Direct integration with your key
                </Text>
              </View>
              <CheckCircle2 size={20} color={theme.colors.accent.primary} />
            </View>
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
