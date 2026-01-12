import { View, Text, ScrollView } from 'react-native';
import { EditPersonalInfoBody } from '../components/EditPersonalInfoBody';

export default function NutritionGoalsScreen() {
  return (
    <ScrollView>
      <View className="px-6 pb-2 pt-4">
        <Text className="text-2xl font-bold tracking-tight text-white">
          Set Personal Information
        </Text>
      </View>
      <EditPersonalInfoBody />
    </ScrollView>
  );
}
