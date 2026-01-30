import { View, Text } from 'react-native';
import { LucideChartSpline, Sparkles, CheckCircle2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { GoogleGeminiIllustration } from './GoogleGeminiIllustration';
import { GoogleSignInButton } from './GoogleSignInButton';
import { MaybeLaterButton } from './MaybeLaterButton';

// Illustration Component
type ConnectGoogleAccountBodyProps = {
  onClose: () => void;
  onConnect?: () => void;
  onMaybeLater?: () => void;
  isSigningIn?: boolean;
};

export function ConnectGoogleAccountBody({
  onClose,
  onConnect,
  onMaybeLater,
  isSigningIn = false,
}: ConnectGoogleAccountBodyProps) {
  const { t } = useTranslation();

  const handleConnect = () => {
    if (!isSigningIn) {
      onConnect?.();
    }
  };

  const handleMaybeLater = () => {
    onMaybeLater?.();
    onClose();
  };

  return (
    <>
      <View className="flex-1 px-5 pb-6">
        {/* Main Visual Card */}
        <GoogleGeminiIllustration />

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
                style={{ backgroundColor: theme.colors.accent.primary10 }}
              >
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
                style={{ backgroundColor: theme.colors.accent.primary10 }}
              >
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
        </View>
      </View>
      <View className="bg-transparent px-5 pb-2 pt-4">
        <View className="w-full items-center">
          <GoogleSignInButton onPress={handleConnect} variant="dark" disabled={isSigningIn} />
        </View>
        <MaybeLaterButton onPress={handleMaybeLater} text={t('connectGoogleAccount.maybeLater')} />
      </View>
    </>
  );
}
