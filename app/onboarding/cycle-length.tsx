import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { BottomButtonWrapper } from '../../components/BottomButtonWrapper';
import { GenericCard } from '../../components/cards/GenericCard';
import { MasterLayout } from '../../components/MasterLayout';
import { Button } from '../../components/theme/Button';
import { NumericInput } from '../../components/theme/NumericInput';
import { theme } from '../../theme';

export default function CycleLength() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [cycleLength, setCycleLength] = useState(28);
  const [periodDuration, setPeriodDuration] = useState(5);

  const handleNext = () => {
    router.push({
      pathname: '/onboarding/cycle-goal',
      params: {
        ...params,
        avgCycleLength: cycleLength.toString(),
        avgPeriodDuration: periodDuration.toString(),
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
          {t('onboarding.cycleSetup.length.title')}
        </Text>
        <Text className="mb-8 text-lg text-text-secondary">
          {t('onboarding.cycleSetup.length.description')}
        </Text>

        <View className="flex-row gap-4">
          <NumericInput
            label={t('onboarding.cycleSetup.length.cycleLength')}
            value={cycleLength.toString()}
            onChangeText={(v) => setCycleLength(parseInt(v) || 0)}
            onIncrement={() => setCycleLength((v) => Math.min(45, v + 1))}
            onDecrement={() => setCycleLength((v) => Math.max(15, v - 1))}
            unit={t('common.days', 'Days')}
          />
          <NumericInput
            label={t('onboarding.cycleSetup.length.periodDuration')}
            value={periodDuration.toString()}
            onChangeText={(v) => setPeriodDuration(parseInt(v) || 0)}
            onIncrement={() => setPeriodDuration((v) => Math.min(10, v + 1))}
            onDecrement={() => setPeriodDuration((v) => Math.max(1, v - 1))}
            unit={t('common.days', 'Days')}
          />
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
