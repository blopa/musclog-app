import type { MouseEvent } from 'react';
import { useEffect, useId, useState } from 'react';
import type { ViewProps } from 'react-native';
import { Text, View } from 'react-native';
import { VictoryAxis, VictoryBar, VictoryChart, VictoryStack } from 'victory';

import { useChartTooltip } from '@/context/ChartTooltipContext';
import { useTheme } from '@/hooks/useTheme';
import { X_AXIS_LABEL_OFFSET, X_AXIS_LABEL_WIDTH, XAxisLabel } from '@/utils/chartUtils';

/** View props plus web mouse events (RN Web renders View as div and supports these) */
type ViewWithMouseProps = ViewProps & {
  onClick?: (e: MouseEvent<HTMLElement>) => void;
};

export type StackedBarChartDatum = {
  x: number;
  segments: [number, number?, number?, number?];
};

export type StackedBarChartProps = {
  data: StackedBarChartDatum[];
  height?: number;
  stackColors?: [string, string?, string?, string?];
  innerPadding?: number;
  showGridLines?: boolean;
  gridLineColor?: string;
  xDomain?: [number, number];
  yDomain?: [number, number];
  xAxisLabels?: XAxisLabel[];
  yAxisLabels?: { label: string; yDomainValue: number }[];
  marginTop?: number;
  marginBottom?: number;
  showTotalLabels?: boolean;
  totalLabelFormatter?: (total: number, datum: StackedBarChartDatum) => string;
  className?: string;
  domainPadding?: { left?: number; right?: number; top?: number; bottom?: number };
  /** Enable touch/hover interaction to show a tooltip (default: true) */
  interactive?: boolean;
  /** Format the tooltip label for a given data point (default: shows rounded total) */
  tooltipFormatter?: (point: StackedBarChartDatum) => string;
};

const TOOLTIP_WIDTH = 90;
const TOOLTIP_HEIGHT = 36;

export function StackedBarChart({
  data,
  height = 192,
  stackColors,
  innerPadding = 0.2,
  showGridLines = true,
  gridLineColor,
  xDomain,
  yDomain,
  xAxisLabels,
  yAxisLabels,
  marginTop = 16,
  marginBottom = 16,
  className,
  domainPadding: _domainPadding = { left: 20, right: 20, top: 10 },
  interactive = true,
  tooltipFormatter,
}: StackedBarChartProps) {
  const theme = useTheme();

  const DEFAULT_COLORS = [
    theme.colors.status.info,
    theme.colors.status.error,
    theme.colors.status.yellow,
    theme.colors.accent.primary,
  ];
  const chartId = useId();
  const { registerChart, unregisterChart, notifyChartActive, tooltipPosition } = useChartTooltip();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  useEffect(() => {
    registerChart(chartId, () => setActiveLabel(null));
    return () => unregisterChart(chartId);
  }, [chartId, registerChart, unregisterChart]);

  if (data.length === 0) {
    return null;
  }

  const colors: string[] = [
    stackColors?.[0] ?? (theme.colors.accent?.primary as string) ?? DEFAULT_COLORS[0],
    stackColors?.[1] ?? DEFAULT_COLORS[1],
    stackColors?.[2] ?? DEFAULT_COLORS[2],
    stackColors?.[3] ?? DEFAULT_COLORS[3],
  ];

  const xMin = xDomain?.[0] ?? Math.min(...data.map((d) => d.x));
  const xMax = xDomain?.[1] ?? Math.max(...data.map((d) => d.x));
  const maxTotal = Math.max(
    ...data.map((d) => {
      const s = d.segments;
      return (s[0] ?? 0) + (s[1] ?? 0) + (s[2] ?? 0) + (s[3] ?? 0);
    }),
    1
  );
  const yMin = yDomain?.[0] ?? 0;
  const yMax = yDomain?.[1] ?? maxTotal;

  const xPadding = (xMax - xMin) / Math.max(data.length, 1);
  const paddedXDomain: [number, number] = [xMin - xPadding, xMax + xPadding];

  const segmentData = [
    data.map((d) => ({ x: d.x, y: d.segments[0] ?? 0 })),
    data.map((d) => ({ x: d.x, y: d.segments[1] ?? 0 })),
    data.map((d) => ({ x: d.x, y: d.segments[2] ?? 0 })),
    data.map((d) => ({ x: d.x, y: d.segments[3] ?? 0 })),
  ];

  const padding = { left: 20, right: 20 };

  return (
    <View className={className} style={{ marginTop }}>
      <View style={{ height, position: 'relative' }}>
        {yAxisLabels?.map(({ label, yDomainValue }) => {
          const yRange = yMax - yMin;
          const topOffset = (1 - (yDomainValue - yMin) / yRange) * height;
          return (
            <Text
              key={label}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 6,
                top: topOffset - 6,
                fontSize: theme.typography.fontSize.xxs,
                fontWeight: '600',
                color: theme.colors.text.tertiary,
                zIndex: 10,
              }}
            >
              {label}
            </Text>
          );
        })}

        <VictoryChart
          height={height}
          padding={{ left: 0, right: 0, top: 0, bottom: 0 }}
          domain={{ x: paddedXDomain, y: [yMin, yMax] }}
          style={{ parent: { height, width: '100%' } }}
        >
          {showGridLines ? (
            <VictoryAxis
              dependentAxis
              style={{
                axis: { stroke: 'transparent' },
                grid: {
                  stroke: gridLineColor ?? theme.colors.border.light,
                  strokeDasharray: '4,4',
                  strokeWidth: 1,
                },
                ticks: { stroke: 'transparent' },
                tickLabels: { fill: 'transparent' },
              }}
            />
          ) : null}
          <VictoryStack colorScale={colors}>
            {segmentData.map((segment, i) => (
              <VictoryBar
                key={i}
                data={segment}
                x="x"
                y="y"
                barRatio={1 - innerPadding}
                cornerRadius={{ top: i === 3 ? 4 : 0 }}
                style={{ data: { fill: colors[i] } }}
              />
            ))}
          </VictoryStack>
          <VictoryAxis
            style={{
              axis: { stroke: 'transparent' },
              grid: { stroke: 'transparent' },
              ticks: { stroke: 'transparent' },
              tickLabels: { fill: 'transparent' },
            }}
          />
        </VictoryChart>
        {interactive ? (
          <View
            {...({
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                cursor: 'pointer',
                pointerEvents: 'auto',
                zIndex: 10,
              },
              onClick: (e: MouseEvent<HTMLElement>) => {
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                const xValue = paddedXDomain[0] + ratio * (paddedXDomain[1] - paddedXDomain[0]);
                let nearest = data[0];
                let minDist = Math.abs(data[0].x - xValue);
                for (const d of data) {
                  const dist = Math.abs(d.x - xValue);
                  if (dist < minDist) {
                    minDist = dist;
                    nearest = d;
                  }
                }
                const total =
                  (nearest.segments[0] ?? 0) +
                  (nearest.segments[1] ?? 0) +
                  (nearest.segments[2] ?? 0) +
                  (nearest.segments[3] ?? 0);
                const label = tooltipFormatter
                  ? tooltipFormatter(nearest)
                  : String(Math.round(total));
                notifyChartActive(chartId);
                setActiveLabel(label);
              },
            } as ViewWithMouseProps)}
          />
        ) : null}
        {interactive && activeLabel ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 6,
              ...(tooltipPosition === 'left' ? { left: 6 } : { right: 6 }),
              minWidth: TOOLTIP_WIDTH,
              minHeight: TOOLTIP_HEIGHT,
              backgroundColor: theme.colors.background.card,
              borderRadius: theme.borderRadius.xs,
              paddingHorizontal: theme.spacing.padding.sm,
              paddingVertical: theme.spacing.padding['1half'],
              boxShadow: `0 2px 4px ${theme.colors.background.black15}`,
              zIndex: 100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: theme.colors.text.primary,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {activeLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {xAxisLabels && xAxisLabels.length > 0 ? (
        <View
          style={{
            position: 'relative',
            marginTop: 8,
            height: 20,
            width: '100%',
          }}
        >
          {xAxisLabels.map((label, index) => (
            <View
              key={`${label.label}-${index}`}
              style={{
                position: 'absolute',
                left: `calc(${padding.left}px + ${label.positionPercent} * (100% - ${padding.left + padding.right}px) / 100)` as any,
                width: X_AXIS_LABEL_WIDTH,
                transform: [{ translateX: -X_AXIS_LABEL_OFFSET }] as any,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '500',
                  color: theme.colors.text.tertiary,
                  textAlign: 'center',
                  marginLeft:
                    label.positionPercent === 0 ? 10 : label.positionPercent === 100 ? -10 : 0,
                }}
                numberOfLines={1}
              >
                {label.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
