import { SendHorizontal, Square } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';

import { IconButton } from '@/components/theme/IconButton';
import { TextInput } from '@/components/theme/TextInput';
import { useTheme } from '@/hooks/useTheme';

type ChatComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  /** Stops the turn in flight and puts its text back in the box. */
  onCancel: () => void;
  sending: boolean;
};

/** Longest message the composer accepts; the same cap the request applies. */
const MAX_MESSAGE_CHARS = 2000;

/**
 * The message box, stuck above the keyboard. It sits outside the transcript's scroll view, so the
 * keyboard-controller sticky view (not React Native's KeyboardAvoidingView) keeps it visible.
 */
export function ChatComposer({
  value,
  onChangeText,
  onSend,
  onCancel,
  sending,
}: ChatComposerProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <KeyboardStickyView>
      <View
        className="flex-row items-end gap-2 px-4 pb-3 pt-3"
        style={{
          backgroundColor: theme.colors.background.primary,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.light,
        }}
      >
        <View className="flex-1">
          <TextInput
            label=""
            value={value}
            onChangeText={onChangeText}
            placeholder={t('aiOnboarding.chat.placeholder')}
            multiline
            numberOfLines={3}
            maxLength={MAX_MESSAGE_CHARS}
            editable={!sending}
          />
        </View>
        {sending ? (
          <IconButton
            icon={Square}
            accessibilityLabel={t('aiOnboarding.chat.stop')}
            onPress={onCancel}
          />
        ) : (
          <IconButton
            icon={SendHorizontal}
            accessibilityLabel={t('aiOnboarding.chat.send')}
            onPress={onSend}
            disabled={!value.trim()}
          />
        )}
      </View>
    </KeyboardStickyView>
  );
}
