import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AiCustomPrompt } from '../../database/models';
import { useAiCustomPrompts } from '../../hooks/useAiCustomPrompts';
import { useTheme } from '../../hooks/useTheme';
import { BottomPopUp } from '../BottomPopUp';
import { Button } from '../theme/Button';
import { TextInput } from '../theme/TextInput';
import { ToggleInput } from '../theme/ToggleInput';

type AiCustomPromptEditModalProps = {
  visible: boolean;
  onClose: () => void;
  prompt?: AiCustomPrompt;
};

export function AiCustomPromptEditModal({ visible, onClose, prompt }: AiCustomPromptEditModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { createPrompt, updatePrompt } = useAiCustomPrompts();

  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (prompt) {
      setName(prompt.name);
      setContent(prompt.content);
      setIsActive(prompt.isActive);
    } else {
      setName('');
      setContent('');
      setIsActive(true);
    }
  }, [prompt, visible]);

  const handleSave = async () => {
    if (prompt) {
      await updatePrompt(prompt.id, { name, content, isActive });
    } else {
      await createPrompt(name, content, isActive);
    }
    onClose();
  };

  const isSaveDisabled = !name.trim() || !content.trim();

  return (
    <BottomPopUp
      visible={visible}
      onClose={onClose}
      title={prompt ? t('settings.aiSettings.editPrompt') : t('settings.aiSettings.addPrompt')}
    >
      <View className="gap-6 p-6">
        <TextInput
          label={t('settings.aiSettings.promptName')}
          value={name}
          onChangeText={setName}
          placeholder={t('settings.aiSettings.promptNamePlaceholder')}
          required
        />

        <TextInput
          label={t('settings.aiSettings.promptContent')}
          value={content}
          onChangeText={setContent}
          placeholder={t('settings.aiSettings.promptContentPlaceholder')}
          multiline
          numberOfLines={6}
          required
        />

        <ToggleInput
          items={[
            {
              key: 'is-active',
              label: t('settings.aiSettings.promptIsActive'),
              value: isActive,
              onValueChange: setIsActive,
            },
          ]}
        />

        <View className="mb-4 mt-2 flex-row gap-4">
          <Button
            label={t('common.cancel')}
            onPress={onClose}
            variant="outline"
            width="flex-1"
          />
          <Button
            label={t('save')}
            onPress={handleSave}
            disabled={isSaveDisabled}
            variant="accent"
            width="flex-1"
          />
        </View>
      </View>
    </BottomPopUp>
  );
}
