import { Minus, Plus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { IconButton } from '@/components/theme/IconButton';
import { StepperInput } from '@/components/theme/StepperInput';
import { TextInput } from '@/components/theme/TextInput';
import { EQUIPMENT_LABEL_KEYS } from '@/components/workout/restrictionLabelKeys';
import { WeightUnitOverridePicker } from '@/components/workout/WeightUnitOverridePicker';
import { useSnackbar } from '@/context/SnackbarContext';
import type { EquipmentType } from '@/database/models/Exercise';
import { GymService } from '@/database/services/GymService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import {
  defaultBarWeightKg,
  defaultPlates,
  defaultWeightIncrementKg,
  EQUIPMENT_TYPES,
  type GymPlate,
  type GymSnapshot,
  toStoredGymWeightKg,
} from '@/utils/gym';
import {
  displayToKg,
  kgToDisplay,
  resolveWeightUnits,
  type WeightUnitOverride,
} from '@/utils/unitConversion';
import { getWeightUnitI18nKey } from '@/utils/units';

import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';

type EditGymModalProps = {
  visible: boolean;
  onClose: () => void;
  /** The gym to edit, or `null` to create one. */
  gym: GymSnapshot | null;
  /** True when no other gym exists, so the new one should become the active gym straight away. */
  isFirstGym?: boolean;
};

type PlateRow = { weightKg: number; count: number };

// Plates come in quarters (1.25 kg, 2.5 lb): two decimals keep exactly what people type.
const DISPLAY_DECIMALS = 2;
const roundDisplay = (value: number) =>
  Math.round(value * 10 ** DISPLAY_DECIMALS) / 10 ** DISPLAY_DECIMALS;
/** Fine adjustment of the smallest step: stacks and dumbbells come in odd jumps. */
const INCREMENT_NUDGE = 0.5;
/** Fine adjustment of a new plate's weight: change plates go down to a quarter of a unit. */
const PLATE_NUDGE = 0.25;

/**
 * Create or edit a gym profile. The form works in the gym's display unit — the one the user
 * pinned for it, else the account's — and converts to kilograms once, on save: a lifter in pounds
 * types "45" and the app stores 20.4116567.
 *
 * The pinned unit is only ever what the user chose in the picker. It must never be copied from the
 * account on save, or switching the account's units later would leave every gym on the old one.
 */
export function EditGymModal({ visible, onClose, gym, isFirstGym = false }: EditGymModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units: accountUnits } = useSettings();
  const { locale } = useFormatAppNumber();
  const { showSnackbar } = useSnackbar();

  const [name, setName] = useState('');
  // Weights are held in kilograms, like the plates: the picked unit only changes how they are
  // shown and typed, so switching it back and forth can never drift a value.
  const [barKg, setBarKg] = useState(0);
  const [incrementKg, setIncrementKg] = useState(0);
  const [plates, setPlates] = useState<PlateRow[]>([]);
  const [newPlateKg, setNewPlateKg] = useState(0);
  const [equipment, setEquipment] = useState<EquipmentType[]>([]);
  const [unitChoice, setUnitChoice] = useState<WeightUnitOverride | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);

  const units = resolveWeightUnits({ account: accountUnits, gym: unitChoice });
  const unit = t(getWeightUnitI18nKey(units));
  const shown = (kg: number) => roundDisplay(kgToDisplay(kg, units));
  // A nudge happens on the number the user sees, then goes back to kilograms.
  const nudged = (kg: number, delta: number, min: number) =>
    displayToKg(Math.max(min, roundDisplay(shown(kg) + delta)), units);
  // The bar moves by the default step (2.5 kg / 5 lb); a new plate starts at twice it.
  const barStep = shown(defaultWeightIncrementKg(units));

  // Seed the form each time the modal opens (or switches gym). It is a snapshot on purpose: a
  // subscription would overwrite what the user is typing whenever any gym changes.
  const gymId = gym?.id ?? null;
  useEffect(() => {
    if (!visible) {
      return;
    }
    const seed = () => {
      const pinned = gym?.weightUnit ?? null;
      const seedUnits = resolveWeightUnits({ account: accountUnits, gym: pinned });
      setUnitChoice(pinned);
      setName(gym?.name ?? '');
      setBarKg(gym?.barWeightKg ?? defaultBarWeightKg(seedUnits));
      setIncrementKg(gym?.weightIncrementKg ?? defaultWeightIncrementKg(seedUnits));
      setPlates(
        (gym?.plates ?? defaultPlates(seedUnits)).map(({ weightKg, count }) => ({
          weightKg,
          count,
        }))
      );
      setEquipment(gym?.equipment ?? [...EQUIPMENT_TYPES]);
      setNewPlateKg(2 * defaultWeightIncrementKg(seedUnits));
    };
    seed();
    // `gym` is read through its id: the object changes identity on every unrelated gym edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, gymId, accountUnits]);

  const showKg = (kg: number) => formatDisplayWeightKg(locale, units, kg);

  const setPlateCount = (weightKg: number, count: number) =>
    setPlates((current) =>
      current.map((plate) => (plate.weightKg === weightKg ? { ...plate, count } : plate))
    );

  const addPlate = () => {
    const weightKg = toStoredGymWeightKg(newPlateKg);
    if (!(weightKg > 0)) {
      return;
    }
    setPlates((current) =>
      current.some((plate) => plate.weightKg === weightKg)
        ? current
        : [...current, { weightKg, count: 2 }].sort((a, b) => b.weightKg - a.weightKg)
    );
  };

  const toggleEquipment = (type: EquipmentType) =>
    setEquipment((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
    );

  const handleSave = async () => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      const input = {
        name,
        barWeightKg: barKg,
        plates: plates.filter((plate) => plate.count > 0) satisfies GymPlate[],
        weightIncrementKg: incrementKg,
        equipment,
        weightUnit: unitChoice,
      };
      if (gym) {
        await GymService.updateGym(gym.id, input);
      } else {
        await GymService.createGym(input, { makeActive: isFirstGym });
      }
      onClose();
    } catch {
      showSnackbar('error', t('workoutSettings.editGym.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!gym) {
      return;
    }
    setIsDeleteConfirmVisible(false);
    try {
      await GymService.deleteGym(gym.id);
      onClose();
    } catch {
      showSnackbar('error', t('workoutSettings.editGym.saveFailed'));
    }
  };

  const sectionTitle = (text: string) => (
    <Text className="text-xl font-bold" style={{ color: theme.colors.text.primary }}>
      {text}
    </Text>
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={gym ? t('workoutSettings.editGym.title') : t('workoutSettings.editGym.createTitle')}
      footer={
        <View className="flex-row items-stretch gap-3">
          {gym ? (
            <Button
              label={t('workoutSettings.editGym.delete')}
              variant="discard"
              size="sm"
              width="flex-1"
              onPress={() => setIsDeleteConfirmVisible(true)}
            />
          ) : null}
          <Button
            label={t('workoutSettings.editGym.save')}
            size="sm"
            width="flex-2"
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving}
          />
        </View>
      }
    >
      <View className="gap-6 px-4 pb-8 pt-4" testID="edit-gym-form">
        <TextInput
          label={t('workoutSettings.editGym.name')}
          value={name}
          onChangeText={setName}
          placeholder={t('workoutSettings.editGym.namePlaceholder')}
          selectTextOnFocus={false}
        />

        <View className="gap-2">
          <WeightUnitOverridePicker
            label={t('workoutSettings.editGym.unit')}
            defaultLabel={t('workoutSettings.editGym.unitDefault')}
            value={unitChoice}
            onChange={setUnitChoice}
          />
          <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
            {t('workoutSettings.editGym.unitHint')}
          </Text>
        </View>

        <View className="gap-3">
          <StepperInput
            label={t('workoutSettings.editGym.bar', { unit })}
            value={shown(barKg)}
            maxFractionDigits={DISPLAY_DECIMALS}
            step={barStep}
            unit={unit}
            onChangeValue={(value) => setBarKg(displayToKg(Math.max(0, value), units))}
            onIncrement={() => setBarKg((kg) => nudged(kg, barStep, 0))}
            onDecrement={() => setBarKg((kg) => nudged(kg, -barStep, 0))}
          />
          <StepperInput
            label={t('workoutSettings.editGym.increment', { unit })}
            value={shown(incrementKg)}
            maxFractionDigits={DISPLAY_DECIMALS}
            step={INCREMENT_NUDGE}
            unit={unit}
            onChangeValue={(value) => setIncrementKg(displayToKg(Math.max(0, value), units))}
            onIncrement={() => setIncrementKg((kg) => nudged(kg, INCREMENT_NUDGE, INCREMENT_NUDGE))}
            onDecrement={() =>
              setIncrementKg((kg) => nudged(kg, -INCREMENT_NUDGE, INCREMENT_NUDGE))
            }
          />
          <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
            {t('workoutSettings.editGym.incrementHint')}
          </Text>
        </View>

        <View className="gap-3">
          {sectionTitle(t('workoutSettings.editGym.plates'))}
          <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
            {t('workoutSettings.editGym.platesHint')}
          </Text>
          {plates.map((plate) => (
            <View
              key={plate.weightKg}
              className="flex-row items-center justify-between gap-3 rounded-lg px-4 py-3"
              style={{ backgroundColor: theme.colors.background.card }}
            >
              <Text className="text-lg font-bold" style={{ color: theme.colors.text.primary }}>
                {showKg(plate.weightKg)} {unit}
              </Text>
              <View className="flex-row items-center gap-3">
                <IconButton
                  icon={Minus}
                  size="sm"
                  variant="elevated"
                  onPress={() => setPlateCount(plate.weightKg, Math.max(0, plate.count - 2))}
                  accessibilityLabel={t('workoutSettings.editGym.fewerPlates', {
                    weight: showKg(plate.weightKg),
                    unit,
                  })}
                />
                <Text
                  className="min-w-[2.5rem] text-center text-lg"
                  style={{ color: theme.colors.text.primary }}
                >
                  {plate.count}
                </Text>
                <IconButton
                  icon={Plus}
                  size="sm"
                  variant="elevated"
                  onPress={() => setPlateCount(plate.weightKg, plate.count + 2)}
                  accessibilityLabel={t('workoutSettings.editGym.morePlates', {
                    weight: showKg(plate.weightKg),
                    unit,
                  })}
                />
                <IconButton
                  icon={X}
                  size="sm"
                  variant="ghost"
                  color={theme.colors.text.secondary}
                  onPress={() =>
                    setPlates((current) =>
                      current.filter((item) => item.weightKg !== plate.weightKg)
                    )
                  }
                  accessibilityLabel={t('workoutSettings.editGym.removePlate', {
                    weight: showKg(plate.weightKg),
                    unit,
                  })}
                />
              </View>
            </View>
          ))}

          <StepperInput
            label={t('workoutSettings.editGym.plateWeight', { unit })}
            value={shown(newPlateKg)}
            maxFractionDigits={DISPLAY_DECIMALS}
            step={PLATE_NUDGE}
            unit={unit}
            onChangeValue={(value) => setNewPlateKg(displayToKg(Math.max(0, value), units))}
            onIncrement={() => setNewPlateKg((kg) => nudged(kg, PLATE_NUDGE, PLATE_NUDGE))}
            onDecrement={() => setNewPlateKg((kg) => nudged(kg, -PLATE_NUDGE, PLATE_NUDGE))}
          />
          <View className="flex-row gap-3">
            <Button
              label={t('workoutSettings.editGym.addPlate')}
              icon={Plus}
              variant="secondary"
              size="sm"
              width="flex-1"
              onPress={addPlate}
            />
            <Button
              label={t('workoutSettings.editGym.resetPlates')}
              variant="outline"
              size="sm"
              width="flex-1"
              onPress={() => setPlates(defaultPlates(units))}
            />
          </View>
        </View>

        <View className="gap-3">
          {sectionTitle(t('workoutSettings.editGym.equipment'))}
          <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
            {t('workoutSettings.editGym.equipmentHint')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {EQUIPMENT_TYPES.map((type) => {
              const selected = equipment.includes(type);
              return (
                <Chip
                  key={type}
                  role="checkbox"
                  selected={selected}
                  onPress={() => toggleEquipment(type)}
                  label={t(EQUIPMENT_LABEL_KEYS[type])}
                />
              );
            })}
          </View>
        </View>
      </View>

      {isDeleteConfirmVisible ? (
        <ConfirmationModal
          visible={isDeleteConfirmVisible}
          onClose={() => setIsDeleteConfirmVisible(false)}
          onConfirm={handleDelete}
          title={t('workoutSettings.editGym.deleteTitle')}
          message={t('workoutSettings.editGym.deleteMessage')}
          confirmLabel={t('workoutSettings.editGym.delete')}
          variant="destructive"
        />
      ) : null}
    </FullScreenModal>
  );
}
