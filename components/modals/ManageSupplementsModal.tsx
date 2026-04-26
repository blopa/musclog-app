import { Check, Edit2, Pill, Plus, Trash2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Supplement } from '../../database/models';
import { SupplementService } from '../../database/services';
import { useTheme } from '../../hooks/useTheme';
import { GenericCard } from '../cards/GenericCard';
import { Button } from '../theme/Button';
import { TextInput } from '../theme/TextInput';
import { ToggleInput } from '../theme/ToggleInput';
import { CenteredModal } from './CenteredModal';
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

  const [isAddEditModalVisible, setIsAddEditModalVisible] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState<Supplement | null>(null);
  const [supplementToDelete, setSupplementToDelete] = useState<Supplement | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [hasReminder, setHasReminder] = useState(true);

  const loadSupplements = async () => {
    setIsLoading(true);
    try {
      const data = await SupplementService.getActiveSupplements();
      setSupplements(data);
    } catch (error) {
      console.error('Error loading supplements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadSupplements();
    }
  }, [visible]);

  useEffect(() => {
    if (editingSupplement) {
      setName(editingSupplement.name);
      setDosage(editingSupplement.dosage || '');
      setHasReminder(editingSupplement.hasReminder);
    } else {
      setName('');
      setDosage('');
      setHasReminder(true);
    }
  }, [editingSupplement, isAddEditModalVisible]);

  const handleSave = async () => {
    if (!name.trim()) return;

    try {
      if (editingSupplement) {
        await SupplementService.updateSupplement(editingSupplement.id, {
          name: name.trim(),
          dosage: dosage.trim() || undefined,
          hasReminder,
        });
      } else {
        await SupplementService.createSupplement({
          name: name.trim(),
          dosage: dosage.trim() || undefined,
          hasReminder,
        });
      }
      setIsAddEditModalVisible(false);
      setEditingSupplement(null);
      loadSupplements();
    } catch (error) {
      console.error('Error saving supplement:', error);
    }
  };

  const handleDelete = async () => {
    if (supplementToDelete) {
      try {
        await SupplementService.deleteSupplement(supplementToDelete.id);
        setSupplementToDelete(null);
        loadSupplements();
      } catch (error) {
        console.error('Error deleting supplement:', error);
      }
    }
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('settings.advancedSettings.manageSupplements')}
      headerRight={
        <Pressable
          onPress={() => {
            setEditingSupplement(null);
            setIsAddEditModalVisible(true);
          }}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-bg-overlay"
        >
          <Plus size={theme.iconSize.lg} color={theme.colors.accent.primary} />
        </Pressable>
      }
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: theme.spacing.padding.base }}
      >
        {supplements.length === 0 && !isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-center text-text-secondary">
              {t('common.notFound')}
            </Text>
            <View className="mt-6">
              <Button
                label={t('common.createNew')}
                onPress={() => setIsAddEditModalVisible(true)}
                icon={Plus}
                variant="accent"
              />
            </View>
          </View>
        ) : (
          <View className="gap-4">
            {supplements.map((supplement) => (
              <GenericCard key={supplement.id} variant="card">
                <View className="p-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 flex-row items-center gap-3">
                      <View
                        style={{
                          width: theme.size['10'],
                          height: theme.size['10'],
                          borderRadius: theme.borderRadius.sm,
                          backgroundColor: theme.colors.status.emerald20,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Pill size={theme.iconSize.xl} color={theme.colors.status.emerald} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-lg font-bold text-text-primary" numberOfLines={1}>
                          {supplement.name}
                        </Text>
                        {supplement.dosage ? (
                          <Text className="text-sm text-text-secondary">
                            {supplement.dosage}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Pressable
                        onPress={() => {
                          setEditingSupplement(supplement);
                          setIsAddEditModalVisible(true);
                        }}
                        className="h-8 w-8 items-center justify-center rounded-full active:bg-bg-overlay"
                      >
                        <Edit2 size={theme.iconSize.sm} color={theme.colors.text.secondary} />
                      </Pressable>
                      <Pressable
                        onPress={() => setSupplementToDelete(supplement)}
                        className="h-8 w-8 items-center justify-center rounded-full active:bg-bg-overlay"
                      >
                        <Trash2 size={theme.iconSize.sm} color={theme.colors.status.error20} />
                      </Pressable>
                    </View>
                  </View>

                  <View className="mt-4 border-t border-border-light pt-2">
                    <ToggleInput
                      items={[
                        {
                          key: `reminder-${supplement.id}`,
                          label: t('settings.advancedSettings.dailySupplementPrompt'),
                          value: supplement.hasReminder,
                          onValueChange: async () => {
                            await SupplementService.updateSupplement(supplement.id, {
                              hasReminder: !supplement.hasReminder,
                            });
                            loadSupplements();
                          },
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

      <CenteredModal
        visible={isAddEditModalVisible}
        onClose={() => {
          setIsAddEditModalVisible(false);
          setEditingSupplement(null);
        }}
        title={editingSupplement ? t('common.edit') : t('common.createNew')}
        footer={
          <View className="flex-row" style={{ gap: theme.spacing.gap.md }}>
            <Button
              label={t('common.cancel')}
              variant="outline"
              size="sm"
              width="flex-1"
              onPress={() => {
                setIsAddEditModalVisible(false);
                setEditingSupplement(null);
              }}
            />
            <Button
              label={t('common.save')}
              variant="accent"
              size="sm"
              width="flex-1"
              onPress={handleSave}
              disabled={!name.trim()}
              icon={Check}
            />
          </View>
        }
      >
        <View className="gap-4">
          <TextInput
            label={t('settings.advancedSettings.supplementNameLabel')}
            value={name}
            onChangeText={setName}
            placeholder={t('settings.advancedSettings.supplementNamePlaceholder')}
          />
          <TextInput
            label={t('common.description')} // Using description for dosage label if specific one doesn't exist
            value={dosage}
            onChangeText={setDosage}
            placeholder="e.g. 5g, 1 pill"
          />
          <ToggleInput
            items={[
              {
                key: 'form-reminder',
                label: t('settings.advancedSettings.dailySupplementPrompt'),
                value: hasReminder,
                onValueChange: () => setHasReminder(!hasReminder),
              },
            ]}
          />
        </View>
      </CenteredModal>

      <ConfirmationModal
        visible={!!supplementToDelete}
        onClose={() => setSupplementToDelete(null)}
        onConfirm={handleDelete}
        title={t('common.delete')}
        message={t('common.deleteConfirmMessage', { name: supplementToDelete?.name })}
        confirmLabel={t('common.delete')}
        variant="destructive"
      />
    </FullScreenModal>
  );
}
