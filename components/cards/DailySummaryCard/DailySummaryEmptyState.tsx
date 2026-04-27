import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';

interface DailySummaryEmptyStateProps {
  onSetGoals?: () => void;
}

export const DailySummaryEmptyState: FC<DailySummaryEmptyStateProps> = ({ onSetGoals }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <GenericCard variant="default" size="lg" backgroundVariant="colorful-gradient">
      <View className="relative z-10 flex h-full flex-col gap-4 p-5">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <Text
            className="font-medium tracking-wider uppercase"
            style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.overlay.white70,
            }}
          >
            {t('dailySummaryCard.dailySummary')}
          </Text>
        </View>

        {/* Center content */}
        <View className="flex flex-1 flex-col items-center justify-center gap-4 py-1">
          <Text
            className="text-center text-sm font-medium"
            style={{ color: theme.colors.overlay.white70 }}
          >
            {t('dailySummaryCard.setGoalsToTrack')}
          </Text>

          <Button
            label={t('dailySummaryCard.setGoals')}
            variant="accent"
            size="sm"
            width="full"
            onPress={onSetGoals}
          />
        </View>
      </View>
    </GenericCard>
  );
};
