import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { CoachPersonaPicker } from '@/components/coach/CoachPersonaPicker';
import { MasterLayout } from '@/components/MasterLayout';
import { MaybeLaterButton } from '@/components/MaybeLaterButton';
import { QuickSetupProgressBar } from '@/components/QuickSetupProgressBar';
import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';
import { NUTRITION_RESULTS_ROUTE, PERSONALIZED_SETUP_STEPS } from '@/utils/onboardingRoutes';

/**
 * Personalized setup only: who the AI coach is. Choosing a coach saves immediately (the picker
 * writes on tap), so Continue and "Keep Loggy" both just move on.
 */
export default function CoachPersonaScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const { quickStep, quickTotal } = useLocalSearchParams<{
    quickStep?: string;
    quickTotal?: string;
  }>();

  const quickStepNum = quickStep ? Number(quickStep) : null;
  const quickTotalNum = quickTotal ? Number(quickTotal) : PERSONALIZED_SETUP_STEPS;

  const handleContinue = () => {
    router.navigate(NUTRITION_RESULTS_ROUTE as never);
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {quickStepNum != null ? (
          <QuickSetupProgressBar current={quickStepNum} total={quickTotalNum} />
        ) : null}

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 160 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-6 px-6 pt-6">
            <View className="gap-2">
              <Text className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
                {t('onboarding.coachPersona.title')}
              </Text>
              <Text
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                {t('onboarding.coachPersona.subtitle')}
              </Text>
            </View>

            <CoachPersonaPicker />
          </View>
        </ScrollView>

        <BottomButtonWrapper>
          <Button
            label={t('onboarding.coachPersona.continue')}
            onPress={handleContinue}
            variant="gradientCta"
            size="md"
            width="full"
          />
          <MaybeLaterButton
            onPress={handleContinue}
            text={t('onboarding.coachPersona.keepLoggy')}
          />
        </BottomButtonWrapper>
      </SafeAreaView>
    </MasterLayout>
  );
}
