import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { BottomButtonWrapper } from '../../components/BottomButtonWrapper';
import { GenericCard } from '../../components/cards/GenericCard';
import { MasterLayout } from '../../components/MasterLayout';
import { Button } from '../../components/theme/Button';
import { type BirthControlType } from '../../database/models/MenstrualCycle';
import { theme } from '../../theme';

export default function CycleBirthControl() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ lastPeriodStartDate: string }>();
  const [useHormonal, setUseHormonal] = useState<boolean | null>(null);
  const [selectedType, setSelectedType] = useState<BirthControlType | 'none'>('none');

  const options: { label: string; value: BirthControlType | 'none' }[] = [
    { label: t('onboarding.cycleSetup.birthControl.none'), value: 'none' },
    { label: t('onboarding.cycleSetup.birthControl.pill'), value: 'pill' },
    { label: t('onboarding.cycleSetup.birthControl.iud'), value: 'iud' },
    { label: t('onboarding.cycleSetup.birthControl.implant'), value: 'implant' },
    { label: t('onboarding.cycleSetup.birthControl.other'), value: 'other' },
  ];

  const handleNext = () => {
    router.push({
      pathname: '/onboarding/cycle-length',
      params: {
        ...params,
        useHormonalBirthControl: selectedType !== 'none' ? 'true' : 'false',
        birthControlType: selectedType !== 'none' ? selectedType : undefined,
      },
    });
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <ScrollView className="flex-1 px-6 pt-8">
        <Text
          className="mb-2 text-3xl font-bold tracking-tight"
          style={{ color: theme.colors.text.white }}
        >
          {t('onboarding.cycleSetup.birthControl.title')}
        </Text>
        <Text className="mb-8 text-lg text-text-secondary">
          {t('onboarding.cycleSetup.birthControl.description')}
        </Text>

        <View className="gap-4">
          {options.map((option) => (
            <GenericCard
              key={option.value}
              isPressable
              onPress={() => setSelectedType(option.value)}
              variant={selectedType === option.value ? 'highlighted' : 'card'}
            >
              <View className="flex-row items-center justify-between p-5">
                <Text
                  className={`text-xl font-bold ${
                    selectedType === option.value ? 'text-accent-primary' : 'text-text-primary'
                  }`}
                >
                  {option.label}
                </Text>
                <View
                  className={`h-6 w-6 rounded-full border-2 items-center justify-center ${
                    selectedType === option.value ? 'border-accent-primary' : 'border-text-tertiary'
                  }`}
                >
                  {selectedType === option.value && (
                    <View className="h-3 w-3 rounded-full bg-accent-primary" />
                  )}
                </View>
              </View>
            </GenericCard>
          ))}
        </View>
      </ScrollView>

      <BottomButtonWrapper>
        <Button
          label={t('onboarding.next')}
          onPress={handleNext}
          variant="accent"
          size="md"
          width="full"
        />
      </BottomButtonWrapper>
    </MasterLayout>
  );
}
