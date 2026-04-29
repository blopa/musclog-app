import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  NutritionGoals,
  NutritionGoalsBody,
  type NutritionGoalsInitialValues,
} from '@/components/NutritionGoalsBody';
import { Button } from '@/components/theme/Button';

import { FullScreenModal } from './FullScreenModal';

type NutritionGoalsModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: (goals: NutritionGoals) => void | Promise<void>;
  initialGoals: NutritionGoalsInitialValues;
  isEditing?: boolean;
};

// Re-export for convenience
export type { NutritionGoals, NutritionGoalsInitialValues };

export function NutritionGoalsModal({
  visible,
  onClose,
  onSave,
  initialGoals,
  isEditing = false,
}: NutritionGoalsModalProps) {
  const { t } = useTranslation();
  const [currentGoals, setCurrentGoals] = useState<NutritionGoals>(() => ({
    totalCalories: initialGoals.totalCalories,
    protein: initialGoals.protein,
    carbs: initialGoals.carbs,
    fats: initialGoals.fats,
    fiber: initialGoals.fiber,
    eatingPhase: initialGoals.eatingPhase,
    targetWeight: initialGoals.targetWeight ?? null,
    targetBodyFat: initialGoals.targetBodyFat ?? null,
    targetBMI: initialGoals.targetBMI ?? null,
    targetFFMI: initialGoals.targetFFMI ?? null,
    targetDate: initialGoals.targetDate ?? null,
    goalStartDate: initialGoals.goalStartDate ?? null,
    isDynamic: initialGoals.isDynamic ?? false,
  }));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setIsSaving(false);
    }
  }, [visible]);

  const handleSave = async (goals: NutritionGoals) => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    // Small delay to allow React to render the loading state before heavy save work starts.
    await new Promise<void>((resolve) => setTimeout(resolve, 1));

    try {
      await onSave?.(goals);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFloatingSave = async () => {
    await handleSave(currentGoals);
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={isSaving ? () => {} : onClose}
      title={isEditing ? t('nutritionGoals.editTitle') : t('nutritionGoals.title')}
      scrollable={false}
      closable={!isSaving}
      footer={
        <Button
          label={isEditing ? t('nutritionGoals.updateGoal') : t('nutritionGoals.saveGoals')}
          icon={ChevronRight}
          iconPosition="right"
          variant="gradientCta"
          size="md"
          width="full"
          onPress={handleFloatingSave}
          loading={isSaving}
          disabled={isSaving}
        />
      }
    >
      <NutritionGoalsBody
        onSave={handleSave}
        onFormChange={setCurrentGoals}
        initialGoals={initialGoals}
        showSaveButton={false}
        showGoalStartDate={!isEditing}
      />
    </FullScreenModal>
  );
}
