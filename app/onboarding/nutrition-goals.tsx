import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { NutritionGoalsBody } from '../../components/NutritionGoalsBody';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';

export default function NutritionGoalsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  // Macro states
  const [protein, setProtein] = useState(180);
  const [carbs, setCarbs] = useState(250);
  const [fats, setFats] = useState(80);

  // Body metrics states
  const [targetWeight, setTargetWeight] = useState(75);
  const [targetBodyFat, setTargetBodyFat] = useState(12);
  const [targetBMI, setTargetBMI] = useState(23.5);
  const [targetFFMI, setTargetFFMI] = useState(21.0);

  // Memoize calculations
  const { totalCalories } = useMemo(() => {
    const total = protein * 4 + carbs * 4 + fats * 9;

    return {
      totalCalories: total,
    };
  }, [protein, carbs, fats]);

  return (
    <ScrollView>
      <View className="px-6 pb-2 pt-4">
        <Text
          className="text-2xl font-bold tracking-tight"
          style={{ color: theme.colors.text.white }}>
          {t('nutritionGoals.title')}
        </Text>
      </View>
      <NutritionGoalsBody
        onSave={() => router.back()}
        initialGoals={{
          totalCalories,
          protein,
          carbs,
          fats,
          targetWeight,
          targetBodyFat,
          targetBMI,
          targetFFMI,
        }}
      />
    </ScrollView>
  );
}
