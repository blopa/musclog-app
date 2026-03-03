import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { NutritionGoals, NutritionGoalsBody } from '../NutritionGoalsBody';
import { Button } from '../theme/Button';
import { FullScreenModal } from './FullScreenModal';

type NutritionGoalsModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: (goals: NutritionGoals) => void;
  initialGoals?: Partial<NutritionGoals>;
  isEditing?: boolean;
};

// Re-export for convenience
export type { NutritionGoals };

export function NutritionGoalsModal({
  visible,
  onClose,
  onSave,
  initialGoals,
  isEditing = false,
}: NutritionGoalsModalProps) {
  const { t } = useTranslation();
  const [currentGoals, setCurrentGoals] = useState<NutritionGoals | undefined>(undefined);

  const handleSave = (goals: NutritionGoals) => {
    onSave?.(goals);
    onClose();
  };

  const handleFloatingSave = () => {
    if (currentGoals) {
      handleSave(currentGoals);
    }
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={isEditing ? t('nutritionGoals.editTitle') : t('nutritionGoals.title')}
      scrollable={false}
      footer={
        <Button
          label={isEditing ? t('nutritionGoals.updateGoal') : t('nutritionGoals.saveGoals')}
          icon={ChevronRight}
          iconPosition="right"
          variant="gradientCta"
          size="md"
          width="full"
          onPress={handleFloatingSave}
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
