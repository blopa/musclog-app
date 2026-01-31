import React from 'react';
import { View, Text } from 'react-native';
import { Button } from '../../theme/Button';
import { theme } from '../../../theme';
import { useTranslation } from 'react-i18next';
import { GenericCard } from '../GenericCard';

interface DailySummaryEmptyStateProps {
  onSetGoals?: () => void;
}

export const DailySummaryEmptyState: React.FC<DailySummaryEmptyStateProps> = ({ onSetGoals }) => {
  const { t } = useTranslation();

  return (
    <GenericCard variant="default" size="lg" backgroundVariant="colorful-gradient">
      <View className="relative z-10 flex h-full flex-col gap-4 p-5">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <Text
            className="font-medium uppercase tracking-wider"
            style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.overlay.white70,
            }}
          >
            {t('dailySummaryCard.dailySummary', 'Daily Summary')}
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
            label={t('dailySummaryCard.setGoals', 'Set Goals')}
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
