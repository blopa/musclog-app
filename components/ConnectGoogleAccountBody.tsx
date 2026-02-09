import AsyncStorage from '@react-native-async-storage/async-storage';
import { CheckCircle2, LucideChartSpline, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import {
  GOOGLE_REDIRECT_URI_MOBILE,
  TEMP_GOOGLE_AUTH_CODE,
  TEMP_GOOGLE_USER_NAME,
} from '../constants/auth';
import { exchangeCodeForToken } from '../hooks/useGoogleAuth';
import { useTheme } from '../hooks/useTheme';
import { getAccessToken, getGoogleUserInfo, handleGoogleSignIn } from '../utils/googleAuth';
import { GoogleGeminiIllustration } from './GoogleGeminiIllustration';
import { GoogleSignInButton } from './GoogleSignInButton';
import { MaybeLaterButton } from './MaybeLaterButton';
import { Button } from './theme/Button';

// Illustration Component
type ConnectGoogleAccountBodyProps = {
  onClose: () => void;
  onConnect?: () => void;
  onMaybeLater?: () => void;
  onContinue?: () => void;
  isSigningIn?: boolean;
};

export function ConnectGoogleAccountBody({
  onClose,
  onConnect,
  onMaybeLater,
  isSigningIn = false,
  onContinue,
}: ConnectGoogleAccountBodyProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [userName, setUserName] = useState<string | undefined>(undefined);

  const getSetUSerInfo = useCallback(async (token: string) => {
    const userInfo = await getGoogleUserInfo(token);
    if (userInfo?.name) {
      setUserName(userInfo.name);
      await AsyncStorage.setItem(TEMP_GOOGLE_USER_NAME, userInfo.name);
    }
  }, []);

  useEffect(() => {
    const loadCodeParam = async () => {
      try {
        const code = await AsyncStorage.getItem(TEMP_GOOGLE_AUTH_CODE);
        if (code) {
          await AsyncStorage.removeItem(TEMP_GOOGLE_AUTH_CODE);
          const tokenData = await exchangeCodeForToken(code, GOOGLE_REDIRECT_URI_MOBILE);
          const { isValid, accessToken } = await handleGoogleSignIn(tokenData);

          if (isValid) {
            await getSetUSerInfo(accessToken);
          }
        }
      } catch (e) {
        console.warn('Failed to load auth code from AsyncStorage', e);
      }
    };

    loadCodeParam();
  }, [getSetUSerInfo]);

  useEffect(() => {
    const checkForExistingToken = async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          await getSetUSerInfo(token);
        }
      } catch (error) {
        console.error('Error checking for existing token:', error);
      }
    };

    checkForExistingToken();
  }, [getSetUSerInfo]);

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
    <ScrollView>
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
          {userName ? (
            <View className="px-5 pb-6">
              <View className="mb-6">
                <Text className="text-center text-2xl font-bold text-white">
                  {t('onboarding.connectGoogle.welcome', { name: userName })}
                </Text>
                <Text className="mt-2 text-center text-sm text-text-secondary">
                  {t('onboarding.connectGoogle.welcomeDescription')}
                </Text>
              </View>
              <Button
                label={t('onboarding.connectGoogle.continue')}
                onPress={() => onContinue?.()}
                variant="gradientCta"
                size="md"
                width="full"
              />
            </View>
          ) : (
            <GoogleSignInButton onPress={handleConnect} variant="dark" disabled={isSigningIn} />
          )}
        </View>
        <MaybeLaterButton onPress={handleMaybeLater} text={t('connectGoogleAccount.maybeLater')} />
      </View>
    </ScrollView>
  );
}
