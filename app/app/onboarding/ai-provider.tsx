import { useLocalSearchParams, useRouter } from 'expo-router';
import { Cloud, KeyRound, Server, Smartphone } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { PROVIDER_NAME_KEYS } from '@/components/aiOnboarding/providerNames';
import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import { ListGroup } from '@/components/theme/ListGroup';
import { ListRow } from '@/components/theme/ListRow';
import { ScreenHeader } from '@/components/theme/ScreenHeader';
import { SecretInput } from '@/components/theme/SecretInput';
import { TextButton } from '@/components/theme/TextButton';
import { DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL } from '@/constants/ai';
import { useAiOnboardingDraft } from '@/hooks/useAiOnboardingDraft';
import { useTheme } from '@/hooks/useTheme';
import { enableFreeTier, testAndSaveApiKey } from '@/services/aiProviderSetup';
import { AiService } from '@/services/AiService';
import type { AiKeyTestResult } from '@/utils/aiKeyTest';
import type { CoachAIProvider } from '@/utils/coachAI';
import { handleError } from '@/utils/handleError';
import { isMusclogGatewayAvailable } from '@/utils/musclogGatewayAvailability';
import { aiSetupRoute, resolveAiSetupMode } from '@/utils/onboardingRoutes';

type KeyProvider = 'gemini' | 'openai';

/** Where a person gets a key, kept to the one page per provider rather than a tutorial. */
const KEY_PAGES: Record<KeyProvider, string> = {
  gemini: 'https://aistudio.google.com/apikey',
  openai: 'https://platform.openai.com/api-keys',
};
const DEFAULT_MODELS: Record<KeyProvider, string> = {
  gemini: DEFAULT_GEMINI_MODEL,
  openai: DEFAULT_OPENAI_MODEL,
};
const KEY_STEP_KEYS: Record<KeyProvider, readonly string[]> = {
  gemini: [
    'aiOnboarding.provider.steps.gemini.one',
    'aiOnboarding.provider.steps.gemini.two',
    'aiOnboarding.provider.steps.gemini.three',
  ],
  openai: [
    'aiOnboarding.provider.steps.openai.one',
    'aiOnboarding.provider.steps.openai.two',
    'aiOnboarding.provider.steps.openai.three',
  ],
};
const KEY_PAGE_LABEL_KEYS: Record<KeyProvider, string> = {
  gemini: 'aiOnboarding.provider.openGemini',
  openai: 'aiOnboarding.provider.openOpenAi',
};

/**
 * Picks the AI that runs the setup chat: free Musclog AI, the person's own Gemini or OpenAI key,
 * or a provider already set up. A key is saved (through the app's normal encrypted settings) only
 * after the provider accepts it, and stays saved if they leave: it belongs to the app, not to this
 * flow, and Settings → AI removes it.
 */
export default function AiProviderScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; entry?: string }>();
  const mode = resolveAiSetupMode(params.mode);
  const draftApi = useAiOnboardingDraft(mode);

  const [ready, setReady] = useState<Partial<Record<CoachAIProvider, boolean>>>({});
  const [entry, setEntry] = useState<KeyProvider | null>(
    params.entry === 'gemini' || params.entry === 'openai' ? params.entry : null
  );
  const [keyText, setKeyText] = useState('');
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<Exclude<AiKeyTestResult, 'ok'> | null>(null);
  const [problem, setProblem] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const providers: CoachAIProvider[] = ['gemini', 'openai', 'on-device', 'local'];
    Promise.all(providers.map((provider) => AiService.getAiConfigForProvider(provider))).then(
      (configs) => {
        if (!cancelled) {
          setReady(Object.fromEntries(providers.map((p, i) => [p, configs[i] !== null])));
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const choose = useCallback(
    async (provider: CoachAIProvider) => {
      // A provider chosen here keeps working afterwards: the later "Musclog AI" step is skipped so
      // the free tier (which outranks a key) cannot quietly replace it.
      await draftApi.update({ provider, skipMusclogApi: true, path: 'chat' });
      router.navigate(aiSetupRoute('chat', mode) as never);
    },
    [draftApi, mode, router]
  );

  const attempt = useCallback(async (work: () => Promise<void>) => {
    setProblem(false);
    try {
      await work();
    } catch (error) {
      handleError(error, 'AiProviderScreen');
      setProblem(true);
    }
  }, []);

  const checkKey = () =>
    attempt(async () => {
      if (!entry) {
        return;
      }

      setChecking(true);
      setFailure(null);
      try {
        const result = await testAndSaveApiKey(entry, keyText);
        if (result === 'ok') {
          setKeyText('');
          await choose(entry);
        } else {
          setFailure(result);
        }
      } finally {
        setChecking(false);
      }
    });

  const openKeyPage = (provider: KeyProvider) => {
    Linking.openURL(KEY_PAGES[provider]).catch(() => {});
  };

  const providerReady = (provider: CoachAIProvider) => ready[provider] === true;

  return (
    <MasterLayout showNavigationMenu={false}>
      <ScreenHeader title={t('aiOnboarding.provider.title')} />
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
        <View className="gap-6 px-4 pt-4">
          <Text
            style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.base }}
          >
            {t('aiOnboarding.provider.intro')}
          </Text>

          <ListGroup>
            {isMusclogGatewayAvailable() ? (
              <ListRow
                variant="grouped"
                icon={Cloud}
                title={t(PROVIDER_NAME_KEYS.gateway)}
                subtitle={t('aiOnboarding.provider.gatewayHint')}
                onPress={() =>
                  attempt(async () => {
                    await enableFreeTier();
                    await choose('gateway');
                  })
                }
              />
            ) : null}
            {(['gemini', 'openai'] as const).map((provider) => (
              <ListRow
                key={provider}
                variant="grouped"
                icon={KeyRound}
                title={t(PROVIDER_NAME_KEYS[provider])}
                subtitle={t(
                  providerReady(provider)
                    ? 'aiOnboarding.provider.keySaved'
                    : 'aiOnboarding.provider.ownKey'
                )}
                selected={entry === provider}
                onPress={() => {
                  setFailure(null);
                  setEntry(provider);
                }}
              />
            ))}
            {providerReady('on-device') ? (
              <ListRow
                variant="grouped"
                icon={Smartphone}
                title={t(PROVIDER_NAME_KEYS['on-device'])}
                subtitle={t('aiOnboarding.provider.simpleHint')}
                onPress={() => attempt(() => choose('on-device'))}
              />
            ) : null}
            {providerReady('local') ? (
              <ListRow
                variant="grouped"
                icon={Server}
                title={t(PROVIDER_NAME_KEYS.local)}
                subtitle={t('aiOnboarding.provider.simpleHint')}
                onPress={() => attempt(() => choose('local'))}
              />
            ) : null}
          </ListGroup>

          {entry ? (
            <View className="gap-4">
              <Text
                className="font-semibold"
                style={{ color: theme.colors.text.primary, fontSize: theme.typography.fontSize.lg }}
              >
                {t('aiOnboarding.provider.keyTitle', { provider: t(PROVIDER_NAME_KEYS[entry]) })}
              </Text>

              {providerReady(entry) ? (
                <Button
                  label={t('aiOnboarding.provider.useSaved')}
                  variant="accent"
                  width="full"
                  onPress={() => attempt(() => choose(entry))}
                />
              ) : null}

              <View className="gap-1">
                {KEY_STEP_KEYS[entry].map((stepKey, index) => (
                  <Text
                    key={stepKey}
                    style={{
                      color: theme.colors.text.secondary,
                      fontSize: theme.typography.fontSize.sm,
                    }}
                  >
                    {`${index + 1}. ${t(stepKey)}`}
                  </Text>
                ))}
              </View>
              <TextButton
                label={t(KEY_PAGE_LABEL_KEYS[entry])}
                onPress={() => openKeyPage(entry)}
              />

              <SecretInput
                label={t('aiOnboarding.provider.keyLabel')}
                value={keyText}
                onChangeText={(value) => {
                  setKeyText(value);
                  setFailure(null);
                }}
                placeholder={t('aiOnboarding.provider.keyPlaceholder')}
              />
              {failure ? (
                <Text
                  style={{
                    color: theme.colors.status.error,
                    fontSize: theme.typography.fontSize.sm,
                  }}
                >
                  {t(
                    failure === 'rejected'
                      ? 'aiOnboarding.provider.keyRejected'
                      : 'aiOnboarding.provider.keyNetwork',
                    { provider: t(PROVIDER_NAME_KEYS[entry]) }
                  )}
                </Text>
              ) : null}
              <Button
                label={t('aiOnboarding.provider.checkKey')}
                variant="accent"
                width="full"
                loading={checking}
                disabled={checking || !keyText.trim()}
                onPress={checkKey}
              />
              <Text
                style={{
                  color: theme.colors.text.tertiary,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                {t('aiOnboarding.provider.keyStorage', { model: DEFAULT_MODELS[entry] })}
              </Text>
            </View>
          ) : null}

          {problem ? (
            <Text
              style={{ color: theme.colors.status.error, fontSize: theme.typography.fontSize.sm }}
            >
              {t('aiOnboarding.provider.problem')}
            </Text>
          ) : null}

          <TextButton
            label={t('aiOnboarding.provider.useExternal')}
            tone="muted"
            align="center"
            onPress={() => router.navigate(aiSetupRoute('external', mode) as never)}
          />
        </View>
      </KeyboardAwareScrollView>
    </MasterLayout>
  );
}
