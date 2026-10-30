import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { Button } from '@/components/theme/Button';
import { TextInput } from '@/components/theme/TextInput';
import { useTheme } from '@/hooks/useTheme';

type PasteJsonSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Receives the pasted text; the caller validates it and reports a problem through `error`. */
  onSubmit: (text: string) => void;
  error?: string | null;
};

/**
 * Where a setup written by ChatGPT or Claude can be pasted when saving a file was not possible.
 * The text is never sent anywhere from here: it is handed to the caller, which validates it.
 */
export function PasteJsonSheet({ visible, onClose, onSubmit, error }: PasteJsonSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [text, setText] = useState('');

  return (
    <BottomPopUp
      visible={visible}
      onClose={onClose}
      title={t('aiOnboarding.external.paste.title')}
      subtitle={t('aiOnboarding.external.paste.subtitle')}
      footer={
        <View className="gap-3">
          <Button
            label={t('aiOnboarding.external.paste.import')}
            variant="accent"
            width="full"
            disabled={!text.trim()}
            onPress={() => onSubmit(text)}
          />
          <Button
            label={t('aiOnboarding.external.paste.fromClipboard')}
            variant="outline"
            width="full"
            onPress={async () => setText(await Clipboard.getStringAsync())}
          />
        </View>
      }
    >
      <View className="gap-3">
        <TextInput
          label=""
          value={text}
          onChangeText={setText}
          placeholder={t('aiOnboarding.external.paste.placeholder')}
          multiline
          numberOfLines={8}
          autoCapitalize="none"
        />
        {error ? (
          <Text
            style={{ color: theme.colors.status.error, fontSize: theme.typography.fontSize.sm }}
          >
            {error}
          </Text>
        ) : null}
      </View>
    </BottomPopUp>
  );
}
