import { Check, Pencil, Pill, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { GenericCard } from '@/components/cards/GenericCard';
import { Button } from '@/components/theme/Button';
import { MenuButton } from '@/components/theme/MenuButton';
import { TextInput } from '@/components/theme/TextInput';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { Supplement } from '@/database';
import { SupplementService } from '@/database/services';
import { useTheme } from '@/hooks/useTheme';
import { showSnackbar } from '@/utils/snackbarService';

import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';

type ManageSupplementsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function ManageSupplementsModal({ visible, onClose }: ManageSupplementsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [activeMenuSupplement, setActiveMenuSupplement] = useState<Supplement | null>(null);
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState<Supplement | null>(null);
  const [supplementToDelete, setSupplementToDelete] = useState<Supplement | null>(null);
  const [name, setName] = useState('');
  const [hasReminder, setHasReminder] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadSupplements = useCallback(async () => {
    setIsLoading(true);
    try {
      setSupplements(await SupplementService.getActiveSupplements());
    } catch (error) {
      console.error('Error loading supplements:', error);
      showSnackbar('error', t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (visible) {
      void loadSupplements();
    }
  }, [visible, loadSupplements]);

  useEffect(() => {
    if (!isEditorVisible) {
      setName('');
      setHasReminder(true);
      setEditingSupplement(null);
      setIsSaving(false);
      return;
    }

    if (editingSupplement) {
      setName(editingSupplement.name);
      setHasReminder(editingSupplement.hasReminder);
    } else {
      setName('');
      setHasReminder(true);
    }
  }, [editingSupplement, isEditorVisible]);

  const openCreateModal = () => {
    setIsMenuVisible(false);
    setEditingSupplement(null);
    setIsEditorVisible(true);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    setIsSaving(true);
    try {
      if (editingSupplement) {
        await SupplementService.updateSupplement(editingSupplement.id, {
          name: trimmedName,
          hasReminder,
        });
      } else {
        await SupplementService.createSupplement({
          name: trimmedName,
          hasReminder,
        });
      }

      showSnackbar('success', t('common.success'));
      setIsEditorVisible(false);
      await loadSupplements();
    } catch (error) {
      console.error('Error saving supplement:', error);
      showSnackbar('error', t('common.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!supplementToDelete) {
      return;
    }

    try {
      await SupplementService.deleteSupplement(supplementToDelete.id);
      showSnackbar('success', t('common.deleteSuccess'));
      setSupplementToDelete(null);
      await loadSupplements();
    } catch (error) {
      console.error('Error deleting supplement:', error);
      showSnackbar('error', t('common.deleteFailed'));
    }
  };

  const handleToggleReminder = async (supplement: Supplement, nextValue: boolean) => {
    try {
      await SupplementService.updateSupplement(supplement.id, { hasReminder: nextValue });
      await loadSupplements();
    } catch (error) {
      console.error('Error updating supplement reminder:', error);
      showSnackbar('error', t('common.saveError'));
    }
  };

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('settings.advancedSettings.manageSupplements')}
        subtitle={t('settings.advancedSettings.manageSupplementsSubtitle')}
        headerRight={
          <MenuButton
            size="md"
            color={theme.colors.text.primary}
            onPress={() => setIsMenuVisible(true)}
            className="h-10 w-10"
          />
        }
      >
        <View className="px-4 py-6">
          {supplements.length === 0 && !isLoading ? (
            <View className="items-center rounded-3xl border border-border-light bg-bg-card px-6 py-10">
              <Pill size={theme.iconSize.xl} color={theme.colors.status.emerald} />
              <Text className="mt-4 text-center text-base font-bold text-text-primary">
                {t('settings.advancedSettings.manageSupplementsEmpty')}
              </Text>
              <View className="mt-6 w-full">
                <Button
                  label={t('settings.advancedSettings.addSupplement')}
                  onPress={openCreateModal}
                  icon={Plus}
                  variant="gradientCta"
                  width="full"
                />
              </View>
            </View>
          ) : (
            <View className="gap-3">
              {supplements.map((supplement) => (
                <GenericCard key={supplement.id} variant="default" size="sm">
                  <View className="p-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-1 flex-row items-center gap-3">
                        <View
                          style={{
                            width: theme.size['12'],
                            height: theme.size['12'],
                            borderRadius: theme.borderRadius['2xl'],
                            backgroundColor: theme.colors.status.emerald20,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Pill size={theme.iconSize.xl} color={theme.colors.status.emerald} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-base font-bold text-text-primary">
                            {supplement.name}
                          </Text>
                        </View>
                      </View>
                      <MenuButton
                        size="md"
                        color={theme.colors.text.primary}
                        onPress={() => setActiveMenuSupplement(supplement)}
                        className="h-10 w-10"
                      />
                    </View>
                    <View className="mt-4">
                      <ToggleInput
                        items={[
                          {
                            key: `supplement-reminder-${supplement.id}`,
                            label: t('settings.advancedSettings.dailySupplementPrompt'),
                            subtitle: t('settings.advancedSettings.dailySupplementPromptSubtitle'),
                            value: supplement.hasReminder,
                            onValueChange: (nextValue) =>
                              void handleToggleReminder(supplement, nextValue),
                          },
                        ]}
                      />
                    </View>
                  </View>
                </GenericCard>
              ))}
            </View>
          )}
        </View>
      </FullScreenModal>

      <BottomPopUp
        visible={isEditorVisible}
        onClose={isSaving ? undefined : () => setIsEditorVisible(false)}
        title={
          editingSupplement
            ? t('settings.advancedSettings.editSupplement')
            : t('settings.advancedSettings.addSupplement')
        }
        footer={
          <View className="flex-row" style={{ gap: theme.spacing.gap.md }}>
            <Button
              label={t('common.cancel')}
              onPress={() => setIsEditorVisible(false)}
              variant="outline"
              size="sm"
              width="flex-1"
              disabled={isSaving}
            />
            <Button
              label={t('common.save')}
              onPress={() => void handleSave()}
              icon={Check}
              variant="gradientCta"
              size="sm"
              width="flex-1"
              loading={isSaving}
              disabled={isSaving || !name.trim()}
            />
          </View>
        }
      >
        <View className="gap-4" pointerEvents={isSaving ? 'none' : 'auto'}>
          <TextInput
            label={t('settings.advancedSettings.supplementNameLabel')}
            value={name}
            onChangeText={setName}
            placeholder={t('settings.advancedSettings.supplementNamePlaceholder')}
          />
          <ToggleInput
            items={[
              {
                key: 'supplement-reminder-editor',
                label: t('settings.advancedSettings.dailySupplementPrompt'),
                subtitle: t('settings.advancedSettings.dailySupplementPromptSubtitle'),
                value: hasReminder,
                onValueChange: setHasReminder,
              },
            ]}
          />
          {editingSupplement ? (
            <Button
              label={t('common.delete')}
              onPress={() => setSupplementToDelete(editingSupplement)}
              icon={Trash2}
              variant="discard"
              width="full"
              disabled={isSaving}
            />
          ) : null}
        </View>
      </BottomPopUp>

      <ConfirmationModal
        visible={supplementToDelete != null}
        onClose={() => setSupplementToDelete(null)}
        onConfirm={() => void handleDelete()}
        title={t('common.delete')}
        message={t('common.deleteConfirmMessage', { name: supplementToDelete?.name ?? '' })}
        confirmLabel={t('common.delete')}
        variant="destructive"
      />

      <BottomPopUpMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        title={t('settings.advancedSettings.manageSupplements')}
        items={[
          {
            icon: Plus,
            iconColor: theme.colors.text.black,
            iconBgColor: theme.colors.accent.primary,
            title: t('settings.advancedSettings.addSupplement'),
            description: t('settings.advancedSettings.addSupplementDescription'),
            onPress: openCreateModal,
          },
        ]}
      />

      <BottomPopUpMenu
        visible={activeMenuSupplement != null}
        onClose={() => setActiveMenuSupplement(null)}
        title={activeMenuSupplement?.name ?? ''}
        items={[
          {
            icon: Pencil,
            iconColor: theme.colors.text.primary,
            iconBgColor: theme.colors.background.iconDarker,
            title: t('settings.advancedSettings.editSupplement'),
            description: t('settings.advancedSettings.editSupplementDescription'),
            onPress: () => {
              setEditingSupplement(activeMenuSupplement);
              setActiveMenuSupplement(null);
              setIsEditorVisible(true);
            },
          },
          {
            icon: Trash2,
            iconColor: theme.colors.status.error,
            iconBgColor: theme.colors.status.error20,
            title: t('common.delete'),
            description: t('settings.advancedSettings.deleteSupplementDescription'),
            titleColor: theme.colors.status.error,
            onPress: () => {
              setSupplementToDelete(activeMenuSupplement);
              setActiveMenuSupplement(null);
            },
          },
        ]}
      />
    </>
  );
}
