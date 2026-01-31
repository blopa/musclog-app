import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectGoogleAccountBody } from '../../components/ConnectGoogleAccountBody';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { theme } from '../../theme';
import { handleGoogleSignIn } from '../../utils/googleAuth';

export default function ConnectWithGoogle() {
  const { t } = useTranslation();
  const router = useRouter();
  const { authData, isSigningIn, promptAsync } = useGoogleAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConnect = async () => {
    try {
      await promptAsync();
    } catch (error) {
      console.error('Error initiating Google sign-in:', error);
    }
  };

  // Handle auth data when it becomes available
  useEffect(() => {
    if (authData && !isProcessing) {
      const processAuth = async () => {
        try {
          setIsProcessing(true);
          const isValid = await handleGoogleSignIn(authData);
          if (isValid) {
            router.push('/onboarding/fitness-info');
          }
        } catch (error) {
          console.error('Error processing Google sign-in:', error);
        } finally {
          setIsProcessing(false);
        }
      };
      processAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authData, router]);

  return (
    <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
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
          onClose={() => {}}
          isSigningIn={isSigningIn || isProcessing}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
