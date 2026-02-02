import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { ConnectGoogleAccountBody } from '../../components/ConnectGoogleAccountBody';
import { MasterLayout } from '../../components/MasterLayout';
import { TEMP_GOOGLE_USER_NAME } from '../../constants/auth';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { theme } from '../../theme';
import { getAccessToken, getGoogleUserInfo, handleGoogleSignIn } from '../../utils/googleAuth';
import { setCurrentOnboardingStep } from '../../utils/onboardingService';
import { showSnackbar } from '../../utils/snackbarService';

export default function ConnectWithGoogle() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ googleAuthName?: string }>();
  const { authData, isSigningIn, promptAsync } = useGoogleAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [tempName, setTempName] = useState<string | undefined>(undefined);

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
            if (token) {
              const userInfo = await getGoogleUserInfo(token);
              if (userInfo && userInfo.name) {
                try {
                  await AsyncStorage.setItem(TEMP_GOOGLE_USER_NAME, userInfo.name);
                } catch (e) {
                  console.warn('Failed to persist temp google user name', e);
                }
              }
            }
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

  // If we were restored via the onboarding restore flow, we may have a query param with the name
  useEffect(() => {
    try {
      const nameParam = searchParams?.googleAuthName;
      if (nameParam) {
        // searchParams comes decoded in expo-router, but be defensive
        const decoded = Array.isArray(nameParam) ? nameParam[0] : nameParam;
        setTempName(decodeURIComponent(decoded));
      }
    } catch (e) {
      console.warn('Error reading googleAuthName param', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <ConnectGoogleAccountBody
          onMaybeLater={() => {
            router.push('/onboarding/fitness-info');
          }}
          onConnect={handleConnect}
          onContinue={() => router.push('/onboarding/fitness-info')}
          onClose={() => {}}
          isSigningIn={isSigningIn || isProcessing}
          googleAuthName={tempName}
        />
      </ScrollView>
    </MasterLayout>
  );
}
