import React from 'react';
import { useTranslation } from 'react-i18next';
import { FullScreenModal } from './FullScreenModal';
import { NutritionGoalsModalBody, NutritionGoals } from './NutritionGoalsModalBody';

type NutritionGoalsModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: (goals: NutritionGoals) => void;
  initialGoals?: Partial<NutritionGoals>;
};

// Re-export for convenience
export type { NutritionGoals };

export function NutritionGoalsModal({
  visible,
  onClose,
  onSave,
  initialGoals,
}: NutritionGoalsModalProps) {
  const { t } = useTranslation();
  const handleSave = (goals: NutritionGoals) => {
    onSave?.(goals);
    onClose();
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('nutritionGoals.title')}
      scrollable={false}>
      <NutritionGoalsModalBody onSave={handleSave} initialGoals={initialGoals} />
    </FullScreenModal>
  );
}
