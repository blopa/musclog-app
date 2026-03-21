import { Save } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FitnessGoal, type Gender, LiftingExperience, WeightGoal } from '../database/models';
import { EditFitnessGoalsBody, type FitnessGoals } from './EditFitnessGoalsBody';
import { EditPhysicalStatsBody, type PhysicalStats } from './EditPhysicalStatsBody';
import { MaybeLaterButton } from './MaybeLaterButton';
import { Button } from './theme/Button';

type EditFitnessDetailsBodyProps = {
  onClose: () => void;
  onSave?: (data: FitnessDetails) => void;
  onFormChange?: (data: Partial<FitnessDetails>) => void;
  initialData?: Partial<FitnessDetails>;
  isLoading?: boolean;
  onMaybeLater?: () => void;
  hideSaveButton?: boolean;
  hideMaybeLaterButton?: boolean;
  mode?: 'physical' | 'goals' | 'both';
};

export type FitnessDetails = {
  dob?: string;
  units: 'imperial' | 'metric';
  weight: string;
  height: string;
  fatPercentage?: number;
  weightGoal: WeightGoal;
  fitnessGoal: FitnessGoal;
  activityLevel: number;
  gender: Gender;
  experience: LiftingExperience;
};

export function EditFitnessDetailsBody({
  onClose,
  onSave,
  onFormChange,
  initialData,
  isLoading,
  onMaybeLater,
  hideSaveButton = false,
  hideMaybeLaterButton = false,
  mode = 'both',
}: EditFitnessDetailsBodyProps) {
  const { t } = useTranslation();
  const showPhysical = mode === 'physical' || mode === 'both';
  const showGoals = mode === 'goals' || mode === 'both';

  // Units state in the wrapper so changes in form 2 update the unit labels in form 1
  const [units, setUnits] = useState<'imperial' | 'metric'>(initialData?.units ?? 'metric');

  // Refs track latest sub-form values for save/onFormChange without causing re-renders
  const physicalRef = useRef<PhysicalStats>({
    dob: initialData?.dob ?? '',
    gender: initialData?.gender ?? 'other',
    weight: initialData?.weight ?? '0',
    height: initialData?.height ?? '0',
    fatPercentage: initialData?.fatPercentage,
  });

  const goalsRef = useRef<FitnessGoals>({
    units: initialData?.units ?? 'metric',
    weightGoal: initialData?.weightGoal ?? 'maintain',
    fitnessGoal: initialData?.fitnessGoal ?? 'general',
    activityLevel: initialData?.activityLevel ?? 3,
    experience: initialData?.experience ?? 'intermediate',
  });

  const handlePhysicalStatsChange = useCallback(
    (data: PhysicalStats) => {
      physicalRef.current = data;
      onFormChange?.({ ...data, ...goalsRef.current });
    },
    [onFormChange]
  );

  const handleFitnessGoalsChange = useCallback(
    (data: FitnessGoals) => {
      goalsRef.current = data;
      setUnits(data.units);
      onFormChange?.({ ...physicalRef.current, ...data });
    },
    [onFormChange]
  );

  const handleSave = useCallback(() => {
    onSave?.({
      dob: physicalRef.current.dob,
      gender: physicalRef.current.gender,
      weight: physicalRef.current.weight,
      height: physicalRef.current.height,
      fatPercentage: physicalRef.current.fatPercentage,
      units: goalsRef.current.units,
      weightGoal: goalsRef.current.weightGoal,
      fitnessGoal: goalsRef.current.fitnessGoal,
      activityLevel: goalsRef.current.activityLevel,
      experience: goalsRef.current.experience,
    });
    onClose();
  }, [onSave, onClose]);

  const physicalInitial: Partial<PhysicalStats> = {
    dob: initialData?.dob,
    gender: initialData?.gender,
    weight: initialData?.weight,
    height: initialData?.height,
    fatPercentage: initialData?.fatPercentage,
  };

  const goalsInitial: Partial<FitnessGoals> = {
    units: initialData?.units,
    weightGoal: initialData?.weightGoal,
    fitnessGoal: initialData?.fitnessGoal,
    activityLevel: initialData?.activityLevel,
    experience: initialData?.experience,
  };

  return (
    <>
      {showPhysical ? (
        <EditPhysicalStatsBody
          initialData={physicalInitial}
          units={units}
          onFormChange={handlePhysicalStatsChange}
        />
      ) : null}
      {showGoals ? (
        <EditFitnessGoalsBody initialData={goalsInitial} onFormChange={handleFitnessGoalsChange} />
      ) : null}
      {!hideSaveButton ? (
        <View className="px-4 pb-8 pt-4">
          <Button
            label={t('editFitnessDetails.saveChanges')}
            icon={Save}
            variant="accent"
            size="md"
            width="full"
            loading={isLoading}
            onPress={handleSave}
          />
        </View>
      ) : null}
      {!hideMaybeLaterButton && onMaybeLater ? (
        <View className="px-4 pb-4">
          <MaybeLaterButton
            onPress={onMaybeLater}
            text={t('onboarding.healthConnect.maybeLater')}
          />
        </View>
      ) : null}
    </>
  );
}
