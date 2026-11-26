import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AiChoiceCard } from '@/components/onboarding/AiChoiceCard';
import { OnboardingChoiceScaffold } from '@/components/onboarding/OnboardingChoiceScaffold';
import { Button } from '@/components/theme/Button';
import { useOnDeviceStatus } from '@/hooks/useOnDeviceStatus';
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
  const { t } = useTranslation();
  const router = useRouter();
  const status = useOnDeviceStatus({ refresh: true });
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

  // Nothing local to offer on this phone: skip the question once the probe finishes.
  useEffect(() => {
    if (status.initialized && !hasOption) {
      router.replace(aiStepRoute(MUSCLOG_API_ROUTE, params) as never);
    }
    // `params` is rebuilt every render from the same route params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.initialized, hasOption, router, nextRoute, quickStep, quickTotal]);

  if (!status.initialized || !hasOption) {
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
    <OnboardingChoiceScaffold
      heading={t('onDeviceAi.onboarding.ask.heading')}
      intro={t('onDeviceAi.onboarding.ask.intro')}
      choicesLabel={t('onDeviceAi.onboarding.ask.choicesLabel')}
      quickStep={quickStepNum}
      quickTotal={quickTotalNum}
      footer={
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
      }
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
    </OnboardingChoiceScaffold>
  );
}
