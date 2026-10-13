import { LinearGradient } from 'expo-linear-gradient';
import { Flame, MoreHorizontal, NotebookPen, Repeat } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, View } from 'react-native';

import { Chip } from '@/components/theme/Chip';
import { useSurfaceColor } from '@/context/SurfaceColorContext';
import type Exercise from '@/database/models/Exercise';
import { useExerciseImageSource } from '@/hooks/useExerciseImageSource';
import { useTheme } from '@/hooks/useTheme';
import {
  getExerciseTypeTranslationKey,
  getMuscleGroupTranslationKey,
} from '@/utils/exerciseTranslation';

import { hidesContentToTheRight } from './scrollOverflow';

/** Width of the edge fade that signals more chips past the right edge. */
const EDGE_FADE_WIDTH = 32;

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
  canSwap,
}: {
  /** What the warm-up chip does now: add a ramp, remove planned warm-ups, or nothing to offer. */
  warmup: 'add' | 'remove' | null;
  onAction: (action: SessionExerciseAction) => void;
  disabled?: boolean;
  canSwap: boolean;
}) {
  const { t } = useTranslation();
  const surface = useSurfaceColor();
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const moreToTheRight = hidesContentToTheRight(viewportWidth, contentWidth, offsetX);
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
    { action: 'swap', label: t('trainingFlow.actions.swap'), icon: Repeat, enabled: canSwap },
    { action: 'notes', label: t('trainingFlow.actions.notes'), icon: NotebookPen, enabled: true },
    { action: 'more', label: t('trainingFlow.actions.more'), icon: MoreHorizontal, enabled: true },
  ];
  return (
    // One row that scrolls sideways rather than wrapping: wrapped, "More" fell onto a second line
    // and the four chips took more height than the set they sit above. Because a cut-off chip
    // alone does not say "this scrolls", an edge fade shows while chips are hidden to the right.
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        style={{ flexGrow: 0 }}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContentWidth(width)}
        onScroll={(event) => setOffsetX(event.nativeEvent.contentOffset.x)}
        scrollEventThrottle={32}
      >
        {chips.map(({ action, label, icon: Icon, enabled }) => {
          const isDisabled = disabled || !enabled;
          return (
            <Chip
              key={action}
              variant="solid"
              role="button"
              icon={Icon}
              label={label}
              disabled={isDisabled}
              onPress={() => onAction(action)}
            />
          );
        })}
      </ScrollView>
      {moreToTheRight ? (
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: EDGE_FADE_WIDTH }}
          testID="exercise-actions-more"
        />
      ) : null}
    </View>
  );
}
