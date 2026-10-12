import { Plus, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { StepperInput } from '@/components/theme/StepperInput';
import { TextInput } from '@/components/theme/TextInput';
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
} from '@/utils/gym';
import { displayToKg, kgToDisplay } from '@/utils/unitConversion';
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

const STEP_DISPLAY_DECIMALS = 2;
// One decimal is how plates are labelled everywhere (2.5, 1.25 needs two): keep what people type.
const DISPLAY_DECIMALS = 2;
const roundDisplay = (value: number) =>
  Math.round(value * 10 ** DISPLAY_DECIMALS) / 10 ** DISPLAY_DECIMALS;

/**
 * Create or edit a gym profile. The form works in the user's display unit and converts to
 * kilograms once, on save — so a lifter in pounds types "45" and the app stores 20.4117.
 */
export function EditGymModal({ visible, onClose, gym, isFirstGym = false }: EditGymModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units } = useSettings();
  const { locale } = useFormatAppNumber();
  const { showSnackbar } = useSnackbar();
  const unit = t(getWeightUnitI18nKey(units));

  const [name, setName] = useState('');
  const [barDisplay, setBarDisplay] = useState(0);
  const [incrementDisplay, setIncrementDisplay] = useState(0);
  const [plates, setPlates] = useState<PlateRow[]>([]);
  const [newPlateDisplay, setNewPlateDisplay] = useState(5);
  const [equipment, setEquipment] = useState<EquipmentType[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);

  const standardPlates = useMemo(() => defaultPlates(units), [units]);

  // Seed the form each time the modal opens (or switches gym). It is a snapshot on purpose: a
  // subscription would overwrite what the user is typing whenever any gym changes.
  const gymId = gym?.id ?? null;
  useEffect(() => {
    if (!visible) {
      return;
    }
    const seed = () => {
      setName(gym?.name ?? '');
      setBarDisplay(
        roundDisplay(kgToDisplay(gym?.barWeightKg ?? defaultBarWeightKg(units), units))
      );
      setIncrementDisplay(
        roundDisplay(kgToDisplay(gym?.weightIncrementKg ?? defaultWeightIncrementKg(units), units))
      );
      setPlates(
        (gym?.plates ?? standardPlates).map(({ weightKg, count }) => ({ weightKg, count }))
      );
      setEquipment(gym?.equipment ?? [...EQUIPMENT_TYPES]);
      setNewPlateDisplay(units === 'imperial' ? 10 : 5);
    };
    seed();
    // `gym` is read through its id: the object changes identity on every unrelated gym edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, gymId, units]);

  const showKg = (kg: number) => formatDisplayWeightKg(locale, units, kg);

  const setPlateCount = (weightKg: number, count: number) =>
    setPlates((current) =>
      current.map((plate) => (plate.weightKg === weightKg ? { ...plate, count } : plate))
    );

  const addPlate = () => {
    const weightKg = Math.round(displayToKg(newPlateDisplay, units) * 10_000) / 10_000;
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
        barWeightKg: displayToKg(barDisplay, units),
        plates: plates.filter((plate) => plate.count > 0) satisfies GymPlate[],
        weightIncrementKg: displayToKg(incrementDisplay, units),
        equipment,
        weightUnit: units === 'imperial' ? ('lbs' as const) : ('kg' as const),
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

        <View className="gap-3">
          <StepperInput
            label={t('workoutSettings.editGym.bar', { unit })}
            value={barDisplay}
            maxFractionDigits={STEP_DISPLAY_DECIMALS}
            step={units === 'imperial' ? 5 : 2.5}
            unit={unit}
            onChangeValue={(value) => setBarDisplay(Math.max(0, value))}
            onIncrement={() =>
              setBarDisplay((value) => roundDisplay(value + (units === 'imperial' ? 5 : 2.5)))
            }
            onDecrement={() =>
              setBarDisplay((value) =>
                Math.max(0, roundDisplay(value - (units === 'imperial' ? 5 : 2.5)))
              )
            }
          />
          <StepperInput
            label={t('workoutSettings.editGym.increment', { unit })}
            value={incrementDisplay}
            maxFractionDigits={STEP_DISPLAY_DECIMALS}
            unit={unit}
            onChangeValue={(value) => setIncrementDisplay(Math.max(0, value))}
            onIncrement={() => setIncrementDisplay((value) => roundDisplay(value + 0.5))}
            onDecrement={() =>
              setIncrementDisplay((value) => Math.max(0.5, roundDisplay(value - 0.5)))
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
                <Pressable
                  onPress={() => setPlateCount(plate.weightKg, Math.max(0, plate.count - 2))}
                  accessibilityRole="button"
                  accessibilityLabel={t('workoutSettings.editGym.fewerPlates', {
                    weight: showKg(plate.weightKg),
                    unit,
                  })}
                  className="h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: theme.colors.background.cardElevated }}
                >
                  <Text className="text-xl" style={{ color: theme.colors.text.primary }}>
                    −
                  </Text>
                </Pressable>
                <Text
                  className="min-w-[2.5rem] text-center text-lg"
                  style={{ color: theme.colors.text.primary }}
                >
                  {plate.count}
                </Text>
                <Pressable
                  onPress={() => setPlateCount(plate.weightKg, plate.count + 2)}
                  accessibilityRole="button"
                  accessibilityLabel={t('workoutSettings.editGym.morePlates', {
                    weight: showKg(plate.weightKg),
                    unit,
                  })}
                  className="h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: theme.colors.background.cardElevated }}
                >
                  <Plus size={theme.iconSize.md} color={theme.colors.text.primary} />
                </Pressable>
                <Pressable
                  onPress={() =>
                    setPlates((current) =>
                      current.filter((item) => item.weightKg !== plate.weightKg)
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t('workoutSettings.editGym.removePlate', {
                    weight: showKg(plate.weightKg),
                    unit,
                  })}
                  className="h-9 w-9 items-center justify-center"
                >
                  <X size={theme.iconSize.md} color={theme.colors.text.secondary} />
                </Pressable>
              </View>
            </View>
          ))}

          <StepperInput
            label={t('workoutSettings.editGym.plateWeight', { unit })}
            value={newPlateDisplay}
            maxFractionDigits={STEP_DISPLAY_DECIMALS}
            unit={unit}
            onChangeValue={(value) => setNewPlateDisplay(Math.max(0, value))}
            onIncrement={() => setNewPlateDisplay((value) => roundDisplay(value + 0.25))}
            onDecrement={() =>
              setNewPlateDisplay((value) => Math.max(0.25, roundDisplay(value - 0.25)))
            }
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
              onPress={() =>
                setPlates(standardPlates.map(({ weightKg, count }) => ({ weightKg, count })))
              }
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
                <Pressable
                  key={type}
                  onPress={() => toggleEquipment(type)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  className="rounded-full border px-4 py-2"
                  style={{
                    backgroundColor: selected
                      ? theme.colors.accent.primary20
                      : theme.colors.background.card,
                    borderColor: selected ? theme.colors.accent.primary : theme.colors.border.light,
                  }}
                >
                  <Text
                    className="font-medium"
                    style={{
                      color: selected ? theme.colors.accent.primary : theme.colors.text.primary,
                    }}
                  >
                    {t(`exercises.equipmentTypes.${type}`)}
                  </Text>
                </Pressable>
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
