import { Flame, MoreHorizontal, NotebookPen, Repeat } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, Text } from 'react-native';

import type Exercise from '@/database/models/Exercise';
import { useExerciseImageSource } from '@/hooks/useExerciseImageSource';
import { useTheme } from '@/hooks/useTheme';
import {
  getExerciseTypeTranslationKey,
  getMuscleGroupTranslationKey,
} from '@/utils/exerciseTranslation';

export type SessionExerciseAction = 'warmup' | 'swap' | 'notes' | 'more';

/** "Chest • Barbell" — the same line the guided hero has always shown under the name. */
export function useExerciseCategory(exercise: Exercise | undefined) {
  const { t } = useTranslation();
  if (!exercise) {
    return '';
  }
  const parts: string[] = [];
  if (exercise.muscleGroup) {
    parts.push(t(getMuscleGroupTranslationKey(exercise.muscleGroup)));
  }
  if (exercise.equipmentType) {
    parts.push(t(getExerciseTypeTranslationKey(exercise.equipmentType)));
  }
  return parts.join(' • ');
}

export function ExerciseThumbnail({ exercise, size = 52 }: { exercise: Exercise; size?: number }) {
  const theme = useTheme();
  const source = useExerciseImageSource(exercise.imageUrl);
  return (
    <Image
      source={source}
      accessibilityIgnoresInvertColors
      style={{
        width: size,
        height: size,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.background.cardElevated,
      }}
    />
  );
}

/**
 * The labelled actions beside an exercise heading. Labels stay visible: an icon-only row hid the
 * warm-up and swap features in the first version of this screen.
 */
export function ExerciseActionChips({
  warmup,
  onAction,
  disabled,
}: {
  /** What the warm-up chip does now: add a ramp, remove planned warm-ups, or nothing to offer. */
  warmup: 'add' | 'remove' | null;
  onAction: (action: SessionExerciseAction) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const chips: {
    action: SessionExerciseAction;
    label: string;
    icon: typeof Flame;
    enabled: boolean;
  }[] = [
    {
      action: 'warmup',
      label: t(warmup === 'remove' ? 'trainingFlow.removeWarmups' : 'trainingFlow.actions.warmup'),
      icon: Flame,
      enabled: warmup != null,
    },
    { action: 'swap', label: t('trainingFlow.actions.swap'), icon: Repeat, enabled: true },
    { action: 'notes', label: t('trainingFlow.actions.notes'), icon: NotebookPen, enabled: true },
    { action: 'more', label: t('trainingFlow.actions.more'), icon: MoreHorizontal, enabled: true },
  ];
  return (
    // One row that scrolls sideways rather than wrapping: wrapped, "More" fell onto a second line
    // and the four chips took more height than the set they sit above.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
      style={{ flexGrow: 0 }}
    >
      {chips.map(({ action, label, icon: Icon, enabled }) => {
        const isDisabled = disabled || !enabled;
        return (
          <Pressable
            key={action}
            accessibilityRole="button"
            accessibilityState={{ disabled: isDisabled }}
            disabled={isDisabled}
            onPress={() => onAction(action)}
            className="min-h-11 flex-row items-center gap-1.5 rounded-full bg-bg-overlay px-3"
          >
            <Icon
              size={theme.iconSize.sm}
              color={isDisabled ? theme.colors.text.tertiary : theme.colors.text.secondary}
            />
            <Text
              className={`text-sm font-medium ${isDisabled ? 'text-text-tertiary' : 'text-text-primary'}`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
