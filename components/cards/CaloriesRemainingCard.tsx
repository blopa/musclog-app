import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { GenericCard } from './GenericCard';
import { MacroCard } from './MacroCard';

type CaloriesRemainingCardProps = {
  calories: {
    consumed: number;
    total: number;
    percentage: number;
  };
  macros: {
    protein: {
      percentage: number;
      amount: string;
      goal: number;
      color: string;
      progressColor: string;
    };
    carbs: {
      percentage: number;
      amount: string;
      goal: number;
      color: string;
      progressColor: string;
    };
    fat: {
      percentage: number;
      amount: string;
      goal: number;
      color: string;
      progressColor: string;
    };
  };
};

export function CaloriesRemainingCard({ calories, macros }: CaloriesRemainingCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <GenericCard variant="highlighted" size="lg" backgroundVariant="gradient">
      <View className="p-6">
        <View className="mb-6">
          <Text className="mb-2 text-sm text-text-secondary">{t('food.calories')}</Text>
          <View className="mb-1 flex-row items-baseline gap-2">
            <Text className="text-6xl font-bold text-text-primary">
              {calories.consumed.toLocaleString('en-US', { useGrouping: false })}
            </Text>
            <Text className="text-2xl text-text-secondary">
              / {calories.total.toLocaleString('en-US', { useGrouping: false })}
            </Text>
            <Text
              className="ml-auto text-3xl font-semibold"
              style={{ color: theme.colors.accent.secondary }}
            >
              {calories.percentage}%
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View
          className="mb-6 h-3 overflow-hidden rounded-full"
          style={{ backgroundColor: theme.colors.background.gray800Opacity50 }}
        >
          <LinearGradient
            colors={theme.colors.gradients.progress}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: '100%',
              borderRadius: theme.borderRadius.full,
              width: `${calories.percentage}%`,
            }}
          />
        </View>

        {/* Macros */}
        <View className="flex-row gap-3">
          <MacroCard
            name={t('food.macros.protein')}
            percentage={macros.protein.percentage}
            amount={macros.protein.amount}
            goal={macros.protein.goal}
            color={macros.protein.color}
            progressColor={macros.protein.progressColor}
          />
          <MacroCard
            name={t('food.macros.carbs')}
            percentage={macros.carbs.percentage}
            amount={macros.carbs.amount}
            goal={macros.carbs.goal}
            color={macros.carbs.color}
            progressColor={macros.carbs.progressColor}
          />
          <MacroCard
            name={t('food.macros.fat')}
            percentage={macros.fat.percentage}
            amount={macros.fat.amount}
            goal={macros.fat.goal}
            color={macros.fat.color}
            progressColor={macros.fat.progressColor}
          />
        </View>
      </View>
    </GenericCard>
  );
}
