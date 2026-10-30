import { Dumbbell, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { Button } from '@/components/theme/Button';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import { StepperInput } from '@/components/theme/StepperInput';
import { TextButton } from '@/components/theme/TextButton';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { RESTRICTION_KIND_LABEL_KEYS } from '@/components/workout/restrictionLabelKeys';
import {
  DEFAULT_REST_SECONDS,
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
  REST_SECONDS_STEP,
} from '@/constants/restTimer';
import { SETTINGS } from '@/constants/settingDefinitions';
import { REST_HEADS_UP_OPTIONS, type RestHeadsUpSeconds } from '@/constants/settings';
import type ExerciseRestriction from '@/database/models/ExerciseRestriction';
import { ExerciseRestrictionService } from '@/database/services/ExerciseRestrictionService';
import { ExerciseService } from '@/database/services/ExerciseService';
import { GymService } from '@/database/services/GymService';
import { SettingsService } from '@/database/services/SettingsService';
import { useActiveGym } from '@/hooks/useActiveGym';
import { useExerciseRestrictions } from '@/hooks/useExerciseRestrictions';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';
import { isRestrictionActive } from '@/utils/exerciseSubstitution';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import type { GymSnapshot } from '@/utils/gym';
import { getWeightUnitI18nKey } from '@/utils/units';

import { EditGymModal } from './EditGymModal';
import { FullScreenModal } from './FullScreenModal';

type WorkoutSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

function RestrictionRow({ row }: { row: ExerciseRestriction }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { locale } = useFormatAppNumber();
  const [name, setName] = useState('');
  // Read once per row: render must be pure, and "healed" does not need to flip while this is open.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    ExerciseService.getExerciseById(row.exerciseId)
      .then((exercise) => {
        if (!cancelled) {
          setName(exercise?.name ?? '');
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [row.exerciseId]);

  const active = isRestrictionActive(
    { exerciseId: row.exerciseId, kind: row.kind, expiresAt: row.expiresAt ?? null },
    now
  );
  let detail: string | null = null;
  if (row.kind === 'injury' && row.expiresAt) {
    detail = active
      ? t('workoutSettings.restrictions.until', {
          date: new Date(row.expiresAt).toLocaleDateString(locale, {
            month: 'short',
            day: 'numeric',
          }),
        })
      : t('workoutSettings.restrictions.healed');
  }

  return (
    <View
      className="flex-row items-center justify-between gap-3 rounded-control px-4 py-3"
      style={{ backgroundColor: theme.colors.background.card, opacity: active ? 1 : 0.6 }}
    >
      <View className="flex-1">
        <Text
          className="font-semibold"
          style={{ color: theme.colors.text.primary }}
          numberOfLines={1}
        >
          {name || t('exercises.manageExerciseData.unknownExercise')}
        </Text>
        <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
          {t(RESTRICTION_KIND_LABEL_KEYS[row.kind])}
          {detail ? ` · ${detail}` : ''}
        </Text>
      </View>
      <Button
        label={t('workoutSettings.restrictions.clear')}
        variant="outline"
        size="xs"
        width="auto"
        onPress={() => void ExerciseRestrictionService.clear(row.exerciseId)}
      />
    </View>
  );
}

/**
 * Workout preferences that outlive a single session: the gyms the user trains in and the exercises
 * they never want suggested.
 */
export function WorkoutSettingsModal({ visible, onClose }: WorkoutSettingsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const {
    units,
    workoutAutonomy,
    autoStartRestTimer,
    restTimerHaptics,
    restAlertSound,
    restHapticStrength,
    restHeadsUpSeconds,
    defaultRestSeconds,
  } = useSettings();
  const { locale } = useFormatAppNumber();
  const { gym: activeGym, gyms } = useActiveGym();
  const { rows: restrictionRows } = useExerciseRestrictions();
  const [editingGym, setEditingGym] = useState<GymSnapshot | null>(null);
  const [isEditorVisible, setIsEditorVisible] = useSubModalVisibility(visible);

  const unit = t(getWeightUnitI18nKey(units));

  const openEditor = (gym: GymSnapshot | null) => {
    setEditingGym(gym);
    setIsEditorVisible(true);
  };

  const sectionHeader = (title: string, subtitle: string) => (
    <View className="gap-1">
      <Text className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
        {title}
      </Text>
      <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
        {subtitle}
      </Text>
    </View>
  );

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('workoutSettings.title')}>
      <View className="gap-8 px-4 pb-10 pt-4" testID="workout-settings">
        <View className="gap-4" testID="workout-start-settings">
          {sectionHeader(
            t('workoutSettings.autonomy.title'),
            t('workoutSettings.autonomy.subtitle')
          )}
          <ToggleInput
            items={[
              {
                key: 'suggest',
                label: t('workoutSettings.autonomy.suggest'),
                subtitle: t('workoutSettings.autonomy.suggestHint'),
                value: workoutAutonomy === 'suggest',
                onValueChange: (value) =>
                  void SettingsService.set(SETTINGS.workoutAutonomy, value ? 'suggest' : 'manual'),
              },
            ]}
          />
        </View>

        <View className="gap-4" testID="rest-timer-settings">
          {sectionHeader(
            t('workoutSettings.restTimer.title'),
            t('workoutSettings.restTimer.subtitle')
          )}
          <ToggleInput
            items={[
              {
                key: 'autoStart',
                label: t('workoutSettings.restTimer.autoStart'),
                subtitle: t('workoutSettings.restTimer.autoStartHint'),
                value: autoStartRestTimer,
                onValueChange: (value) =>
                  void SettingsService.set(SETTINGS.autoStartRestTimer, value),
              },
              {
                key: 'haptics',
                label: t('workoutSettings.restTimer.haptics'),
                subtitle: t('workoutSettings.restTimer.hapticsHint'),
                value: restTimerHaptics,
                onValueChange: (value) =>
                  void SettingsService.set(SETTINGS.restTimerHaptics, value),
              },
              {
                key: 'strongHaptics',
                label: t('workoutSettings.restTimer.strongHaptics'),
                subtitle: t('workoutSettings.restTimer.strongHapticsHint'),
                value: restHapticStrength === 'strong',
                disabled: !restTimerHaptics,
                onValueChange: (value) =>
                  void SettingsService.set(
                    SETTINGS.restHapticStrength,
                    value ? 'strong' : 'standard'
                  ),
              },
              {
                key: 'alertSound',
                label: t('workoutSettings.restTimer.alertSound'),
                subtitle: t('workoutSettings.restTimer.alertSoundHint'),
                value: restAlertSound === 'on',
                onValueChange: (value) =>
                  void SettingsService.set(SETTINGS.restAlertSound, value ? 'on' : 'off'),
              },
            ]}
          />
          <View className="gap-2">
            <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
              {t('workoutSettings.restTimer.headsUp')}
            </Text>
            <SegmentedControl
              variant="pill"
              fullWidth
              value={String(restHeadsUpSeconds)}
              onValueChange={(value) =>
                void SettingsService.set(
                  SETTINGS.restHeadsUpSeconds,
                  Number(value) as RestHeadsUpSeconds
                )
              }
              options={REST_HEADS_UP_OPTIONS.map((seconds) => ({
                value: String(seconds),
                label:
                  seconds === 0
                    ? t('workoutSettings.restTimer.headsUpOff')
                    : t('workoutSettings.restTimer.headsUpSeconds', { seconds }),
              }))}
            />
            <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
              {t('workoutSettings.restTimer.headsUpHint')}
            </Text>
          </View>
          <StepperInput
            label={t('workoutSettings.restTimer.defaultRest')}
            value={defaultRestSeconds ?? DEFAULT_REST_SECONDS}
            maxFractionDigits={0}
            unit={t('workoutSettings.restTimer.seconds')}
            onIncrement={() =>
              void SettingsService.set(
                SETTINGS.defaultRestSeconds,
                Math.min(MAX_REST_SECONDS, defaultRestSeconds + REST_SECONDS_STEP)
              )
            }
            onDecrement={() =>
              void SettingsService.set(
                SETTINGS.defaultRestSeconds,
                Math.max(MIN_REST_SECONDS, defaultRestSeconds - REST_SECONDS_STEP)
              )
            }
          />
          <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
            {t('workoutSettings.restTimer.defaultRestHint')}
          </Text>
        </View>

        <View className="gap-4">
          {sectionHeader(t('workoutSettings.gyms.title'), t('workoutSettings.gyms.subtitle'))}

          {gyms.length === 0 ? (
            <GenericCard variant="flat">
              <View className="items-center gap-2 p-6">
                <Dumbbell size={theme.iconSize.xl} color={theme.colors.text.secondary} />
                <Text className="font-semibold" style={{ color: theme.colors.text.primary }}>
                  {t('workoutSettings.gyms.empty')}
                </Text>
                <Text
                  className="text-center text-sm"
                  style={{ color: theme.colors.text.secondary }}
                >
                  {t('workoutSettings.gyms.emptyHint')}
                </Text>
              </View>
            </GenericCard>
          ) : (
            gyms.map((gym) => {
              const isActive = activeGym?.id === gym.id;
              return (
                <GenericCard
                  key={gym.id}
                  variant="flat"
                  isPressable
                  onPress={() => openEditor(gym)}
                >
                  <View className="gap-3 p-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text
                        className="flex-1 text-lg font-semibold"
                        style={{ color: theme.colors.text.primary }}
                        numberOfLines={1}
                      >
                        {gym.name}
                      </Text>
                      {isActive ? (
                        <View
                          className="rounded-tag px-3 py-1"
                          style={{ backgroundColor: theme.colors.accent.primary20 }}
                        >
                          <Text
                            className="text-xs font-semibold"
                            style={{ color: theme.colors.accent.primary }}
                          >
                            {t('workoutSettings.gyms.active')}
                          </Text>
                        </View>
                      ) : (
                        <Button
                          label={t('workoutSettings.gyms.makeActive')}
                          variant="outline"
                          size="xs"
                          width="auto"
                          onPress={() => void GymService.setActiveGym(gym.id)}
                        />
                      )}
                    </View>
                    <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
                      {t('workoutSettings.gyms.summary', {
                        bar: formatDisplayWeightKg(locale, units, gym.barWeightKg),
                        unit,
                        plates: gym.plates.length,
                        equipment: gym.equipment.length,
                      })}
                    </Text>
                  </View>
                </GenericCard>
              );
            })
          )}

          <Button
            label={t('workoutSettings.gyms.add')}
            icon={Plus}
            variant="secondary"
            size="sm"
            width="full"
            onPress={() => openEditor(null)}
          />
          {activeGym ? (
            <TextButton
              tone="muted"
              align="center"
              label={t('workoutSettings.gyms.noGym')}
              onPress={() => void GymService.setActiveGym(null).catch(() => {})}
            />
          ) : null}
        </View>

        <View className="gap-4">
          {sectionHeader(
            t('workoutSettings.restrictions.title'),
            t('workoutSettings.restrictions.subtitle')
          )}
          {restrictionRows.length === 0 ? (
            <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
              {t('workoutSettings.restrictions.empty')}
            </Text>
          ) : (
            <View className="gap-2">
              {restrictionRows.map((row) => (
                <RestrictionRow key={row.id} row={row} />
              ))}
            </View>
          )}
        </View>
      </View>

      {isEditorVisible ? (
        <EditGymModal
          visible={isEditorVisible}
          onClose={() => setIsEditorVisible(false)}
          gym={editingGym}
          isFirstGym={gyms.length === 0}
        />
      ) : null}
    </FullScreenModal>
  );
}
