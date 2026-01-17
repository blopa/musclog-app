import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { EditFitnessDetailsBody } from '../../components/EditFitnessDetailsBody';

export default function FitnessInfo() {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
      <ScrollView>
        <View className="px-6 pb-2 pt-4">
          <Text
            className="text-2xl font-bold tracking-tight"
            style={{ color: theme.colors.text.white }}>
            {t('onboarding.fitnessInfo.title')}
          </Text>
        </View>
        <EditFitnessDetailsBody onClose={() => {}} onSave={() => {}} />
      </ScrollView>
    </SafeAreaView>
  );
}
