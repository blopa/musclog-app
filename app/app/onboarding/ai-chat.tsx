import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AiErrorRecovery } from '@/components/aiOnboarding/AiErrorRecovery';
import { AiSetupLoading } from '@/components/aiOnboarding/AiSetupLoading';
import { ChatComposer } from '@/components/aiOnboarding/ChatComposer';
import { ChatTranscript } from '@/components/aiOnboarding/ChatTranscript';
import { PROVIDER_NAME_KEYS } from '@/components/aiOnboarding/providerNames';
import { QuickReplyChips } from '@/components/aiOnboarding/QuickReplyChips';
import type { RecoveryAction } from '@/components/aiOnboarding/recoveryActions';
import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import { ScreenHeader } from '@/components/theme/ScreenHeader';
import { useAiOnboardingChat } from '@/hooks/useAiOnboardingChat';
import { isDraftLoaded, type LoadedAiDraftApi } from '@/hooks/useAiOnboardingDraft';
import { type AiSetupSession, useAiSetupSession } from '@/hooks/useAiSetupSession';

/**
 * The setup conversation. It lives in its own saved session and never in the coach's chat history.
 */
export default function AiChatScreen() {
  const session = useAiSetupSession();
  const { draftApi } = session;

  return isDraftLoaded(draftApi) ? (
    <ChatBody session={session} draftApi={draftApi} />
  ) : (
    <AiSetupLoading />
  );
}

function ChatBody({ session, draftApi }: { session: AiSetupSession; draftApi: LoadedAiDraftApi }) {
  const { t } = useTranslation();
  const { mode, go, goGuided } = session;
  const { draft } = draftApi;
  const chat = useAiOnboardingChat({ draft, update: draftApi.update });

  const sending = chat.status === 'sending';
  const failed =
    chat.status === 'error' && chat.errorKind !== null && chat.errorKind !== 'cancelled';
  const hasAnswers = Object.keys(draft.answers).length > 0;

  const review = async () => {
    await draftApi.update({ path: 'chat' });
    go('review');
  };

  const recover = (action: RecoveryAction) => {
    switch (action) {
      case 'retry':
        void chat.retry();
        break;
      case 'replaceKey':
        go(
          'provider',
          draft.provider === 'gemini' || draft.provider === 'openai'
            ? { entry: draft.provider }
            : {}
        );
        break;
      case 'switchProvider':
      case 'ownKey':
        go('provider');
        break;
      case 'useExternal':
        go('external');
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
