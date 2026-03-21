import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { BottomPopUp } from '../BottomPopUp';
import { Button } from '../theme/Button';
import { SegmentedControl } from '../theme/SegmentedControl';

export type SortOrder = 'newestFirst' | 'oldestFirst';
export type TrendFilter = 'all' | 'increased' | 'decreased' | 'noChange';

export type BodyMetricsHistoryFilters = {
  sortOrder: SortOrder;
  trend: TrendFilter;
};

export const DEFAULT_FILTERS: BodyMetricsHistoryFilters = {
  sortOrder: 'newestFirst',
  trend: 'all',
};

type BodyMetricsHistoryFilterMenuProps = {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: BodyMetricsHistoryFilters) => void;
  onClearFilters: () => void;
  initialFilters?: BodyMetricsHistoryFilters;
};

export function BodyMetricsHistoryFilterMenu({
  visible,
  onClose,
  onApplyFilters,
  onClearFilters,
  initialFilters,
}: BodyMetricsHistoryFilterMenuProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [sortOrder, setSortOrder] = useState<SortOrder>(
    initialFilters?.sortOrder ?? DEFAULT_FILTERS.sortOrder
  );
  const [trend, setTrend] = useState<TrendFilter>(initialFilters?.trend ?? DEFAULT_FILTERS.trend);

  useEffect(() => {
    if (visible && initialFilters) {
      setSortOrder(initialFilters.sortOrder);
      setTrend(initialFilters.trend);
    }
  }, [visible, initialFilters]);

  const sortOptions = useMemo(
    () => [
      {
        label: t('bodyMetrics.history.filters.sortOrder.newestFirst'),
        value: 'newestFirst',
      },
      {
        label: t('bodyMetrics.history.filters.sortOrder.oldestFirst'),
        value: 'oldestFirst',
      },
    ],
    [t]
  );

  const trendOptions: { id: TrendFilter; label: string }[] = useMemo(
    () => [
      { id: 'all', label: t('bodyMetrics.history.filters.trend.all') },
      { id: 'increased', label: t('bodyMetrics.history.filters.trend.increased') },
      { id: 'decreased', label: t('bodyMetrics.history.filters.trend.decreased') },
      { id: 'noChange', label: t('bodyMetrics.history.filters.trend.noChange') },
    ],
    [t]
  );

  const handleReset = () => {
    setSortOrder(DEFAULT_FILTERS.sortOrder);
    setTrend(DEFAULT_FILTERS.trend);
    onClearFilters();
  };

  const handleApply = () => {
    onApplyFilters({ sortOrder, trend });
    onClose();
  };

  return (
    <BottomPopUp
      visible={visible}
      onClose={onClose}
      title={t('bodyMetrics.history.filters.title')}
      maxHeight="60%"
      footer={
        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing.gap.base,
            paddingTop: theme.spacing.padding.md,
          }}
        >
          <Button
            label={t('bodyMetrics.history.filters.reset')}
            variant="outline"
            width="flex-1"
            size="sm"
            onPress={handleReset}
          />
          <Button
            label={t('bodyMetrics.history.filters.apply')}
            variant="gradientCta"
            width="flex-2"
            size="sm"
            onPress={handleApply}
          />
        </View>
      }
    >
      <View style={{ gap: theme.spacing.gap['2xl'] }}>
        {/* Drag Handle */}
        <View
          style={{
            alignSelf: 'center',
            width: theme.size['12'],
            height: theme.spacing.padding['1half'],
            backgroundColor: theme.colors.text.tertiary,
            borderRadius: theme.borderRadius.full,
            marginTop: theme.spacing.padding.sm,
            marginBottom: -theme.spacing.gap.base,
          }}
        />

        {/* Sort Order Section */}
        <View>
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: theme.typography.letterSpacing.extraWide,
              marginBottom: theme.spacing.padding.base,
            }}
          >
            {t('bodyMetrics.history.filters.sortOrder.title')}
          </Text>
          <SegmentedControl
            options={sortOptions}
            value={sortOrder}
            onValueChange={(value) => setSortOrder(value as SortOrder)}
            variant="outline"
          />
        </View>

        {/* Trend Section */}
        <View>
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: theme.typography.letterSpacing.extraWide,
              marginBottom: theme.spacing.padding.base,
            }}
          >
            {t('bodyMetrics.history.filters.trend.title')}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.gap.sm,
            }}
          >
            {trendOptions.map((option) => {
              const isSelected = trend === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setTrend(option.id)}
                  className="flex-row items-center gap-2 rounded-full border px-4 py-2 active:scale-95"
                  style={{
                    backgroundColor: isSelected
                      ? theme.colors.accent.primary10
                      : theme.colors.background.card,
                    borderWidth: theme.borderWidth.thin,
                    borderColor: isSelected
                      ? theme.colors.accent.primary30
                      : theme.colors.border.light,
                  }}
                >
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.sm,
                      fontWeight: isSelected
                        ? theme.typography.fontWeight.semibold
                        : theme.typography.fontWeight.medium,
                      color: isSelected ? theme.colors.accent.primary : theme.colors.text.secondary,
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </BottomPopUp>
  );
}
