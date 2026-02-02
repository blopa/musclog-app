import { useLocalSearchParams,useRouter  } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { ConnectGoogleAccountBody } from '../../components/ConnectGoogleAccountBody';
import { MasterLayout } from '../../components/MasterLayout';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { theme } from '../../theme';
import { setCurrentOnboardingStep } from '../../utils/onboardingService';
import { showSnackbar } from '../../utils/snackbarService';

export default function ConnectWithGoogle() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isSigningIn, promptAsync } = useGoogleAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  console.debug('[ConnectWithGoogle] code param:', JSON.stringify(params));

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
          isSigningIn={isSigningIn}
        />
      </ScrollView>
    </MasterLayout>
  );
}
