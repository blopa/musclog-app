import { useLocalSearchParams, useRouter } from 'expo-router';
import { Target, Zap, Activity } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BottomButtonWrapper } from '../../components/BottomButtonWrapper';
import { MasterLayout } from '../../components/MasterLayout';
import { Button } from '../../components/theme/Button';
import { SyncGoal } from '../../database/models/MenstrualCycle';
import { MenstrualCycleRepository } from '../../database/repositories/MenstrualCycleRepository';
import { theme } from '../../theme';
import { setOnboardingCompleted } from '../../utils/onboardingService';

export default function CycleGoal() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    lastPeriodStartDate: string;
    useHormonalBirthControl: string;
    birthControlType?: string;
    avgCycleLength: string;
    avgPeriodDuration: string;
  }>();

  const [selectedGoal, setSelectedGoal] = useState<SyncGoal>('performance');
  const [isSaving, setIsSaving] = useState(false);

  const goals: { label: string; value: SyncGoal; icon: any; description: string }[] = [
    {
      label: t('onboarding.cycleSetup.goal.performance'),
      value: 'performance',
      icon: Target,
      description: t('onboarding.cycleSetup.goal.performanceDescription', 'Peak strength and PR optimization.'),
    },
    {
      label: t('onboarding.cycleSetup.goal.symptoms'),
      value: 'symptoms',
      icon: Activity,
      description: t('onboarding.cycleSetup.goal.symptomsDescription', 'Focus on comfort and recovery during shifts.'),
    },
    {
      label: t('onboarding.cycleSetup.goal.energy'),
      value: 'energy',
      icon: Zap,
      description: t('onboarding.cycleSetup.goal.energyDescription', 'Anticipate lows and adjust intensity accordingly.'),
    },
  ];

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      await MenstrualCycleRepository.createNewCycle({
        lastPeriodStartDate: parseInt(params.lastPeriodStartDate, 10),
        useHormonalBirthControl: params.useHormonalBirthControl === 'true',
        birthControlType: params.birthControlType,
        avgCycleLength: parseInt(params.avgCycleLength, 10),
        avgPeriodDuration: parseInt(params.avgPeriodDuration, 10),
        syncGoal: selectedGoal,
      });

      await setOnboardingCompleted();
      router.push('/');
    } catch (error) {
      console.error('Error saving cycle setup:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <ScrollView className="flex-1 px-6 pt-8">
        <Text
          className="mb-2 text-3xl font-bold tracking-tight"
          style={{ color: theme.colors.text.white }}
        >
          {t('onboarding.cycleSetup.goal.title')}
        </Text>
        <Text className="mb-8 text-lg text-text-secondary">
          {t('onboarding.cycleSetup.goal.description')}
        </Text>

        <View className="gap-4">
          {goals.map((goal) => (
            <Pressable
              key={goal.value}
              onPress={() => setSelectedGoal(goal.value)}
              className={`rounded-2xl border-2 p-5 ${
                selectedGoal === goal.value
                  ? 'border-accent-primary bg-accent-primary10'
                  : 'border-white/10 bg-bg-card'
              }`}
            >
              <View className="flex-row items-center gap-4">
                <View
                  className={`h-12 w-12 items-center justify-center rounded-full ${
                    selectedGoal === goal.value ? 'bg-accent-primary' : 'bg-bg-navActive'
                  }`}
                >
                  <goal.icon
                    size={24}
                    color={selectedGoal === goal.value ? theme.colors.text.black : theme.colors.text.tertiary}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className={`text-xl font-bold ${
                      selectedGoal === goal.value ? 'text-accent-primary' : 'text-text-primary'
                    }`}
                  >
                    {goal.label}
                  </Text>
                  <Text className="text-sm text-text-secondary">{goal.description}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <BottomButtonWrapper>
        <Button
          label={t('onboarding.personalInfo.finish')}
          onPress={handleFinish}
          variant="accent"
          size="md"
          width="full"
          loading={isSaving}
        />
      </BottomButtonWrapper>
    </MasterLayout>
  );
}
