import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import {
  BACK_SLUGS,
  buildSlugIntensityMap,
  FRONT_SLUGS,
  MuscleSlug,
  SLUG_TO_LABEL,
} from '@/utils/muscleGroupMapping';

type BodyHighlighterProps = {
  muscleGroups: (string | null | undefined)[];
};

function MuscleChip({ slug, intensity }: { slug: MuscleSlug; intensity: number }) {
  const theme = useTheme();
  const alpha = intensity >= 3 ? '' : intensity === 2 ? '99' : '55';
  const bgColor = theme.colors.accent.primary + alpha;

  return (
    <View className="mb-2 mr-2 rounded-full px-3 py-1.5" style={{ backgroundColor: bgColor }}>
      <Text className="text-xs font-semibold text-white">{SLUG_TO_LABEL[slug]}</Text>
    </View>
  );
}

function MuscleSection({
  title,
  muscles,
}: {
  title: string;
  muscles: { slug: MuscleSlug; intensity: number }[];
}) {
  const theme = useTheme();

  if (muscles.length === 0) {
    return null;
  }

  return (
    <View className="mb-4">
      <Text
        className="mb-2 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: theme.colors.text.tertiary }}
      >
        {title}
      </Text>
      <View className="flex-row flex-wrap">
        {muscles.map(({ slug, intensity }) => (
          <MuscleChip key={slug} slug={slug} intensity={intensity} />
        ))}
      </View>
    </View>
  );
}

export default function BodyHighlighter({ muscleGroups }: BodyHighlighterProps) {
  const { t } = useTranslation();
  const intensityMap = buildSlugIntensityMap(muscleGroups);

  const frontMuscles: { slug: MuscleSlug; intensity: number }[] = [];
  const backMuscles: { slug: MuscleSlug; intensity: number }[] = [];

  for (const [slug, intensity] of intensityMap.entries()) {
    const entry = { slug, intensity };
    if (FRONT_SLUGS.has(slug)) {
      frontMuscles.push(entry);
    }
    if (BACK_SLUGS.has(slug)) {
      backMuscles.push(entry);
    }
  }

  if (intensityMap.size === 0) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <Text className="text-sm text-text-tertiary">{t('workoutDetail.noMuscleData')}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 py-2">
      <MuscleSection title={t('workoutDetail.frontMuscles')} muscles={frontMuscles} />
      <MuscleSection title={t('workoutDetail.backMuscles')} muscles={backMuscles} />
    </View>
  );
}
