import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, type ScrollViewInstance, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { ChatMessage } from '@/utils/aiOnboarding/chatState';

type ChatTranscriptProps = {
  messages: ChatMessage[];
  /** A turn is waiting for the assistant's reply. */
  sending: boolean;
};

/**
 * The conversation as plain text bubbles. The assistant's words come from a model, so they are
 * never parsed as markdown or links: whatever it writes is shown as text and nothing more.
 */
export function ChatTranscript({ messages, sending }: ChatTranscriptProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollViewInstance>(null);

  return (
    <ScrollView
      ref={scrollRef}
      className="flex-1"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
    >
      <Bubble role="assistant" text={t('aiOnboarding.chat.greeting')} />
      {messages.map((message) => (
        <Bubble
          key={message.id}
          role={message.role}
          text={message.text}
          notSent={message.status === 'unanswered'}
        />
      ))}
      {sending ? (
        <View className="flex-row items-center gap-2 px-1">
          <ActivityIndicator size="small" color={theme.colors.text.secondary} />
          <Text style={{ color: theme.colors.text.secondary }}>
            {t('aiOnboarding.chat.thinking')}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Bubble({
  role,
  text,
  notSent = false,
}: {
  role: ChatMessage['role'];
  text: string;
  notSent?: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isUser = role === 'user';

  return (
    <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <View
        className="rounded-card px-4 py-3"
        style={{
          maxWidth: '88%',
          backgroundColor: isUser
            ? theme.colors.accent.primary
            : theme.colors.background.cardElevated,
        }}
      >
        <Text
          selectable
          style={{
            color: isUser ? theme.colors.text.onAccent : theme.colors.text.primary,
            fontSize: theme.typography.fontSize.base,
          }}
        >
          {text}
        </Text>
      </View>
      {notSent ? (
        <Text
          className="mt-1"
          style={{ color: theme.colors.status.error, fontSize: theme.typography.fontSize.xs }}
        >
          {t('aiOnboarding.chat.notSent')}
        </Text>
      ) : null}
    </View>
  );
}
