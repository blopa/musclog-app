import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { ConnectGoogleAccountBody } from '../../components/ConnectGoogleAccountBody';

export default function ConnectWithGoogle() {
  const { t } = useTranslation();
  return (
    <ScrollView>
      <View className="px-6 pb-2 pt-4">
        <Text
          className="text-2xl font-bold tracking-tight"
          style={{ color: theme.colors.text.white }}>
          {t('onboarding.connectGoogle.title')}
        </Text>
      </View>
      <ConnectGoogleAccountBody onMaybeLater={() => {}} onConnect={() => {}} onClose={() => {}} />
    </ScrollView>
  );
}
