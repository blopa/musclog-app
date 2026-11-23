import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { MasterLayout } from '@/components/MasterLayout';
import { ConnectedAISettingsModal } from '@/components/modals/ConnectedAISettingsModal';
import { scrollCueBottom } from '@/components/modals/footerClearance';
import { PremiumModal } from '@/components/modals/PremiumModal';
import { AiChoiceCard } from '@/components/onboarding/AiChoiceCard';
import { AiChoiceFixtureContext } from '@/components/onboarding/aiChoiceFixture';
import { QuickSetupProgressBar } from '@/components/QuickSetupProgressBar';
import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import { SettingsService } from '@/database/services/SettingsService';
import { usePremium } from '@/hooks/usePremium';
import { useScrollFade } from '@/hooks/useScrollFade';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { isMusclogGatewayAvailable } from '@/utils/musclogGatewayAvailability';
import { type AiChoice, availableAiChoices, defaultAiChoice } from '@/utils/onboardingAiChoice';
import { websitePageUrl } from '@/utils/websiteUrl';

type ChoicePoint = { kind: 'plus' | 'minus'; text: string };

type ChoiceCard = {
  testID: string;
  title: string;
  price: string | undefined;
  points: ChoicePoint[];
};

/** One whole key per choice, so the translation check sees every label the button can show. */
const CTA_KEYS: Record<AiChoice, string> = {
  premium: 'onboarding.musclogApi.cta.premium',
  free: 'onboarding.musclogApi.cta.free',
  none: 'onboarding.musclogApi.cta.none',
};

export default function MusclogApiScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const premium = usePremium({ load: true });
  const fixture = useContext(AiChoiceFixtureContext);
  // On a small screen the last card can sit below the fold: the cue says there is more.
  const { scrollProps, FadeIndicator } = useScrollFade();
  const [footerHeight, setFooterHeight] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  // The person asked for Premium. The screen stays open until the hosted switch is on, which
  // happens only after a purchase or restore and the Premium consent inside the Premium screen.
  const [premiumRequested, setPremiumRequested] = useState(false);
  const premiumVisible = premiumRequested && !premium.useHostedAi;
  const handedOn = useRef(false);
  // The quiet way out for people with their own key or a local server.
  const { isAiConfigured } = useSettings();
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [aiSettingsOpened, setAiSettingsOpened] = useState(false);

  const choices = availableAiChoices({
    premiumEnabled: premium.enabled,
    freeTierAvailable: fixture?.freeTierAvailable ?? isMusclogGatewayAvailable(),
  });
  const [selected, setSelected] = useState<AiChoice>(() => defaultAiChoice(choices));

  const { nextRoute, quickStep, quickTotal } = useLocalSearchParams<{
    nextRoute?: string;
    quickStep?: string;
    quickTotal?: string;
  }>();

  const resolvedNextRoute = nextRoute ? decodeURIComponent(nextRoute) : '/app';
  const quickStepNum = quickStep ? Number(quickStep) : null;
  const quickTotalNum = quickTotal ? Number(quickTotal) : 6;

  /** Saves the free-tier answer (on only when it was the choice) and moves on. */
  const finish = useCallback(
    async (enableFreeTier: boolean) => {
      setIsSaving(true);
      try {
        await SettingsService.setUseMusclogFreeTier(enableFreeTier);
        router.navigate(resolvedNextRoute as never);
      } catch (e) {
        console.error('Error saving musclog API preference:', e);
      } finally {
        setIsSaving(false);
      }
    },
    [resolvedNextRoute, router]
  );

  // Once Premium is on, the setup carries on by itself (once: a later focus must not navigate again).
  useEffect(() => {
    if (premiumRequested && premium.useHostedAi && !handedOn.current) {
      handedOn.current = true;
      finish(false);
    }
  }, [premiumRequested, premium.useHostedAi, finish]);

  // Closing the AI settings with a provider set up carries on, like finishing the step.
  useEffect(() => {
    if (aiSettingsOpened && !aiSettingsOpen && isAiConfigured && !handedOn.current) {
      handedOn.current = true;
      finish(false);
    }
  }, [aiSettingsOpened, aiSettingsOpen, isAiConfigured, finish]);

  const handleContinue = () => {
    switch (selected) {
      case 'premium':
        if (premium.useHostedAi) {
          finish(false);
        } else {
          setPremiumRequested(true);
        }

        return;
      case 'free':
        finish(true);

        return;
      default:
        finish(false);
    }
  };

  const premiumPrice = premium.priceString
    ? t('onboarding.musclogApi.options.premium.price', { price: premium.priceString })
    : t('onboarding.musclogApi.options.premium.priceUnknown');

  /** Every card's copy, one whole key per string so the translation check sees each one. */
  const choiceCards: Record<AiChoice, ChoiceCard> = {
    premium: {
      testID: 'ai-choice-premium',
      title: t('onboarding.musclogApi.options.premium.title'),
      price: premiumPrice,
      points: [
        { kind: 'plus', text: t('onboarding.musclogApi.options.premium.points.private') },
        { kind: 'plus', text: t('onboarding.musclogApi.options.premium.points.allowance') },
        { kind: 'plus', text: t('onboarding.musclogApi.options.premium.points.noSetup') },
      ],
    },
    free: {
      testID: 'ai-choice-free',
      title: t('onboarding.musclogApi.options.free.title'),
      price: t('onboarding.musclogApi.options.free.price'),
      points: [
        { kind: 'plus', text: t('onboarding.musclogApi.options.free.points.noSetup') },
        { kind: 'minus', text: t('onboarding.musclogApi.options.free.points.limit') },
        { kind: 'minus', text: t('onboarding.musclogApi.options.free.points.privacy') },
      ],
    },
    none: {
      testID: 'ai-choice-none',
      title: t('onboarding.musclogApi.options.none.title'),
      price: undefined,
      points: [
        { kind: 'plus', text: t('onboarding.musclogApi.options.none.points.works') },
        { kind: 'plus', text: t('onboarding.musclogApi.options.none.points.later') },
      ],
    },
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
                {t('onboarding.musclogApi.heading')}
              </Text>
              <Text
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.typography.fontSize.base,
                  lineHeight: theme.typography.fontSize.base * 1.45,
                }}
              >
                {t('onboarding.musclogApi.intro')}
              </Text>
            </View>

            <View
              className="gap-3"
              accessibilityRole="radiogroup"
              accessibilityLabel={t('onboarding.musclogApi.choicesLabel')}
            >
              {choices.map((choice) => {
                const card = choiceCards[choice];

                return (
                  <AiChoiceCard
                    key={choice}
                    testID={card.testID}
                    title={card.title}
                    price={card.price}
                    selected={selected === choice}
                    onPress={() => setSelected(choice)}
                    disabled={isSaving}
                    points={card.points}
                  />
                );
              })}
            </View>

            {/* The free tier's consent (App Store 5.1.2(i)): shown above the button that turns it on. */}
            {selected === 'free' ? (
              <View
                className="rounded-card p-4"
                style={{
                  backgroundColor: theme.colors.status.amber10,
                  borderWidth: 1,
                  borderColor: theme.colors.status.amber20,
                }}
              >
                <View className="mb-2 flex-row items-center gap-2">
                  <AlertTriangle size={16} color={theme.colors.status.amber} />
                  <Text
                    className="font-semibold"
                    style={{
                      color: theme.colors.status.amber,
                      fontSize: theme.typography.fontSize.sm,
                    }}
                  >
                    {t('onboarding.musclogApi.dataSharingTitle')}
                  </Text>
                </View>
                <Text
                  style={{
                    color: theme.colors.text.secondary,
                    fontSize: theme.typography.fontSize.xs,
                    lineHeight: 18,
                  }}
                >
                  {t('onboarding.musclogApi.dataSharingBody')}
                </Text>
                <Text
                  accessibilityRole="link"
                  className="mt-2 font-semibold"
                  style={{
                    color: theme.colors.status.amber,
                    fontSize: theme.typography.fontSize.xs,
                  }}
                  onPress={() => Linking.openURL(websitePageUrl('/privacy', i18n.language))}
                >
                  {t('onboarding.musclogApi.readPrivacyPolicy')}
                </Text>
              </View>
            ) : null}
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
            testID="ai-choice-continue"
            label={t(CTA_KEYS[selected])}
            onPress={handleContinue}
            variant={selected === 'none' ? 'outline' : 'accent'}
            size="lg"
            width="full"
            disabled={isSaving}
            loading={isSaving}
          />
          <TextButton
            testID="ai-choice-own-key"
            label={t('onDeviceAi.useOwnKey')}
            onPress={() => {
              setAiSettingsOpened(true);
              setAiSettingsOpen(true);
            }}
          />
        </BottomButtonWrapper>

        <ConnectedAISettingsModal
          visible={aiSettingsOpen}
          onClose={() => setAiSettingsOpen(false)}
        />
        <PremiumModal visible={premiumVisible} onClose={() => setPremiumRequested(false)} />
      </SafeAreaView>
    </MasterLayout>
  );
}
