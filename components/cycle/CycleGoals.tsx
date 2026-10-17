import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Chip } from '@/components/theme/Chip';
import { CYCLE_GOALS, toggleChoice } from '@/utils/cycle/preferences';
import type { CycleGoal } from '@/utils/cycle/types';

export function CycleGoals({
  value,
  onChange,
}: {
  value: CycleGoal[];
  onChange: (goals: CycleGoal[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-3">
      <Text className="text-base font-bold text-text-primary">
        {t('cycle.personalize.goalsTitle')}
      </Text>
      <Text className="text-sm text-text-secondary">{t('cycle.personalize.goalsHint')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {CYCLE_GOALS.map((goal) => (
          <Chip
            key={goal}
            label={t(`cycle.personalize.goals.${goal}`)}
            role="checkbox"
            selected={value.includes(goal)}
            onPress={() => onChange(toggleChoice(value, goal))}
          />
        ))}
      </View>
    </View>
  );
}
