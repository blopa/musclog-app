import React from 'react';
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
  const handleSave = (goals: NutritionGoals) => {
    onSave?.(goals);
    onClose();
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title="Set Nutrition & Body Goals"
      scrollable={false}
    >
      <NutritionGoalsModalBody onSave={handleSave} initialGoals={initialGoals} />
    </FullScreenModal>
  );
}
