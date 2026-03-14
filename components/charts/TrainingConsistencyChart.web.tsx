import type { MouseEvent } from 'react';
import { useEffect, useId, useState } from 'react';
import type { ViewProps } from 'react-native';
import { Text, View } from 'react-native';

import { useChartTooltip } from '../../context/ChartTooltipContext';
import { useTheme } from '../../hooks/useTheme';

type ViewWithMouseProps = ViewProps & {
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  style?: ViewProps['style'] & { cursor?: string; boxShadow?: string };
};

const DEFAULT_NEON = '#00FFA2';
const DEFAULT_BORDER = '#1C2623';

const OPACITIES: Record<number, number> = {
  0: 0,
  1: 0.2,
  2: 0.4,
  3: 0.6,
  4: 0.8,
  5: 1,
};

export type { TrainingConsistencyChartProps } from './TrainingConsistencyChart';

const TOOLTIP_WIDTH = 100;
const TOOLTIP_HEIGHT = 40;

export function TrainingConsistencyChart({
  title,
  subtitle,
  percentage,
  percentageLabel = 'GOAL REACHED',
  data,
  rowsPerColumn = 7,
  columns = 12,
  accentColor = DEFAULT_NEON,
  emptyColor,
  showGlowOnMax = true,
  gridHeight = 128,
  gap = 6,
  className,
}: import('./TrainingConsistencyChart').TrainingConsistencyChartProps) {
  const theme = useTheme();
  const chartId = useId();
  const { registerChart, unregisterChart, notifyChartActive } = useChartTooltip();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  useEffect(() => {
    registerChart(chartId, () => setActiveLabel(null));
    return () => unregisterChart(chartId);
  }, [chartId]);
  const borderColor = emptyColor ?? theme.colors?.border?.light ?? DEFAULT_BORDER;
  const mutedColor = theme.colors?.text?.tertiary ?? '#7E8A87';
  const textPrimary = theme.colors?.text?.primary ?? '#ffffff';

  const totalCells = rowsPerColumn * columns;
  const cells = data.slice(0, totalCells);
  const rowCount = rowsPerColumn;
  const colCount = Math.ceil(cells.length / rowCount) || columns;

  // Explicit dimensions so the grid renders on web (flex:1 + minHeight:0 often fails in RNW)
  const cellHeight = rowCount > 0 ? (gridHeight - (rowCount - 1) * gap) / rowCount : 0;

  return (
    <View className={className} style={{ position: 'relative' }}>
      {activeLabel ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            minWidth: TOOLTIP_WIDTH,
            height: TOOLTIP_HEIGHT,
            backgroundColor: theme.colors.background.card,
            borderRadius: theme.borderRadius.xs,
            paddingHorizontal: theme.spacing.padding.sm,
            paddingVertical: theme.spacing.padding.xs,
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
            zIndex: 100,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: theme.colors.text.primary,
              fontSize: theme.typography.fontSize.xxs,
              fontWeight: '600',
              textAlign: 'center',
            }}
          >
            {activeLabel}
          </Text>
        </View>
      ) : null}
      {/* Header */}
      <View className="mb-6 flex-row items-center justify-between" style={{ marginBottom: 24 }}>
        <View>
          {title != null ? (
            <Text
              className="text-lg font-semibold text-text-primary"
              style={{ fontSize: theme.typography?.fontSize?.lg ?? 18, color: textPrimary }}
            >
              {title}
            </Text>
          ) : null}
          {subtitle != null ? (
            <Text
              className="mt-0.5 text-xs uppercase tracking-widest"
              style={{
                fontSize: theme.typography?.fontSize?.xs ?? 12,
                color: mutedColor,
                marginTop: 2,
                letterSpacing: 4,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {percentage != null ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text
              style={{
                fontSize: theme.typography?.fontSize?.xl ?? 20,
                fontWeight: '700',
                color: accentColor,
              }}
            >
              {percentage}%
            </Text>
            <Text
              style={{
                fontSize: 10,
                color: mutedColor,
                marginTop: 2,
                textTransform: 'uppercase',
              }}
            >
              {percentageLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Grid: explicit height per cell so it renders on web */}
      <View
        style={{
          height: gridHeight,
          flexDirection: 'row',
          flexWrap: 'nowrap',
          gap,
          alignContent: 'flex-start',
          alignItems: 'flex-start',
        }}
      >
        {Array.from({ length: colCount }, (_, colIndex) => (
          <View
            key={colIndex}
            style={{
              flex: 1,
              minWidth: 0,
              height: gridHeight,
              flexDirection: 'column',
              gap,
              justifyContent: 'space-between',
            }}
          >
            {Array.from({ length: rowCount }, (_, rowIndex) => {
              const flatIndex = colIndex * rowCount + rowIndex;
              const value = cells[flatIndex] ?? 0;
              const intensity = Math.max(0, Math.min(5, Math.floor(value)));
              const opacity = OPACITIES[intensity] ?? 0;
              const isEmpty = intensity === 0;
              const isMax = intensity === 5;

              return (
                <View
                  key={rowIndex}
                  {...({
                    style: {
                      height: cellHeight,
                      width: '100%',
                      borderRadius: 4,
                      backgroundColor: isEmpty ? borderColor : accentColor,
                      opacity: isEmpty ? 1 : opacity,
                      cursor: 'pointer',
                      ...(showGlowOnMax && isMax && !isEmpty
                        ? {
                            boxShadow: `0 0 ${8}px ${accentColor}66`,
                          }
                        : {}),
                    },
                    onClick: (e: MouseEvent<HTMLElement>) => {
                      e.stopPropagation();
                      notifyChartActive(chartId);
                      setActiveLabel(`${value} PRs`);
                    },
                  } as ViewWithMouseProps)}
                />
              );
            })}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View
        className="mt-4 flex-row items-center justify-between"
        style={{
          marginTop: 16,
          paddingHorizontal: 0,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            color: mutedColor,
            fontWeight: '500',
          }}
        >
          Less intense
        </Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: borderColor,
            }}
          />
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: accentColor,
              opacity: 0.3,
            }}
          />
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: accentColor,
              opacity: 0.6,
            }}
          />
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: accentColor,
            }}
          />
        </View>
        <Text
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            color: mutedColor,
            fontWeight: '500',
          }}
        >
          High PR
        </Text>
      </View>
    </View>
  );
}
