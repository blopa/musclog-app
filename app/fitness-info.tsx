import { View, Text, ScrollView } from 'react-native';
import { EditFitnessDetailsBody } from '../components/EditFitnessDetailsBody';

export default function NutritionGoalsScreen() {
  return (
    <ScrollView>
      <View className="px-6 pb-2 pt-4">
        <Text className="text-2xl font-bold tracking-tight text-white">Set Fitness Details</Text>
      </View>
      <EditFitnessDetailsBody onClose={() => {}} onSave={() => {}} />
    </ScrollView>
  );
}
