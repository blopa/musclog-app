import React from 'react';
import { Calendar, Clock, Trophy, ArrowUpDown, Filter } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { BottomPopUpMenu, BottomPopUpMenuItem } from '../BottomPopUpMenu';

type PastWorkoutsHistoryFilterMenuProps = {
  visible: boolean;
  onClose: () => void;
  onDateRangeFilter?: () => void;
  onSortFilter?: () => void;
  onPRsOnlyFilter?: () => void;
  onWorkoutTypeFilter?: () => void;
  onClearFilters?: () => void;
};

export function PastWorkoutsHistoryFilterMenu({
  visible,
  onClose,
  onDateRangeFilter,
  onSortFilter,
  onPRsOnlyFilter,
  onWorkoutTypeFilter,
  onClearFilters,
}: PastWorkoutsHistoryFilterMenuProps) {
  const { t } = useTranslation();

  const items: BottomPopUpMenuItem[] = [
    {
      icon: Calendar,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.text.primary20,
      title: t('pastWorkoutHistory.filters.dateRange') || 'Date Range',
      description: t('pastWorkoutHistory.filters.dateRangeDescription') || 'Filter by time period',
      onPress: () => onDateRangeFilter?.(),
    },
    {
      icon: ArrowUpDown,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.text.primary20,
      title: t('pastWorkoutHistory.filters.sortBy') || 'Sort By',
      description: t('pastWorkoutHistory.filters.sortByDescription') || 'Sort workouts by date, name, or duration',
      onPress: () => onSortFilter?.(),
    },
    {
      icon: Trophy,
      iconColor: theme.colors.status.emeraldLight,
      iconBgColor: theme.colors.status.emerald400_10,
      title: t('pastWorkoutHistory.filters.prsOnly') || 'PRs Only',
      description: t('pastWorkoutHistory.filters.prsOnlyDescription') || 'Show only workouts with personal records',
      onPress: () => onPRsOnlyFilter?.(),
    },
    {
      icon: Filter,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.text.primary20,
      title: t('pastWorkoutHistory.filters.workoutType') || 'Workout Type',
      description: t('pastWorkoutHistory.filters.workoutTypeDescription') || 'Filter by exercise type',
      onPress: () => onWorkoutTypeFilter?.(),
    },
  ];

  // Add clear filters option if provided
  if (onClearFilters) {
    items.push({
      icon: Filter,
      iconColor: theme.colors.status.error,
      iconBgColor: theme.colors.status.error20,
      title: t('pastWorkoutHistory.filters.clearFilters') || 'Clear Filters',
      description: t('pastWorkoutHistory.filters.clearFiltersDescription') || 'Reset all filters',
      titleColor: theme.colors.status.error,
      descriptionColor: theme.colors.status.error,
      onPress: () => onClearFilters?.(),
    });
  }

  return (
    <BottomPopUpMenu
      visible={visible}
      onClose={onClose}
      title={t('pastWorkoutHistory.filters.title') || 'Filter Workouts'}
      subtitle={t('pastWorkoutHistory.filters.subtitle') || 'Customize your workout history view'}
      items={items}
    />
  );
}