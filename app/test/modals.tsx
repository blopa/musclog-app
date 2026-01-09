import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/theme/Button';
import { NutritionGoalsModal, NutritionGoals } from '../../components/NutritionGoalsModal';

export default function ModalsTestScreen() {
  const [isNutritionGoalsVisible, setIsNutritionGoalsVisible] = useState(false);

  const handleSaveGoals = (goals: NutritionGoals) => {
    console.log('Goals saved:', goals);
    // You can add additional logic here, like saving to state or API
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-6">
          {/* Header */}
          <View className="mb-8">
            <Text className="mb-2 text-3xl font-bold text-text-primary">Modals Test</Text>
            <Text className="text-base text-text-secondary">
              Test various modal components in the app
            </Text>
          </View>

          {/* Nutrition Goals Modal */}
          <View className="mb-6">
            <Text className="mb-4 text-xl font-bold text-text-primary">Nutrition Goals Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              A comprehensive modal for setting nutrition and body composition goals with
              interactive sliders and controls.
            </Text>
            <Button
              label="Open Nutrition Goals Modal"
              variant="accent"
              width="full"
              onPress={() => setIsNutritionGoalsVisible(true)}
            />
          </View>

          {/* Bottom spacing */}
          <View className="h-8" />
        </View>
      </ScrollView>

      {/* Nutrition Goals Modal */}
      <NutritionGoalsModal
        visible={isNutritionGoalsVisible}
        onClose={() => setIsNutritionGoalsVisible(false)}
        onSave={handleSaveGoals}
      />
    </SafeAreaView>
  );
}
