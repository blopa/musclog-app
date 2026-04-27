import { ExternalLink, PersonStanding, ScrollText, Trophy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';

type ChatWorkoutCompletedCardProps = {
  workoutName: string;
  volume: string;
  duration: string;
  personalRecords: number;
  onViewDetails?: () => void;
  onViewMuscles?: () => void;
};

export function ChatWorkoutCompletedCard({
  workoutName,
  volume,
  duration,
  personalRecords,
  onViewDetails,
  onViewMuscles,
}: ChatWorkoutCompletedCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();

  return (
    <View
      className="overflow-hidden rounded-2xl rounded-bl-sm"
      style={{
        backgroundColor: theme.colors.background.card,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.border.light,
        minWidth: theme.size['240'],
      }}
    >
      {/* Header */}
      <View
        className="p-4"
        style={{
          borderBottomWidth: theme.borderWidth.thin,
          borderBottomColor: theme.colors.border.light,
          backgroundColor: theme.colors.background.cardElevated,
        }}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-text-primary text-lg leading-tight font-bold">{workoutName}</Text>
            <View className="mt-1 flex-row items-center gap-1.5">
              <Trophy size={14} color={theme.colors.accent.primary} />
              <Text
                className="text-sm font-semibold"
                style={{ color: theme.colors.accent.primary }}
              >
                {t('workoutSummary.workoutCompleted')}
              </Text>
            </View>
          </View>
          <View
            className="rounded-lg p-2"
            style={{ backgroundColor: theme.colors.status.indigo10 }}
          >
            <ScrollText size={20} color={theme.colors.status.indigo} />
          </View>
        </View>
      </View>

      {/* Stats */}
      <View className="flex-row p-4">
        <View className="flex-1">
          <Text
            className="text-[10px] font-bold tracking-wider uppercase"
            style={{ color: theme.colors.text.tertiary }}
          >
            {t('workoutSummary.volume')}
          </Text>
          <Text className="text-text-primary mt-0.5 text-sm font-bold">{volume}</Text>
        </View>
        <View className="flex-1">
          <Text
            className="text-[10px] font-bold tracking-wider uppercase"
            style={{ color: theme.colors.text.tertiary }}
          >
            {t('workoutSummary.duration')}
          </Text>
          <Text className="text-text-primary mt-0.5 text-sm font-bold">{duration}</Text>
        </View>
        <View className="flex-1">
          <Text
            className="text-[10px] font-bold tracking-wider uppercase"
            style={{ color: theme.colors.text.tertiary }}
          >
            {t('workoutSummary.newPRs')}
          </Text>
          <Text
            className="mt-0.5 text-sm font-bold"
            style={{
              color: personalRecords > 0 ? theme.colors.accent.primary : theme.colors.text.primary,
            }}
          >
            {formatInteger(personalRecords, { useGrouping: false })}
          </Text>
        </View>
      </View>

      {/* Buttons */}
      {onViewDetails || onViewMuscles ? (
        <View className="gap-2 px-4 pb-4">
          {onViewDetails ? (
            <Pressable
              onPress={onViewDetails}
              className="w-full flex-row items-center justify-center gap-2 rounded-lg py-2.5 active:scale-95"
              style={{
                backgroundColor: theme.colors.background.primary,
                borderWidth: theme.borderWidth.thin,
                borderColor: theme.colors.border.light,
              }}
            >
              <Text className="text-text-primary text-sm font-bold">
                {t('workoutSummary.viewDetails')}
              </Text>
              <ExternalLink size={14} color={theme.colors.text.primary} />
            </Pressable>
          ) : null}
          {onViewMuscles ? (
            <Pressable
              onPress={onViewMuscles}
              className="w-full flex-row items-center justify-center gap-2 rounded-lg py-2.5 active:scale-95"
              style={{
                backgroundColor: theme.colors.accent.primary10,
                borderWidth: theme.borderWidth.thin,
                borderColor: theme.colors.accent.primary + '33',
              }}
            >
              <Text className="text-sm font-bold" style={{ color: theme.colors.accent.primary }}>
                {t('workoutSummary.viewMuscles')}
              </Text>
              <PersonStanding size={14} color={theme.colors.accent.primary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
