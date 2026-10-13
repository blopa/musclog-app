import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import type { Units } from '@/constants/settings';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { formatDisplayPlateWeightKg } from '@/utils/formatDisplayWeight';
import { defaultBarWeightKg, defaultPlates, type GymSnapshot } from '@/utils/gym';
import { platesPerSide } from '@/utils/plateCalculator';
import { getWeightUnitI18nKey } from '@/utils/units';

type PlateCalculatorSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The weight to load, in kg like every stored weight. */
  targetKg: number;
  /** The gym being trained in. Without one, the standard plates for the user's unit system apply. */
  gym: GymSnapshot | null;
  units: Units;
};

const MIN_PLATE_HEIGHT = 36;
const PLATE_HEIGHT_RANGE = 60;
const PLATE_WIDTH = 14;
// Below this a "remainder" is rounding noise from storing 45 lb as 20.4117 kg, not a real shortfall.
const REMAINDER_NOISE_KG = 0.05;

/**
 * Shows what to put on each side of the bar for a target weight. The bar and plates come from the
 * active gym; a user who never set one up gets the standard set, so the calculator works out of the
 * box and says it is using defaults.
 */
export function PlateCalculatorSheet({
  visible,
  onClose,
  targetKg,
  gym,
  units,
}: PlateCalculatorSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { locale } = useFormatAppNumber();

  const loading = useMemo(
    () =>
      gym ?? {
        barWeightKg: defaultBarWeightKg(units),
        plates: defaultPlates(units),
      },
    [gym, units]
  );
  const load = useMemo(() => platesPerSide(targetKg, loading), [targetKg, loading]);

  const unit = t(getWeightUnitI18nKey(units));
  // Plate maths deals in quarter steps; a 1.25 kg plate must not read as 1.3.
  const show = (kg: number) => formatDisplayPlateWeightKg(locale, units, kg);
  const heaviestPlateKg = Math.max(...loading.plates.map((plate) => plate.weightKg), 1);
  const shortByKg = load.remainderKg;
  const isExact = !load.belowBar && Math.abs(shortByKg) < REMAINDER_NOISE_KG;
  const isBarOnly = !load.belowBar && load.platesPerSide.length === 0;
  const hasPlates = !load.belowBar && load.platesPerSide.length > 0;

  return (
    <BottomPopUp
      visible={visible}
      onClose={onClose}
      title={t('workoutSettings.plateCalculator.title')}
      subtitle={t('workoutSettings.plateCalculator.subtitle', {
        weight: show(targetKg),
        unit,
      })}
    >
      <View className="gap-5 pb-4" testID="plate-calculator">
        {load.belowBar ? (
          <Text style={{ color: theme.colors.text.secondary }}>
            {t('workoutSettings.plateCalculator.belowBar', {
              bar: show(loading.barWeightKg),
              unit,
            })}
          </Text>
        ) : null}
        {isBarOnly ? (
          <Text style={{ color: theme.colors.text.secondary }}>
            {t('workoutSettings.plateCalculator.barOnly')}
          </Text>
        ) : null}
        {hasPlates ? (
          <View className="gap-3">
            <Text
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: theme.colors.text.secondary }}
            >
              {t('workoutSettings.plateCalculator.perSide')}
            </Text>
            <View
              className="flex-row items-center justify-start gap-1"
              style={{ minHeight: MIN_PLATE_HEIGHT + PLATE_HEIGHT_RANGE }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {load.platesPerSide.flatMap((plate) =>
                Array.from({ length: plate.count }, (_, index) => (
                  <View
                    key={`${plate.weightKg}-${index}`}
                    style={{
                      width: PLATE_WIDTH,
                      height:
                        MIN_PLATE_HEIGHT +
                        PLATE_HEIGHT_RANGE * Math.min(1, plate.weightKg / heaviestPlateKg),
                      borderRadius: theme.borderRadius.sm,
                      backgroundColor: theme.colors.accent.primary,
                    }}
                  />
                ))
              )}
            </View>
            <View className="gap-2">
              {load.platesPerSide.map((plate) => (
                <View
                  key={plate.weightKg}
                  className="flex-row items-center justify-between rounded-lg px-4 py-3"
                  style={{ backgroundColor: theme.colors.background.card }}
                >
                  <Text className="text-lg font-bold" style={{ color: theme.colors.text.primary }}>
                    {t('workoutSettings.plateCalculator.plateLine', {
                      weight: show(plate.weightKg),
                      unit,
                    })}
                  </Text>
                  <Text className="text-lg" style={{ color: theme.colors.text.secondary }}>
                    × {plate.count}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View
          className="flex-row items-center justify-between rounded-lg px-4 py-3"
          style={{ backgroundColor: theme.colors.background.card }}
        >
          <Text style={{ color: theme.colors.text.secondary }}>
            {t('workoutSettings.plateCalculator.bar')}
          </Text>
          <Text className="font-bold" style={{ color: theme.colors.text.primary }}>
            {show(loading.barWeightKg)} {unit}
          </Text>
        </View>

        {load.belowBar ? null : (
          <Text
            className="text-base font-semibold"
            style={{ color: isExact ? theme.colors.status.success : theme.colors.status.warning }}
          >
            {isExact
              ? t('workoutSettings.plateCalculator.exact', { weight: show(load.loadedKg), unit })
              : t('workoutSettings.plateCalculator.closest', {
                  weight: show(load.loadedKg),
                  unit,
                  short: show(Math.abs(shortByKg)),
                })}
          </Text>
        )}

        {gym ? null : (
          <Text className="text-sm" style={{ color: theme.colors.text.tertiary }}>
            {t('workoutSettings.plateCalculator.defaultsHint')}
          </Text>
        )}
      </View>
    </BottomPopUp>
  );
}
