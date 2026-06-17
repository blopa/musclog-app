import { Apple, Cpu, ScanText } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { type NutritionLogHistoryDays, type WorkoutHistoryDays } from '@/constants/settings';
import { SettingsService } from '@/database/services/SettingsService';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { handleError } from '@/utils/handleError';

import { HistoryPickerField } from './aiHistorySettings';
import { FullScreenModal } from './FullScreenModal';

type CoachQuickSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * A lightweight "quick settings" surface reachable from the coach chat options.
 *
 * Unlike the main AI settings screen (which auto-saves via useDebouncedSettings),
 * this modal keeps all edits in local state and only persists them when the user
 * taps "Save". "Cancel" discards every pending change. Saving writes straight to
 * SettingsService; the SettingsContext DB subscription propagates the new values
 * to the rest of the app.
 */
export function CoachQuickSettingsModal({ visible, onClose }: CoachQuickSettingsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const settings = useSettings();

  const [useThinkingMode, setUseThinkingMode] = useState(false);
  const [useOcrBeforeAi, setUseOcrBeforeAi] = useState(false);
  const [sendFoundationFoodsToLlm, setSendFoundationFoodsToLlm] = useState(true);
  const [nutritionLogHistoryDays, setNutritionLogHistoryDays] =
    useState<NutritionLogHistoryDays>('none');
  const [workoutHistoryDays, setWorkoutHistoryDays] = useState<WorkoutHistoryDays>('none');

  const [isSaving, setIsSaving] = useState(false);

  // Apple Intelligence (on-device AI) forces OCR on and disables foundation foods,
  // mirroring the behavior of the main AI settings screen.
  const useOnDeviceAi = settings.useOnDeviceAi;

  // Snapshot the current settings into local state whenever the modal opens, so
  // Cancel reliably discards edits and Save starts from the persisted values.
  useEffect(() => {
    if (visible) {
      // Wrapped in a function (not called directly in the effect body) to satisfy
      // react-hooks/set-state-in-effect — this is a deliberate snapshot-on-open.
      const snapshot = () => {
        setUseThinkingMode(settings.useThinkingMode);
        setUseOcrBeforeAi(settings.useOcrBeforeAi);
        setSendFoundationFoodsToLlm(settings.sendFoundationFoodsToLlm);
        setNutritionLogHistoryDays(settings.nutritionLogHistoryDays);
        setWorkoutHistoryDays(settings.workoutHistoryDays);
      };
      snapshot();
    }
    // Intentionally only re-run when visibility changes — we want a snapshot at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggleItems = [
    {
      key: 'use-thinking-mode',
      label: t('settings.aiSettings.useThinkingMode'),
      subtitle: t('settings.aiSettings.useThinkingModeSubtitle'),
      value: useThinkingMode,
      onValueChange: setUseThinkingMode,
      icon: (
        <View
          style={{
            width: theme.size['8'],
            height: theme.size['8'],
            borderRadius: theme.borderRadius.full / 2,
            backgroundColor: theme.colors.status.indigo10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Cpu size={theme.iconSize.md} color={theme.colors.status.indigo} />
        </View>
      ),
    },
    // OCR is required (and thus implicit) when Apple Intelligence is active, so hide it then.
    ...(useOnDeviceAi
      ? []
      : [
          {
            key: 'use-ocr-before-ai',
            label: t('settings.aiSettings.useOcrBeforeAi'),
            subtitle: t('settings.aiSettings.useOcrBeforeAiSubtitle'),
            value: useOcrBeforeAi,
            onValueChange: setUseOcrBeforeAi,
            icon: (
              <View
                style={{
                  width: theme.size['8'],
                  height: theme.size['8'],
                  borderRadius: theme.borderRadius.full / 2,
                  backgroundColor: theme.colors.status.success20,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ScanText size={theme.iconSize.md} color={theme.colors.status.success} />
              </View>
            ),
          },
        ]),
    {
      key: 'send-foundation-foods',
      label: t('settings.aiSettings.sendFoundationFoodsToLlm'),
      subtitle: useOnDeviceAi
        ? t('settings.aiSettings.onDeviceAi.foundationFoodsDisabled')
        : t('settings.aiSettings.sendFoundationFoodsToLlmSubtitle'),
      value: useOnDeviceAi ? false : sendFoundationFoodsToLlm,
      onValueChange: setSendFoundationFoodsToLlm,
      disabled: useOnDeviceAi,
      icon: (
        <View
          style={{
            width: theme.size['8'],
            height: theme.size['8'],
            borderRadius: theme.borderRadius.full / 2,
            backgroundColor: theme.colors.accent.primary20,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Apple size={theme.iconSize.md} color={theme.colors.accent.primary} />
        </View>
      ),
    },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await SettingsService.setCoachQuickSettings({
        useThinkingMode,
        sendFoundationFoodsToLlm,
        nutritionLogHistoryDays,
        workoutHistoryDays,
        // OCR is hidden / managed automatically while Apple Intelligence is on.
        ...(useOnDeviceAi ? {} : { useOcrBeforeAi }),
      });
      onClose();
    } catch (err) {
      handleError(err, 'CoachQuickSettingsModal.handleSave', {
        snackbarMessage: t('coach.errors.generalError'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('coach.quickSettings.title')}
      subtitle={t('coach.quickSettings.subtitle')}
      footer={
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              label={t('common.cancel')}
              onPress={onClose}
              variant="outline"
              width="full"
              disabled={isSaving}
            />
          </View>
          <View className="flex-1">
            <Button
              label={t('common.save')}
              onPress={handleSave}
              variant="accent"
              width="full"
              loading={isSaving}
            />
          </View>
        </View>
      }
    >
      <View className="gap-6 px-4 py-6">
        <View>
          <ToggleInput items={toggleItems} />
        </View>

        <View className="gap-3">
          <HistoryPickerField
            kind="nutrition"
            value={nutritionLogHistoryDays}
            onChange={(value) => setNutritionLogHistoryDays(value as NutritionLogHistoryDays)}
          />
          <HistoryPickerField
            kind="workout"
            value={workoutHistoryDays}
            onChange={(value) => setWorkoutHistoryDays(value as WorkoutHistoryDays)}
          />
        </View>
      </View>
    </FullScreenModal>
  );
}
