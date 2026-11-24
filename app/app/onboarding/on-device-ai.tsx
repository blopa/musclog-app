import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { MasterLayout } from '@/components/MasterLayout';
import { scrollCueBottom } from '@/components/modals/footerClearance';
import { AiChoiceCard } from '@/components/onboarding/AiChoiceCard';
import { QuickSetupProgressBar } from '@/components/QuickSetupProgressBar';
import { Button } from '@/components/theme/Button';
import { useOnDeviceStatus } from '@/hooks/useOnDeviceStatus';
import { useScrollFade } from '@/hooks/useScrollFade';
import { useTheme } from '@/hooks/useTheme';
import {
  aiStepRoute,
  MUSCLOG_API_ROUTE,
  ON_DEVICE_AI_OPTIONS_ROUTE,
} from '@/utils/onboardingRoutes';
import { hasLocalAiOption } from '@/utils/onDeviceStatus';

type Answer = 'yes' | 'no';

/**
 * The first AI question: should the coach run on this phone? Asked only when this phone can run
 * AI locally (Apple Intelligence, or enough room for the downloadable model); otherwise it hands
 * straight on to the Musclog AI step.
 */
export default function OnDeviceAiScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const status = useOnDeviceStatus({ refresh: true });
  const { scrollProps, FadeIndicator } = useScrollFade();
  const [footerHeight, setFooterHeight] = useState(0);
  const [answer, setAnswer] = useState<Answer>('yes');

  const { nextRoute, quickStep, quickTotal } = useLocalSearchParams<{
    nextRoute?: string;
    quickStep?: string;
    quickTotal?: string;
  }>();
  const params = {
    nextRoute: nextRoute || '/app',
    quickStep: quickStep ? Number(quickStep) : undefined,
    quickTotal: quickTotal ? Number(quickTotal) : undefined,
  };
  const quickStepNum = params.quickStep ?? null;
  const quickTotalNum = params.quickTotal ?? 6;
  const hasOption = hasLocalAiOption(status);

  // Nothing local to offer on this phone: skip the question.
  useEffect(() => {
    if (!hasOption) {
      router.replace(aiStepRoute(MUSCLOG_API_ROUTE, params) as never);
    }
    // `params` is rebuilt every render from the same route params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOption, router, nextRoute, quickStep, quickTotal]);

  if (!hasOption) {
    return null;
  }

  const handleContinue = () => {
    router.navigate(
      aiStepRoute(
        answer === 'yes' ? ON_DEVICE_AI_OPTIONS_ROUTE : MUSCLOG_API_ROUTE,
        params
      ) as never
    );
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {quickStepNum != null ? (
          <QuickSetupProgressBar current={quickStepNum} total={quickTotalNum} />
        ) : null}

        <ScrollView
          {...scrollProps}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: footerHeight + 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-6 px-6 pt-6">
            <View className="gap-3">
              <Text
                accessibilityRole="header"
                className="font-bold"
                style={{
                  color: theme.colors.text.primary,
                  fontSize: theme.typography.fontSize['3xl'],
                  lineHeight: theme.typography.fontSize['3xl'] * 1.2,
                }}
              >
                {t('onDeviceAi.onboarding.ask.heading')}
              </Text>
              <Text
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.typography.fontSize.base,
                  lineHeight: theme.typography.fontSize.base * 1.45,
                }}
              >
                {t('onDeviceAi.onboarding.ask.intro')}
              </Text>
            </View>

            <View
              className="gap-3"
              accessibilityRole="radiogroup"
              accessibilityLabel={t('onDeviceAi.onboarding.ask.choicesLabel')}
            >
              <AiChoiceCard
                testID="on-device-ai-yes"
                title={t('onDeviceAi.onboarding.ask.yes.title')}
                selected={answer === 'yes'}
                onPress={() => setAnswer('yes')}
                points={[
                  { kind: 'plus', text: t('onDeviceAi.onboarding.ask.yes.points.private') },
                  { kind: 'plus', text: t('onDeviceAi.onboarding.ask.yes.points.offline') },
                  { kind: 'plus', text: t('onDeviceAi.onboarding.ask.yes.points.free') },
                ]}
              />
              <AiChoiceCard
                testID="on-device-ai-no"
                title={t('onDeviceAi.onboarding.ask.no.title')}
                selected={answer === 'no'}
                onPress={() => setAnswer('no')}
                points={[
                  { kind: 'plus', text: t('onDeviceAi.onboarding.ask.no.points.other') },
                  { kind: 'plus', text: t('onDeviceAi.onboarding.ask.no.points.later') },
                ]}
              />
            </View>
          </View>
        </ScrollView>

        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: scrollCueBottom(footerHeight),
          }}
        >
          {FadeIndicator}
        </View>

        <BottomButtonWrapper onHeightChange={setFooterHeight}>
          <Button
            testID="on-device-ai-continue"
            label={t(
              answer === 'yes'
                ? 'onDeviceAi.onboarding.ask.cta.yes'
                : 'onDeviceAi.onboarding.ask.cta.no'
            )}
            onPress={handleContinue}
            variant="accent"
            size="lg"
            width="full"
          />
        </BottomButtonWrapper>
      </SafeAreaView>
    </MasterLayout>
  );
}
