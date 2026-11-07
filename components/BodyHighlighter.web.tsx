import Body from '@mjcdev/react-body-highlighter';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { bodyFigureScale } from '@/utils/bodyFigureScale';
import { buildSlugIntensityMap, type MuscleSlug } from '@/utils/muscleGroupMapping';

type BodyHighlighterProps = {
  /** Exercise muscle groups; each hit shades its slugs. Ignored when `slugIntensities` is given. */
  muscleGroups?: (string | null | undefined)[];
  /** Ready-made shading per slug (1 to 3). Replaces the `muscleGroups` derivation when given. */
  slugIntensities?: ReadonlyMap<MuscleSlug, number>;
  onMusclePress?: (slug: MuscleSlug) => void;
  /** Figure size; a card narrower than the screen needs it below the default. */
  scale?: number;
};

/** The `gap-8` between the front and back figures. */
const FIGURE_GAP = 32;

export default function BodyHighlighter({
  muscleGroups = [],
  slugIntensities,
  onMusclePress,
  scale = 1,
}: BodyHighlighterProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const intensityMap = slugIntensities ?? buildSlugIntensityMap(muscleGroups);
  const [width, setWidth] = useState<number | null>(null);
  // The two figures are 200 wide each at scale 1, wider than a phone: they were shrunk by the
  // layout and cut off, so the scale follows the room the pair actually has.
  const figureScale = bodyFigureScale(width, scale, FIGURE_GAP);

  if (intensityMap.size === 0) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <Text className="text-sm text-text-tertiary">{t('workoutDetail.noMuscleData')}</Text>
      </View>
    );
  }

  const data = Array.from(intensityMap.entries()).map(([slug, count]) => ({
    slug: slug as any,
    intensity: Math.min(count, 3) as 1 | 2 | 3,
  }));

  const colors: readonly string[] = [
    theme.colors.accent.primary + '55',
    theme.colors.accent.primary + '99',
    theme.colors.accent.primary,
  ];

  const handleClick = onMusclePress
    ? (part: { slug?: string }) => {
        if (part.slug) {
          onMusclePress(part.slug as MuscleSlug);
        }
      }
    : undefined;

  return (
    <View
      className="flex-row items-start justify-center gap-8 py-4"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View className="items-center gap-2">
        <Text className="text-xs font-semibold" style={{ color: theme.colors.text.tertiary }}>
          {t('workoutDetail.frontMuscles')}
        </Text>
        <Body
          data={data}
          side="front"
          scale={figureScale}
          colors={colors}
          border="none"
          onBodyPartClick={handleClick}
        />
      </View>
      <View className="items-center gap-2">
        <Text className="text-xs font-semibold" style={{ color: theme.colors.text.tertiary }}>
          {t('workoutDetail.backMuscles')}
        </Text>
        <Body
          data={data}
          side="back"
          scale={figureScale}
          colors={colors}
          border="none"
          onBodyPartClick={handleClick}
        />
      </View>
    </View>
  );
}
