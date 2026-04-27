import { Edit2, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { Button } from '@/components/theme/Button';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { AiCustomPrompt } from '@/database/models';
import { useAiCustomPrompts } from '@/hooks/useAiCustomPrompts';
import { useTheme } from '@/hooks/useTheme';
import { flushLoadingPaint } from '@/utils/flushLoadingPaint';

import { AiCustomPromptEditModal } from './AiCustomPromptEditModal';
import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';

type AiCustomPromptsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function AiCustomPromptsModal({ visible, onClose }: AiCustomPromptsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { prompts, deletePrompt, togglePromptActive } = useAiCustomPrompts();

  const [editingPrompt, setEditingPrompt] = useState<AiCustomPrompt | null>(null);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<AiCustomPrompt | null>(null);
  const [isDeletingPrompt, setIsDeletingPrompt] = useState(false);

  useEffect(() => {
    if (!visible) {
      setEditingPrompt(null);
      setIsAddModalVisible(false);
      setPromptToDelete(null);
    }
  }, [visible]);

  const handleDelete = async () => {
    if (!promptToDelete) {
      return;
    }

    setIsDeletingPrompt(true);
    await flushLoadingPaint();
    try {
      await deletePrompt(promptToDelete.id);
      setPromptToDelete(null);
    } finally {
      setIsDeletingPrompt(false);
    }
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('settings.aiSettings.manageCustomPrompts')}
      headerRight={
        <Pressable
          onPress={() => setIsAddModalVisible(true)}
          className="active:bg-bg-overlay h-10 w-10 items-center justify-center rounded-full"
        >
          <Plus size={theme.iconSize.lg} color={theme.colors.accent.primary} />
        </Pressable>
      }
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: theme.spacing.padding.base }}
      >
        {prompts.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-text-secondary text-center">
              {t('settings.aiSettings.noPrompts')}
            </Text>
            <View className="mt-6">
              <Button
                label={t('settings.aiSettings.addPrompt')}
                onPress={() => setIsAddModalVisible(true)}
                icon={Plus}
                variant="accent"
              />
            </View>
          </View>
        ) : (
          <View className="gap-4">
            {prompts.map((prompt) => (
              <GenericCard key={prompt.id} variant="card">
                <View className="p-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-text-primary flex-1 text-lg font-bold" numberOfLines={1}>
                      {prompt.name}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <Pressable
                        onPress={() => setEditingPrompt(prompt)}
                        className="active:bg-bg-overlay h-8 w-8 items-center justify-center rounded-full"
                      >
                        <Edit2 size={theme.iconSize.sm} color={theme.colors.text.secondary} />
                      </Pressable>
                      <Pressable
                        onPress={() => setPromptToDelete(prompt)}
                        className="active:bg-bg-overlay h-8 w-8 items-center justify-center rounded-full"
                      >
                        <Trash2 size={theme.iconSize.sm} color={theme.colors.status.error20} />
                      </Pressable>
                    </View>
                  </View>

                  <View className="mt-1 flex-row items-center gap-2">
                    <View
                      style={{
                        backgroundColor: theme.colors.accent.primary20,
                        borderRadius: theme.borderRadius.sm,
                        paddingHorizontal: theme.spacing.padding.sm,
                        paddingVertical: 2,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: theme.typography.fontSize.xs,
                          color: theme.colors.accent.primary,
                          fontWeight: '600',
                          textTransform: 'capitalize',
                        }}
                      >
                        {t(
                          `settings.aiSettings.promptContext${(prompt.context ?? 'general').charAt(0).toUpperCase()}${(prompt.context ?? 'general').slice(1)}`
                        )}
                      </Text>
                    </View>
                  </View>

                  <Text className="text-text-secondary mt-2 text-sm" numberOfLines={3}>
                    {prompt.content}
                  </Text>

                  <View className="border-border-light mt-4 border-t pt-2">
                    <ToggleInput
                      items={[
                        {
                          key: `toggle-${prompt.id}`,
                          label: t('settings.aiSettings.promptIsActive'),
                          value: prompt.isActive,
                          onValueChange: () => togglePromptActive(prompt.id),
                        },
                      ]}
                    />
                  </View>
                </View>
              </GenericCard>
            ))}
          </View>
        )}
      </ScrollView>

      <AiCustomPromptEditModal
        visible={isAddModalVisible || !!editingPrompt}
        onClose={() => {
          setIsAddModalVisible(false);
          setEditingPrompt(null);
        }}
        prompt={editingPrompt || undefined}
      />

      <ConfirmationModal
        visible={!!promptToDelete}
        onClose={() => setPromptToDelete(null)}
        onConfirm={handleDelete}
        title={t('settings.aiSettings.deletePrompt')}
        message={t('settings.aiSettings.deletePromptConfirm')}
        confirmLabel={t('common.delete')}
        variant="destructive"
        isLoading={isDeletingPrompt}
      />
    </FullScreenModal>
  );
}
