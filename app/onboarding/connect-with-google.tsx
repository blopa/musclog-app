import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { ConnectGoogleAccountBody } from '../../components/ConnectGoogleAccountBody';
import { useRouter } from 'expo-router';

export default function ConnectWithGoogle() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
      <ScrollView>
        <View className="px-6 pb-2 pt-4">
          <Text
            className="text-2xl font-bold tracking-tight"
            style={{ color: theme.colors.text.white }}>
            {t('onboarding.connectGoogle.title')}
          </Text>
        </View>
        <ConnectGoogleAccountBody
          onMaybeLater={() => {
            router.push('/onboarding/fitness-info');
          }}
          onConnect={() => {}}
          onClose={() => {}}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
