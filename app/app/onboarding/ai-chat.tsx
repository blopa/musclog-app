import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { AiErrorRecovery } from '@/components/aiOnboarding/AiErrorRecovery';
import { ChatComposer } from '@/components/aiOnboarding/ChatComposer';
import { ChatTranscript } from '@/components/aiOnboarding/ChatTranscript';
import { PROVIDER_NAME_KEYS } from '@/components/aiOnboarding/providerNames';
import { QuickReplyChips } from '@/components/aiOnboarding/QuickReplyChips';
import type { RecoveryAction } from '@/components/aiOnboarding/recoveryActions';
import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import { ScreenHeader } from '@/components/theme/ScreenHeader';
import { useAiGuidedExit } from '@/hooks/useAiGuidedExit';
import { useAiOnboardingChat } from '@/hooks/useAiOnboardingChat';
import { type AiOnboardingDraftApi, useAiOnboardingDraft } from '@/hooks/useAiOnboardingDraft';
import { useTheme } from '@/hooks/useTheme';
import type { AiOnboardingMode } from '@/utils/aiOnboarding/draftStorage';
import { aiSetupRoute, resolveAiSetupMode } from '@/utils/onboardingRoutes';

/**
 * The setup conversation. It lives in its own saved session and never in the coach's chat history.
 */
export default function AiChatScreen() {
  const theme = useTheme();
  const mode = resolveAiSetupMode(useLocalSearchParams<{ mode?: string }>().mode);
  const draftApi = useAiOnboardingDraft(mode);

  if (draftApi.loading || !draftApi.draft) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.colors.accent.primary} />
        </View>
      </MasterLayout>
    );
  }

  return <ChatBody mode={mode} draftApi={draftApi} />;
}

function ChatBody({ mode, draftApi }: { mode: AiOnboardingMode; draftApi: AiOnboardingDraftApi }) {
  const { t } = useTranslation();
  const router = useRouter();
  const draft = draftApi.draft!;
  const chat = useAiOnboardingChat({ draft, update: draftApi.update });
  const goGuided = useAiGuidedExit(mode, draftApi);

  const sending = chat.status === 'sending';
  const failed =
    chat.status === 'error' && chat.errorKind !== null && chat.errorKind !== 'cancelled';
  const hasAnswers = Object.keys(draft.answers).length > 0;

  const review = async () => {
    await draftApi.update({ path: 'chat' });
    router.navigate(aiSetupRoute('review', mode) as never);
  };

  const recover = (action: RecoveryAction) => {
    switch (action) {
      case 'retry':
        void chat.retry();
        break;
      case 'replaceKey':
        router.navigate(
          `${aiSetupRoute('provider', mode)}${
            draft.provider === 'gemini' || draft.provider === 'openai'
              ? `&entry=${draft.provider}`
              : ''
          }` as never
        );
        break;
      case 'switchProvider':
      case 'ownKey':
        router.navigate(aiSetupRoute('provider', mode) as never);
        break;
      case 'useExternal':
        router.navigate(aiSetupRoute('external', mode) as never);
        break;
      case 'continueGuided':
        void goGuided();
        break;
    }
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <ScreenHeader
        title={t('aiOnboarding.chat.title')}
        subtitle={draft.provider ? t(PROVIDER_NAME_KEYS[draft.provider]) : undefined}
      />
      <ChatTranscript messages={chat.messages} sending={sending} />
      {failed && chat.errorKind ? (
        <AiErrorRecovery
          kind={chat.errorKind}
          profileMode={mode === 'profile'}
          onAction={recover}
        />
      ) : null}
      {!failed && !sending ? (
        <QuickReplyChips field={chat.askedFields[0]} onPick={(text) => void chat.send(text)} />
      ) : null}
      {hasAnswers ? (
        <View className="px-4 pb-2">
          <Button
            label={t('aiOnboarding.chat.review')}
            variant={chat.readyForReview ? 'accent' : 'outline'}
            size="sm"
            width="full"
            onPress={review}
          />
        </View>
      ) : null}
      <ChatComposer
        value={draft.composer}
        onChangeText={draftApi.setComposer}
        onSend={() => void chat.send(draft.composer)}
        onCancel={chat.cancel}
        sending={sending}
      />
    </MasterLayout>
  );
}
