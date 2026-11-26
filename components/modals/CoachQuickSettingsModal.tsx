import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  AiHistoryPickers,
  AiOcrAndFoundationToggles,
} from '@/components/ai/AiContextAndOcrControls';
import { ThinkingLevelPicker } from '@/components/ai/ThinkingLevelPicker';
import { Button } from '@/components/theme/Button';
import { type NutritionLogHistoryDays, type WorkoutHistoryDays } from '@/constants/settings';
import { SettingsService } from '@/database/services/SettingsService';
import { useSettings } from '@/hooks/useSettings';
import type { ThinkingLevel } from '@/utils/aiThinkingLevel';
import { handleError } from '@/utils/handleError';

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
  const { t } = useTranslation();
  const settings = useSettings();

  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('off');
  const [useOcrBeforeAi, setUseOcrBeforeAi] = useState(false);
  const [sendFoundationFoodsToLlm, setSendFoundationFoodsToLlm] = useState(true);
  const [nutritionLogHistoryDays, setNutritionLogHistoryDays] =
    useState<NutritionLogHistoryDays>('none');
  const [workoutHistoryDays, setWorkoutHistoryDays] = useState<WorkoutHistoryDays>('none');

  const [isSaving, setIsSaving] = useState(false);

  // On-device AI forces OCR on and disables foundation foods, mirroring AI behavior settings.
  const isOnDeviceActive = settings.aiProvider === 'on-device';

  // Snapshot the current settings into local state whenever the modal opens, so
  // Cancel reliably discards edits and Save starts from the persisted values.
  useEffect(() => {
    if (visible) {
      // Wrapped in a function (not called directly in the effect body) to satisfy
      // react-hooks/set-state-in-effect — this is a deliberate snapshot-on-open.
      const snapshot = () => {
        setThinkingLevel(settings.thinkingLevel);
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await SettingsService.setCoachQuickSettings({
        thinkingLevel,
        sendFoundationFoodsToLlm,
        nutritionLogHistoryDays,
        workoutHistoryDays,
        // OCR is hidden / managed automatically while on-device AI is active.
        ...(isOnDeviceActive ? {} : { useOcrBeforeAi }),
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
        <View className="gap-3">
          <ThinkingLevelPicker
            value={thinkingLevel}
            onChange={setThinkingLevel}
            provider={settings.aiProvider}
            parentVisible={visible}
          />
          <AiOcrAndFoundationToggles
            isOnDevice={isOnDeviceActive}
            useOcrBeforeAi={useOcrBeforeAi}
            onUseOcrBeforeAiChange={setUseOcrBeforeAi}
            sendFoundationFoodsToLlm={sendFoundationFoodsToLlm}
            onSendFoundationFoodsToLlmChange={setSendFoundationFoodsToLlm}
            hideOcrWhenOnDevice
          />
        </View>

        <View className="gap-3">
          <AiHistoryPickers
            nutritionLogHistoryDays={nutritionLogHistoryDays}
            onNutritionLogHistoryDaysChange={setNutritionLogHistoryDays}
            workoutHistoryDays={workoutHistoryDays}
            onWorkoutHistoryDaysChange={setWorkoutHistoryDays}
          />
        </View>
      </View>
    </FullScreenModal>
  );
}
