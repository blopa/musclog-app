import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AppleIntelligenceStatus } from '@/components/localModels/AppleIntelligenceStatus';
import { LocalModelCard } from '@/components/localModels/LocalModelCard';
import { useLocalModelSpace } from '@/components/localModels/useLocalModelSpace';
import { AiChoiceCard } from '@/components/onboarding/AiChoiceCard';
import { OnboardingChoiceScaffold } from '@/components/onboarding/OnboardingChoiceScaffold';
import { Button } from '@/components/theme/Button';
import { useOnDeviceStatus } from '@/hooks/useOnDeviceStatus';
import { useTheme } from '@/hooks/useTheme';
import { enableOnDeviceAi } from '@/services/onDeviceAiSetup';
import {
  DEFAULT_LOCAL_MODEL_SELECTION,
  type LocalModelSelection,
} from '@/utils/localModels/install';
import { routeAfterLocalAi } from '@/utils/onboardingRoutes';
import { showSnackbar } from '@/utils/snackbarService';

type Option = 'apple' | 'model' | 'later';

const CTA_KEYS: Record<Option, string> = {
  apple: 'onDeviceAi.onboarding.options.cta.apple',
  model: 'onDeviceAi.onboarding.options.cta.model',
  later: 'onDeviceAi.onboarding.options.cta.later',
};

function defaultOptionFor(offersApple: boolean, offersModel: boolean): Option {
  if (offersApple) {
    return 'apple';
  }

  return offersModel ? 'model' : 'later';
}

/**
 * The second local-AI question: which one. Apple Intelligence (iOS, nothing to download), the
 * downloaded model (a one-off download that keeps going in the background), or decide later.
 */
export default function OnDeviceAiOptionsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const status = useOnDeviceStatus({ refresh: true });
  const [isSaving, setIsSaving] = useState(false);
  const [selection, setSelection] = useState<LocalModelSelection>(DEFAULT_LOCAL_MODEL_SELECTION);
  const [choice, setChoice] = useState<Option | null>(null);

  const { nextRoute, quickStep, quickTotal } = useLocalSearchParams<{
    nextRoute?: string;
    quickStep?: string;
    quickTotal?: string;
  }>();
  const resolvedNextRoute = nextRoute || '/app';
  const quickStepNum = quickStep ? Number(quickStep) : null;
  const quickTotalNum = quickTotal ? Number(quickTotal) : 6;

  const offersApple = status.options.apple;
  const offersModel = status.options.model;
  const selected: Option = choice ?? defaultOptionFor(offersApple, offersModel);

  const { freeBytes, space } = useLocalModelSpace(selection);
  const blockedBySpace = selected === 'model' && freeBytes !== null && !space.enough;

  const handleContinue = async () => {
    setIsSaving(true);
    // `enableOnDeviceAi` reports a failed save itself and resolves false; the person stays here.
    const saved =
      selected === 'later' ||
      (selected === 'apple'
        ? await enableOnDeviceAi('apple')
        : await enableOnDeviceAi('gguf', { download: selection }));
    setIsSaving(false);
    if (!saved) {
      showSnackbar('error', t('common.saveError'));

      return;
    }

    router.navigate(
      (selected === 'later' ? resolvedNextRoute : routeAfterLocalAi(resolvedNextRoute)) as never
    );
  };

  const downloadNoteStyle = {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.sm,
  };

  return (
    <OnboardingChoiceScaffold
      heading={t('onDeviceAi.onboarding.options.heading')}
      intro={t('onDeviceAi.onboarding.options.intro')}
      choicesLabel={t('onDeviceAi.onboarding.options.choicesLabel')}
      quickStep={quickStepNum}
      quickTotal={quickTotalNum}
      footer={
        <Button
          testID="on-device-ai-options-continue"
          label={t(CTA_KEYS[selected])}
          onPress={() => void handleContinue()}
          variant={selected === 'later' ? 'outline' : 'accent'}
          size="lg"
          width="full"
          disabled={isSaving || blockedBySpace}
          loading={isSaving}
        />
      }
    >
      {offersApple ? (
        <View className="gap-2">
          <AiChoiceCard
            testID="on-device-ai-apple"
            title={t('onDeviceAi.onboarding.options.apple.title')}
            selected={selected === 'apple'}
            onPress={() => setChoice('apple')}
            disabled={isSaving}
            points={[
              {
                kind: 'plus',
                text: t('onDeviceAi.onboarding.options.apple.points.builtIn'),
              },
              {
                kind: 'plus',
                text: t('onDeviceAi.onboarding.options.apple.points.private'),
              },
            ]}
          />
          {selected === 'apple' ? (
            <AppleIntelligenceStatus appleState={status.appleState} tone="body" />
          ) : null}
        </View>
      ) : null}

      {offersModel ? (
        <View className="gap-2">
          <AiChoiceCard
            testID="on-device-ai-model"
            title={t('onDeviceAi.onboarding.options.model.title')}
            selected={selected === 'model'}
            onPress={() => setChoice('model')}
            disabled={isSaving}
            points={[
              {
                kind: 'plus',
                text: t('onDeviceAi.onboarding.options.model.points.download'),
              },
              {
                kind: 'plus',
                text: t('onDeviceAi.onboarding.options.model.points.photos'),
              },
            ]}
          />
          {selected === 'model' ? (
            <>
              <LocalModelCard
                selection={selection}
                onSelectionChange={setSelection}
                hideDownloadButton
              />
              <Text style={downloadNoteStyle}>
                {t('onDeviceAi.onboarding.options.downloadNote')}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}

      <AiChoiceCard
        testID="on-device-ai-later"
        title={t('onDeviceAi.onboarding.options.later.title')}
        selected={selected === 'later'}
        onPress={() => setChoice('later')}
        disabled={isSaving}
        points={[{ kind: 'plus', text: t('onDeviceAi.onboarding.options.later.points.later') }]}
      />
    </OnboardingChoiceScaffold>
  );
}
