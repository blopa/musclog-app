import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { EditPersonalInfoBody } from '../../components/EditPersonalInfoBody';

export default function PersonalInfo() {
  const { t } = useTranslation();
  return (
    <ScrollView>
      <View className="px-6 pb-2 pt-4">
        <Text
          className="text-2xl font-bold tracking-tight"
          style={{ color: theme.colors.text.white }}>
          {t('onboarding.personalInfo.title')}
        </Text>
      </View>
      <EditPersonalInfoBody />
    </ScrollView>
  );
}
