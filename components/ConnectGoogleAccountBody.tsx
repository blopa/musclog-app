import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bot, Info, LucideChartSpline, Sparkles, Target } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { TEMP_GOOGLE_AUTH_CODE, TEMP_GOOGLE_USER_NAME } from '../constants/misc';
import { GoogleAuthService } from '../database/services';
import { exchangeCodeForToken } from '../hooks/useGoogleAuth';
import { useNavigationItems } from '../hooks/useNavigationItems';
import { useTheme } from '../hooks/useTheme';
import {
  getAccessToken,
  getGoogleRedirectUri,
  getGoogleUserInfo,
  handleGoogleSignIn,
} from '../utils/googleAuth';
import { setSentryUser } from '../utils/sentry';
import { InsightCard } from './cards/InsightCard';
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
  const { setNavSlot } = useNavigationItems();

  const getSetUSerInfo = useCallback(
    async (token: string) => {
      const userInfo = await getGoogleUserInfo(token);
      if (userInfo) {
        if (userInfo.name) {
          setUserName(userInfo.name);
          await AsyncStorage.setItem(TEMP_GOOGLE_USER_NAME, userInfo.name);
        }

        setSentryUser({ id: userInfo.id, email: userInfo.email });

        // Enable OAuth Gemini and AI settings after successful Google auth
        try {
          await GoogleAuthService.setOAuthGeminiEnabled(true);
        } catch (error) {
          console.error('Failed to enable Gemini:', error);
        }

        // Set the last navigation item to "coach" after successful Google auth
        try {
          await setNavSlot(3, 'coach');
        } catch (error) {
          console.error('Failed to set navigation slot to coach:', error);
        }
      }
    },
    [setNavSlot]
  );

  useEffect(() => {
    const loadCodeParam = async () => {
      try {
        const code = await AsyncStorage.getItem(TEMP_GOOGLE_AUTH_CODE);
        if (code) {
          await AsyncStorage.removeItem(TEMP_GOOGLE_AUTH_CODE);
          const tokenData = await exchangeCodeForToken(code, getGoogleRedirectUri());
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
    // Re-run when isSigningIn flips back to false so the web popup flow
    // (which saves the token just before isSigningIn → false) is picked up.
  }, [getSetUSerInfo, isSigningIn]);

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

        {/* Feature Pills */}
        <View className="mb-8 gap-2">
          <View className="flex-row gap-2">
            <View className="flex-1 flex-row items-center gap-2 rounded-xl border border-white/5 bg-bg-cardDark px-3 py-2">
              <LucideChartSpline size={theme.iconSize.sm} color={theme.colors.accent.primary} />
              <Text className="flex-1 text-xs font-semibold text-text-primary">
                {t('connectGoogleAccount.features.deepAnalysis.title')}
              </Text>
            </View>
            <View className="flex-1 flex-row items-center gap-2 rounded-xl border border-white/5 bg-bg-cardDark px-3 py-2">
              <Sparkles size={theme.iconSize.sm} color={theme.colors.accent.primary} />
              <Text className="flex-1 text-xs font-semibold text-text-primary">
                {t('connectGoogleAccount.features.geminiPowered.title')}
              </Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1 flex-row items-center gap-2 rounded-xl border border-white/5 bg-bg-cardDark px-3 py-2">
              <Target size={theme.iconSize.sm} color={theme.colors.accent.primary} />
              <Text className="flex-1 text-xs font-semibold text-text-primary">
                {t('connectGoogleAccount.features.smartGoals.title')}
              </Text>
            </View>
            <View className="flex-1 flex-row items-center gap-2 rounded-xl border border-white/5 bg-bg-cardDark px-3 py-2">
              <Bot size={theme.iconSize.sm} color={theme.colors.accent.primary} />
              <Text className="flex-1 text-xs font-semibold text-text-primary">
                {t('connectGoogleAccount.features.aiCoach.title')}
              </Text>
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

        {/* Billing Info */}
        <InsightCard
          variant="neutral"
          icon={Info}
          label={t('connectGoogleAccount.billingInfoLabel')}
          message={t('connectGoogleAccount.billingInfo')}
          inlineLabel
          size="sm"
        />
        <View pointerEvents="none" style={{ height: theme.spacing.margin['3xl'] }} />
      </View>
    </ScrollView>
  );
}
