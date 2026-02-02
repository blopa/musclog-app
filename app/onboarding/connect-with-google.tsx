import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { ConnectGoogleAccountBody } from '../../components/ConnectGoogleAccountBody';
import { MasterLayout } from '../../components/MasterLayout';
import { MaybeLaterButton } from '../../components/MaybeLaterButton';
import { Button } from '../../components/theme/Button';
import { TEMP_GOOGLE_USER_NAME } from '../../constants/auth';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { theme } from '../../theme';
import { getAccessToken, getGoogleUserInfo, handleGoogleSignIn } from '../../utils/googleAuth';
import { setCurrentOnboardingStep } from '../../utils/onboardingService';
import { showSnackbar } from '../../utils/snackbarService';

export default function ConnectWithGoogle() {
  const { t } = useTranslation();
  const router = useRouter();
  const { authData, isSigningIn, promptAsync } = useGoogleAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConnect = useCallback(async () => {
    try {
      // Persist current onboarding step so we can return here after external auth
      try {
        await setCurrentOnboardingStep('/onboarding/connect-with-google');
      } catch (e) {
        console.warn('Failed to persist onboarding step before Google auth', e);
      }

      await promptAsync();
    } catch (error) {
      showSnackbar('error', t('onboarding.connectGoogle.error'));
      console.error('Error initiating Google sign-in:', error);
    }
  }, [promptAsync, t]);

  // Handle auth data when it becomes available
  useEffect(() => {
    if (authData && !isProcessing) {
      const processAuth = async () => {
        try {
          setIsProcessing(true);
          const isValid = await handleGoogleSignIn(authData);
          if (isValid) {
            const token = await getAccessToken();
            let userName: string | undefined;
            if (token) {
              const userInfo = await getGoogleUserInfo(token);
              if (userInfo && userInfo.name) {
                userName = userInfo.name;
                try {
                  await AsyncStorage.setItem(TEMP_GOOGLE_USER_NAME, userInfo.name);
                } catch (e) {
                  console.warn('Failed to persist temp google user name', e);
                }
              }
            }

            // Show a welcome UI with the user's name and a Continue button instead of forwarding immediately
            if (userName) {
              setTempName(userName);
            }
            setShowWelcome(true);
          }
        } catch (error) {
          showSnackbar('error', t('onboarding.connectGoogle.errorProcessing'));
          console.error('Error processing Google sign-in:', error);
        } finally {
          setIsProcessing(false);
        }
      };

      processAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authData, router, t]);

  const [showWelcome, setShowWelcome] = useState(false);
  const [tempName, setTempName] = useState<string | undefined>(undefined);

  return (
    <MasterLayout showNavigationMenu={false}>
      <ScrollView>
        <View className="px-6 pb-2 pt-4">
          <Text
            className="text-2xl font-bold tracking-tight"
            style={{ color: theme.colors.text.white }}
          >
            {t('onboarding.connectGoogle.title')}
          </Text>
        </View>
        {showWelcome ? (
          <View className="px-5 pb-6">
            <View className="mb-6">
              <Text className="text-center text-2xl font-bold text-white">
                {t('onboarding.connectGoogle.welcome')}{' '}
                <Text style={{ color: theme.colors.accent.primary }}>{tempName || ''}</Text>
              </Text>
              <Text className="mt-2 text-center text-sm text-text-secondary">
                {t('onboarding.connectGoogle.welcomeDescription')}
              </Text>
            </View>

            <View className="mb-4 w-full items-center">
              <Button
                label={t('onboarding.connectGoogle.continue')}
                onPress={() => {
                  router.push('/onboarding/fitness-info');
                }}
                variant="gradientCta"
                size="md"
                width="full"
              />
            </View>

            <MaybeLaterButton
              onPress={() => {
                router.push('/onboarding/fitness-info');
              }}
              text={t('connectGoogleAccount.maybeLater')}
            />
          </View>
        ) : (
          <ConnectGoogleAccountBody
            onMaybeLater={() => {
              router.push('/onboarding/fitness-info');
            }}
            onConnect={handleConnect}
            onClose={() => {}}
            isSigningIn={isSigningIn || isProcessing}
          />
        )}
      </ScrollView>
    </MasterLayout>
  );
}
