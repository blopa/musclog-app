import { View, Text, Pressable } from 'react-native';
import { LucideChartSpline, Sparkles, Key, CheckCircle2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { GoogleGeminiIllustration } from './GoogleGeminiIllustration';
import { GoogleSignInButton } from './GoogleSignInButton';

// Illustration Component
type ConnectGoogleAccountBodyProps = {
  onClose: () => void;
  onConnect?: () => void;
  onMaybeLater?: () => void;
};

export function ConnectGoogleAccountBody({
  onClose,
  onConnect,
  onMaybeLater,
}: ConnectGoogleAccountBodyProps) {
  const { t } = useTranslation();
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
    <>
      <View className="flex-1 px-5 pb-6">
        {/* Main Visual Card */}
        <GoogleGeminiIllustration
          googleLogoUrl={googleLogoUrl}
          backgroundImageUrl={backgroundImageUrl}
        />

        {/* Title and Description */}
        <View className="mb-8 text-center">
          <Text className="mb-3 text-center text-3xl font-extrabold leading-tight tracking-tight text-text-primary">
            {t('connectGoogleAccount.unlockTitle')}{' '}
            <Text style={{ color: theme.colors.accent.primary }}>
              {t('connectGoogleAccount.aiInsights')}
            </Text>
          </Text>
          <Text className="px-2 text-center text-base font-normal leading-relaxed text-text-secondary">
            {t('connectGoogleAccount.description')}
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
                top: theme.offset.glowSmall,
                left: theme.offset.glowSmall,
                right: theme.offset.glowSmall,
                bottom: theme.offset.glowSmall,
                borderRadius: theme.borderRadius.xl,
                backgroundColor: theme.colors.accent.primary,
                opacity: theme.colors.opacity.subtle,
                shadowColor: theme.colors.accent.primary,
                shadowOffset: theme.shadowOffset.zero,
                shadowOpacity: theme.colors.opacity.subtle,
                shadowRadius: theme.shadows.radius8.shadowRadius,
              }}
            />
            <View className="relative flex-row items-center gap-4 rounded-xl border border-white/5 bg-bg-cardDark p-4">
              <View
                className="h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: theme.colors.accent.primary10 }}>
                <LucideChartSpline size={theme.iconSize.md} color={theme.colors.accent.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-text-primary">
                  {t('connectGoogleAccount.features.deepAnalysis.title')}
                </Text>
                <Text className="text-xs text-text-secondary">
                  {t('connectGoogleAccount.features.deepAnalysis.description')}
                </Text>
              </View>
              <CheckCircle2 size={theme.iconSize.lg} color={theme.colors.accent.primary} />
            </View>
          </View>

          {/* Gemini Powered */}
          <View className="relative">
            {/* Glow effect */}
            <View
              className="absolute"
              style={{
                top: theme.offset.glowSmall,
                left: theme.offset.glowSmall,
                right: theme.offset.glowSmall,
                bottom: theme.offset.glowSmall,
                borderRadius: theme.borderRadius.xl,
                backgroundColor: theme.colors.accent.primary,
                opacity: theme.colors.opacity.subtle,
                shadowColor: theme.colors.accent.primary,
                shadowOffset: theme.shadowOffset.zero,
                shadowOpacity: theme.colors.opacity.subtle,
                shadowRadius: theme.shadows.radius8.shadowRadius,
              }}
            />
            <View className="relative flex-row items-center gap-4 rounded-xl border border-white/5 bg-bg-cardDark p-4">
              <View
                className="h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: theme.colors.accent.primary10 }}>
                <Sparkles size={theme.iconSize.md} color={theme.colors.accent.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-text-primary">
                  {t('connectGoogleAccount.features.geminiPowered.title')}
                </Text>
                <Text className="text-xs text-text-secondary">
                  {t('connectGoogleAccount.features.geminiPowered.description')}
                </Text>
              </View>
              <CheckCircle2 size={theme.iconSize.lg} color={theme.colors.accent.primary} />
            </View>
          </View>

          {/* Secure Token */}
          <View className="relative">
            {/* Glow effect */}
            <View
              className="absolute"
              style={{
                top: theme.offset.glowSmall,
                left: theme.offset.glowSmall,
                right: theme.offset.glowSmall,
                bottom: theme.offset.glowSmall,
                borderRadius: theme.borderRadius.xl,
                backgroundColor: theme.colors.accent.primary,
                opacity: theme.colors.opacity.subtle,
                shadowColor: theme.colors.accent.primary,
                shadowOffset: theme.shadowOffset.zero,
                shadowOpacity: theme.colors.opacity.subtle,
                shadowRadius: theme.shadows.radius8.shadowRadius,
              }}
            />
            <View className="relative flex-row items-center gap-4 rounded-xl border border-white/5 bg-bg-cardDark p-4">
              <View
                className="h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: theme.colors.accent.primary10 }}>
                <Key size={theme.iconSize.md} color={theme.colors.accent.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-text-primary">
                  {t('connectGoogleAccount.features.secureToken.title')}
                </Text>
                <Text className="text-xs text-text-secondary">
                  {t('connectGoogleAccount.features.secureToken.description')}
                </Text>
              </View>
              <CheckCircle2 size={theme.iconSize.lg} color={theme.colors.accent.primary} />
            </View>
          </View>
        </View>
      </View>
      <View className="bg-transparent px-5 pb-2 pt-4">
        <View className="w-full items-center">
          <GoogleSignInButton
            onPress={handleConnect}
            variant="dark"
          />
        </View>
        <Pressable
          onPress={handleMaybeLater}
          className="mt-4 w-full items-center justify-center rounded-lg px-4 py-2">
          <Text className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
            {t('connectGoogleAccount.maybeLater')}
          </Text>
        </Pressable>
      </View>
    </>
  );
}
