import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import BodyHighlighter from '@/components/BodyHighlighter';
import { SpiderChart } from '@/components/charts/SpiderChart';
import { useTheme } from '@/hooks/useTheme';
import { buildSlugIntensityMap, MuscleSlug } from '@/utils/muscleGroupMapping';

type WorkoutMusclesDetailsProps = {
  muscleGroups: (string | null | undefined)[];
};

const SPIDER_REGIONS: { key: string; slugs: MuscleSlug[] }[] = [
  { key: 'chest', slugs: ['chest'] },
  { key: 'back', slugs: ['upper-back', 'lower-back', 'trapezius'] },
  { key: 'shoulders', slugs: ['deltoids'] },
  { key: 'arms', slugs: ['biceps', 'triceps', 'forearm'] },
  { key: 'core', slugs: ['abs', 'obliques'] },
  { key: 'legs', slugs: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductors'] },
];

export function WorkoutMusclesDetails({ muscleGroups }: WorkoutMusclesDetailsProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const intensityMap = buildSlugIntensityMap(muscleGroups);
  const hasData = intensityMap.size > 0;

  const regionScores = SPIDER_REGIONS.map(({ key, slugs }) => ({
    key,
    score: slugs.reduce((sum, slug) => sum + (intensityMap.get(slug) ?? 0), 0),
  }));

  const maxScore = Math.max(...regionScores.map((r) => r.score), 1);
  const spiderValues = regionScores.map((r) => Math.round((r.score / maxScore) * 100));
  const spiderAxes = SPIDER_REGIONS.map(({ key }) => t(`workoutDetail.region_${key}`));

  const activeRegions = regionScores.filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
  const primaryFocus = activeRegions[0]
    ? t(`workoutDetail.region_${activeRegions[0].key}`)
    : undefined;
  const areaToImprove =
    activeRegions.length > 1
      ? t(`workoutDetail.region_${activeRegions[activeRegions.length - 1].key}`)
      : undefined;

  const totalMuscles = intensityMap.size;

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="p-4">
        {hasData ? (
          <>
            <Text className="mb-1 text-center text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
              {t('workoutDetail.muscleBalance')}
            </Text>
            <View pointerEvents="none" style={{ height: theme.spacing.padding.base }} />
            <SpiderChart
              axes={spiderAxes}
              values={spiderValues}
              primaryFocus={primaryFocus}
              areaToImprove={areaToImprove}
              size={260}
              className="mb-2"
            />
            <View className="mb-4 items-center">
              <View className="bg-background-secondary rounded-full px-4 py-1.5">
                <Text className="text-xs font-semibold text-text-secondary">
                  {t('workoutDetail.musclesTargeted', { count: totalMuscles })}
                </Text>
              </View>
            </View>
            <View className="mb-4 h-px bg-border-default" />
          </>
        ) : null}
        <BodyHighlighter muscleGroups={muscleGroups} />
      </View>
    </ScrollView>
  );
}
