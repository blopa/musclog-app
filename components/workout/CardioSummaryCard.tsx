import { Footprints, Zap } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { CardioActivity } from '@/utils/cardioEnergy';

type CardioSummaryCardProps = {
  activity: CardioActivity;
  /** Already formatted, with its unit ("5.2 km"). */
  distance: string;
  /** Already formatted ("5:30 /km"), or null when the session has no pace. */
  pace: string | null;
};

/**
 * What a logged walk or run is about. It has no sets, so the exercise list is empty and this card
 * is where its distance and pace live — the detail view must not read as a workout with nothing in it.
 */
export function CardioSummaryCard({ activity, distance, pace }: CardioSummaryCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const Icon = activity === 'run' ? Zap : Footprints;

  return (
    <View
      className="flex-row items-center gap-4 rounded-xl p-4"
      style={{ backgroundColor: theme.colors.background.ink5 }}
      testID="cardio-summary"
    >
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: theme.colors.accent.primary10 }}
      >
        <Icon size={theme.iconSize.lg} color={theme.colors.accent.primary} />
      </View>
      <View className="flex-1 flex-row justify-between">
        <View>
          <Text className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
            {t('cardio.distance')}
          </Text>
          <Text className="text-2xl font-bold text-text-primary">{distance}</Text>
        </View>
        {pace ? (
          <View className="items-end">
            <Text className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
              {t('cardio.pace')}
            </Text>
            <Text className="text-2xl font-bold text-text-primary">{pace}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
