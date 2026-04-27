import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Body, { Slug as BodySlug } from 'react-native-body-highlighter';

import { useTheme } from '@/hooks/useTheme';
import { buildSlugIntensityMap } from '@/utils/muscleGroupMapping';

type BodyHighlighterProps = {
  muscleGroups: (string | null | undefined)[];
};

export default function BodyHighlighter({ muscleGroups }: BodyHighlighterProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const intensityMap = buildSlugIntensityMap(muscleGroups);

  if (intensityMap.size === 0) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <Text className="text-sm text-text-tertiary">{t('workoutDetail.noMuscleData')}</Text>
      </View>
    );
  }

  const data = Array.from(intensityMap.entries()).map(([slug, count]) => ({
    slug: slug as BodySlug,
    intensity: Math.min(count, 3) as 1 | 2 | 3,
  }));

  const colors: readonly string[] = [
    theme.colors.accent.primary + '55',
    theme.colors.accent.primary + '99',
    theme.colors.accent.primary,
  ];

  return (
    <View className="flex-row items-start justify-center gap-6 py-4">
      <View className="items-center gap-2">
        <Text
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: theme.colors.text.tertiary }}
        >
          {t('workoutDetail.frontMuscles')}
        </Text>
        <Body data={data} side="front" scale={0.95} colors={colors} border="none" />
      </View>
      <View className="items-center gap-2">
        <Text
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: theme.colors.text.tertiary }}
        >
          {t('workoutDetail.backMuscles')}
        </Text>
        <Body data={data} side="back" scale={0.95} colors={colors} border="none" />
      </View>
    </View>
  );
}
