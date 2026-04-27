import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { Button } from '@/components/theme/Button';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import { TextInput } from '@/components/theme/TextInput';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { AiCustomPrompt } from '@/database/models';
import { type AiCustomPromptContext } from '@/database/models/AiCustomPrompt';
import { useAiCustomPrompts } from '@/hooks/useAiCustomPrompts';
import { useTheme } from '@/hooks/useTheme';

type AiCustomPromptEditModalProps = {
  visible: boolean;
  onClose: () => void;
  prompt?: AiCustomPrompt;
};

export function AiCustomPromptEditModal({
  visible,
  onClose,
  prompt,
}: AiCustomPromptEditModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { createPrompt, updatePrompt } = useAiCustomPrompts();

  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [context, setContext] = useState<AiCustomPromptContext>('general');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (prompt) {
      setName(prompt.name);
      setContent(prompt.content);
      setContext(prompt.context ?? 'general');
      setIsActive(prompt.isActive);
    } else {
      setName('');
      setContent('');
      setContext('general');
      setIsActive(true);
    }
  }, [prompt, visible]);

  const handleSave = async () => {
    if (prompt) {
      await updatePrompt(prompt.id, { name, content, context, isActive });
    } else {
      await createPrompt(name, content, isActive, context);
    }
    onClose();
  };

  const isSaveDisabled = !name.trim() || !content.trim();

  const contextOptions = [
    { label: t('settings.aiSettings.promptContextGeneral'), value: 'general' },
    { label: t('settings.aiSettings.promptContextNutrition'), value: 'nutrition' },
    { label: t('settings.aiSettings.promptContextExercise'), value: 'exercise' },
  ];

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

        <View className="gap-2">
          <Text
            className="text-xs font-bold tracking-wider uppercase"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('settings.aiSettings.promptContext')}
          </Text>
          <SegmentedControl
            options={contextOptions}
            value={context}
            onValueChange={(v) => setContext(v as AiCustomPromptContext)}
            variant="outline"
          />
        </View>

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

        <View className="mt-2 mb-4 flex-row gap-4">
          <Button label={t('common.cancel')} onPress={onClose} variant="outline" width="flex-1" />
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
