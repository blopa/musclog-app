import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MasterLayout } from '../components/MasterLayout';

export default function WorkoutsScreen() {
  const { t } = useTranslation();

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 items-center justify-center px-6 py-12">
          <Text className="mb-4 text-4xl font-bold text-white">Hello World!</Text>
          <Text className="text-center text-lg text-gray-400">
            This is the Workouts screen. Navigate here by clicking the Workouts button in the bottom
            navigation.
          </Text>
        </View>
        {/* Bottom spacing for navigation */}
        <View className="h-24" />
      </ScrollView>
    </MasterLayout>
  );
}
