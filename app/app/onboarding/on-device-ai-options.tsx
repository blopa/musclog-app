import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { LocalModelCard } from '@/components/localModels/LocalModelCard';
import { MasterLayout } from '@/components/MasterLayout';
import { scrollCueBottom } from '@/components/modals/footerClearance';
import { AiChoiceCard } from '@/components/onboarding/AiChoiceCard';
import { QuickSetupProgressBar } from '@/components/QuickSetupProgressBar';
import { Button } from '@/components/theme/Button';
import { DEFAULT_LOCAL_MODEL } from '@/constants/localModels';
import { useOnDeviceStatus } from '@/hooks/useOnDeviceStatus';
import { useScrollFade } from '@/hooks/useScrollFade';
import { useTheme } from '@/hooks/useTheme';
import { getFreeDiskBytes } from '@/services/localModels/modelStore';
import { enableOnDeviceAi } from '@/services/onDeviceAiSetup';
import {
  checkSpace,
  DEFAULT_LOCAL_MODEL_SELECTION,
  type LocalModelSelection,
} from '@/utils/localModels/install';
import { routeAfterLocalAi } from '@/utils/onboardingRoutes';
import { isAppleLocaleSupported } from '@/utils/onDeviceAi';

type Option = 'apple' | 'model' | 'later';

const CTA_KEYS: Record<Option, string> = {
  apple: 'onDeviceAi.onboarding.options.cta.apple',
  model: 'onDeviceAi.onboarding.options.cta.model',
  later: 'onDeviceAi.onboarding.options.cta.later',
};

/** One whole key per Apple state worth saying, so the translation check sees each sentence. */
const APPLE_STATUS_KEYS = {
  ready: 'onDeviceAi.apple.status.ready',
  appleOff: 'onDeviceAi.apple.status.appleOff',
  appleNotReady: 'onDeviceAi.apple.status.appleNotReady',
} as const;

/**
 * The second local-AI question: which one. Apple Intelligence (iOS, nothing to download), the
 * downloaded model (a one-off download that keeps going in the background), or decide later.
 */
export default function OnDeviceAiOptionsScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const status = useOnDeviceStatus({ refresh: true });
  const { scrollProps, FadeIndicator } = useScrollFade();
  const [footerHeight, setFooterHeight] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [selection, setSelection] = useState<LocalModelSelection>(DEFAULT_LOCAL_MODEL_SELECTION);
  const [freeBytes, setFreeBytes] = useState<number | null>(null);
  const [appleLanguageOk, setAppleLanguageOk] = useState(true);
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
  const selected: Option = choice ?? (offersApple ? 'apple' : offersModel ? 'model' : 'later');

  useEffect(() => {
    let cancelled = false;
    void getFreeDiskBytes().then((bytes) => {
      if (!cancelled) {
        setFreeBytes(bytes);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (offersApple) {
      void isAppleLocaleSupported(i18n.language).then((ok) => {
        if (!cancelled) {
          setAppleLanguageOk(ok);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [offersApple, i18n.language]);

  const space = checkSpace(freeBytes, DEFAULT_LOCAL_MODEL, selection);
  const blockedBySpace = selected === 'model' && freeBytes !== null && !space.enough;

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      if (selected === 'apple') {
        await enableOnDeviceAi('apple');
      } else if (selected === 'model') {
        await enableOnDeviceAi('gguf', { download: selection });
      }

      router.navigate(
        (selected === 'later' ? resolvedNextRoute : routeAfterLocalAi(resolvedNextRoute)) as never
      );
    } catch (e) {
      console.error('Error saving on-device AI choice:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const appleStatusKey =
    status.options.apple && status.engine === 'apple' && status.state in APPLE_STATUS_KEYS
      ? APPLE_STATUS_KEYS[status.state as keyof typeof APPLE_STATUS_KEYS]
      : null;
  const textStyle = {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.sm,
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
                {t('onDeviceAi.onboarding.options.heading')}
              </Text>
              <Text style={{ ...textStyle, fontSize: theme.typography.fontSize.base }}>
                {t('onDeviceAi.onboarding.options.intro')}
              </Text>
            </View>

            <View
              className="gap-3"
              accessibilityRole="radiogroup"
              accessibilityLabel={t('onDeviceAi.onboarding.options.choicesLabel')}
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
                  {selected === 'apple' && appleStatusKey ? (
                    <Text style={textStyle}>{t(appleStatusKey)}</Text>
                  ) : null}
                  {selected === 'apple' && !appleLanguageOk ? (
                    <Text style={textStyle}>{t('onDeviceAi.apple.languageNote')}</Text>
                  ) : null}
                  {selected === 'apple' && status.state === 'appleOff' ? (
                    <Button
                      label={t('onDeviceAi.apple.openSettings')}
                      variant="outline"
                      width="full"
                      onPress={() => void Linking.openSettings()}
                    />
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
                      <Text style={textStyle}>
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
                points={[
                  { kind: 'plus', text: t('onDeviceAi.onboarding.options.later.points.later') },
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
            testID="on-device-ai-options-continue"
            label={t(CTA_KEYS[selected])}
            onPress={() => void handleContinue()}
            variant={selected === 'later' ? 'outline' : 'accent'}
            size="lg"
            width="full"
            disabled={isSaving || blockedBySpace}
            loading={isSaving}
          />
        </BottomButtonWrapper>
      </SafeAreaView>
    </MasterLayout>
  );
}
