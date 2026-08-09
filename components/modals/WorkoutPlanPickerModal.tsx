import { Plus } from 'lucide-react-native';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/theme/Button';
import DashedButton from '@/components/theme/DashedButton';
import { OptionsMultiSelector } from '@/components/theme/OptionsMultiSelector/OptionsMultiSelector';
import type WorkoutPlan from '@/database/models/WorkoutPlan';
import { useTheme } from '@/hooks/useTheme';
import { getWorkoutIcon } from '@/utils/workoutIconUtils';

import { FullScreenModal } from './FullScreenModal';

interface WorkoutPlanPickerModalProps {
  visible: boolean;
  plans: WorkoutPlan[];
  selectedPlanIds: string[];
  onChange: (planIds: string[]) => void;
  onClose: () => void;
  onCreatePlan?: () => void;
  nestedModals?: ReactNode;
}

export function WorkoutPlanPickerModal({
  visible,
  plans,
  selectedPlanIds,
  onChange,
  onClose,
  onCreatePlan,
  nestedModals,
}: WorkoutPlanPickerModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const options = useMemo(
    () =>
      plans.map((plan) => ({
        id: plan.id,
        label: plan.name,
        description: t(`workouts.plans.cycleType.${plan.cycleType}`),
        icon: getWorkoutIcon(plan.icon),
        iconBgColor: theme.colors.accent.primary10,
        iconColor: theme.colors.accent.primary,
      })),
    [plans, t, theme]
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('workouts.plans.picker.title')}
      footer={
        <Button
          label={t('common.close')}
          variant="gradientCta"
          size="md"
          width="full"
          onPress={onClose}
        />
      }
    >
      <View className="gap-4 px-4 py-6">
        <OptionsMultiSelector
          title={t('workouts.plans.picker.description')}
          options={options}
          selectedIds={selectedPlanIds}
          onChange={onChange}
          hasGroups={false}
        />
        {onCreatePlan ? (
          <DashedButton
            label={t('workouts.plans.picker.create')}
            onPress={onCreatePlan}
            size="sm"
            icon={<Plus size={theme.iconSize.md} color={theme.colors.text.primary} />}
          />
        ) : null}
      </View>
      {nestedModals}
    </FullScreenModal>
  );
}
