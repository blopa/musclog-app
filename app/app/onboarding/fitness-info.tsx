import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { EditFitnessDetailsBody } from '@/components/EditFitnessDetailsBody';
import { MasterLayout } from '@/components/MasterLayout';
import { MaybeLaterButton } from '@/components/MaybeLaterButton';
import { Button } from '@/components/theme/Button';
import { useOnboardingFitnessData } from '@/hooks/useOnboardingFitnessData';
import { useTheme } from '@/hooks/useTheme';

export default function FitnessInfo() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const {
    isLoading,
    isSaving,
    initialData,
    setCurrentFormData,
    saveFitnessData,
    getMergedFitnessData,
  } = useOnboardingFitnessData();

  const handleSave = async () => {
    const data = getMergedFitnessData();
    const result = await saveFitnessData(data);

    router.navigate({
      pathname: '/onboarding/fitness-basis',
      params:
        result.weightMetricId && result.heightMetricId
          ? { weightMetricId: result.weightMetricId, heightMetricId: result.heightMetricId }
          : undefined,
    });
  };

  const handleSkip = async () => {
    const data = getMergedFitnessData();
    const result = await saveFitnessData(data);

    router.navigate({
      pathname: '/onboarding/fitness-basis',
      params:
        result.weightMetricId && result.heightMetricId
          ? { weightMetricId: result.weightMetricId, heightMetricId: result.heightMetricId }
          : undefined,
    });
  };

  if (isLoading) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <ActivityIndicator size="large" color={theme.colors.accent.primary} />
      </MasterLayout>
    );
  }

  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="flex-1">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: theme.spacing.padding.bottomButton,
          }}
        >
          <View className="px-6 pb-2 pt-4">
            <Text
              className="text-2xl font-bold tracking-tight"
              style={{ color: theme.colors.text.white }}
            >
              {t('onboarding.fitnessInfo.physicalTitle')}
            </Text>
          </View>

          <EditFitnessDetailsBody
            onClose={() => {}}
            onSave={async (data) => {
              await saveFitnessData(data);
            }}
            onFormChange={setCurrentFormData}
            initialData={initialData}
            isLoading={isSaving}
            onMaybeLater={handleSkip}
            hideSaveButton
            hideMaybeLaterButton
            mode="physical"
          />
        </ScrollView>

        {/* Floating Action Buttons */}
        <BottomButtonWrapper>
          <View className="gap-3">
            <Button
              label={t('onboarding.fitnessInfo.next')}
              onPress={handleSave}
              variant="accent"
              size="md"
              width="full"
              loading={isSaving}
            />
            <MaybeLaterButton onPress={handleSkip} text={t('onboarding.fitnessInfo.maybeLater')} />
            <View style={{ height: theme.spacing.gap.xs }} />
          </View>
        </BottomButtonWrapper>
      </View>
    </MasterLayout>
  );
}
