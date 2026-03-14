import type { MouseEvent } from 'react';
import { useEffect, useId, useState } from 'react';
import type { ViewProps } from 'react-native';
import { Text, View } from 'react-native';
import { VictoryAxis, VictoryBar, VictoryChart } from 'victory';

import { useChartTooltip } from '../../context/ChartTooltipContext';
import { useTheme } from '../../hooks/useTheme';
import { X_AXIS_LABEL_OFFSET, X_AXIS_LABEL_WIDTH, XAxisLabel } from '../../utils/chartUtils';

/** View props plus web mouse events (RN Web renders View as div and supports these) */
type ViewWithMouseProps = ViewProps & {
  onClick?: (e: MouseEvent<HTMLElement>) => void;
};

export type BarChartDataPoint = {
  /** X value (category index or numeric label) */
  x: number;
  /** Y value (bar height) */
  y: number;
};

export type BarChartProps = {
  /** Array of data points to display as bars */
  data: BarChartDataPoint[];
  /** Height of the chart in pixels (default: 192) */
  height?: number;
  /** Color of the bars (default: theme accent primary) */
  barColor?: string;
  /** Padding between bars, 0–1 (default: 0.2) */
  innerPadding?: number;
  /** Radius for top-left and top-right corners of bars (default: 4) */
  roundedCornerRadius?: number;
  /** Whether to show grid lines (default: true) */
  showGridLines?: boolean;
  /** Color of grid lines (default: theme border light) */
  gridLineColor?: string;
  /** Custom X-axis domain [min, max] */
  xDomain?: [number, number];
  /** Custom Y-axis domain [min, max] */
  yDomain?: [number, number];
  /** Custom X-axis labels to display below the chart */
  xAxisLabels?: XAxisLabel[];
  /** Y-axis labels overlaid on the chart. yDomainValue should be in the y-domain space [yDomain[0], yDomain[1]]. */
  yAxisLabels?: { label: string; yDomainValue: number }[];
  /** Custom margin top for the chart container (default: 16) */
  marginTop?: number;
  /** Custom margin bottom for X-axis labels (default: 16) */
  marginBottom?: number;
  /** Custom className for the container */
  className?: string;
  /** Domain padding to prevent first/last bar from being clipped (default: { left: 20, right: 20, top: 10 }) */
  domainPadding?: { left?: number; right?: number; top?: number; bottom?: number };
  /** Enable touch/hover interaction to show a tooltip (default: true) */
  interactive?: boolean;
  /** Format the tooltip label for a given data point (default: shows rounded y value) */
  tooltipFormatter?: (point: BarChartDataPoint) => string;
  /** No-op on web — only used by native to lock parent ScrollView */
  onInteractionStart?: () => void;
  /** No-op on web — only used by native to re-enable parent ScrollView */
  onInteractionEnd?: () => void;
};

export function BarChart({
  data,
  height = 192,
  barColor,
  innerPadding = 0.2,
  roundedCornerRadius = 4,
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
}: BarChartProps) {
  const theme = useTheme();
  const chartId = useId();
  const { registerChart, unregisterChart, notifyChartActive, tooltipPosition } = useChartTooltip();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const barColorResolved = barColor ?? theme.colors.accent.primary;

  useEffect(() => {
    registerChart(chartId, () => setActiveLabel(null));
    return () => unregisterChart(chartId);
  }, [chartId]);

  if (data.length === 0) {
    return null;
  }

  const xMin = xDomain?.[0] ?? Math.min(...data.map((d) => d.x));
  const xMax = xDomain?.[1] ?? Math.max(...data.map((d) => d.x));
  const yMin = yDomain?.[0] ?? 0;
  const yMax = yDomain?.[1] ?? Math.max(...data.map((d) => d.y), 1);

  // Expand domain slightly so first/last bars aren't clipped (Victory uses data-space padding)
  const xSpan = xMax - xMin || 1;
  const xPadding = xSpan / data.length;
  const paddedXDomain: [number, number] = [xMin - xPadding, xMax + xPadding];

  const yDomainFinal: [number, number] = [yMin, yMax];
  const padding = { left: 20, right: 20 };

  return (
    <View className={className || 'relative w-full'} style={{ marginTop }}>
      {yAxisLabels?.map(({ label, yDomainValue }, i) => {
        const yRange = yDomainFinal[1] - yDomainFinal[0];
        const topOffset = (1 - (yDomainValue - yDomainFinal[0]) / yRange) * height;
        return (
          <Text
            key={`${label}-${i}`}
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
      <View style={{ position: 'relative', height }}>
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
                const label = tooltipFormatter
                  ? tooltipFormatter(nearest)
                  : String(Math.round(nearest.y * 10) / 10);
                notifyChartActive(chartId);
                setActiveLabel(label);
              },
            } as ViewWithMouseProps)}
          />
        ) : null}
        <VictoryChart
          height={height}
          padding={{ left: 0, right: 0, top: 0, bottom: 0 }}
          domain={{ x: paddedXDomain, y: [yMin, yMax] }}
          style={{
            parent: {
              height,
              width: '100%',
            },
          }}
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
          <VictoryBar
            data={data}
            barRatio={1 - innerPadding}
            cornerRadius={{ top: roundedCornerRadius }}
            style={{
              data: {
                fill: barColorResolved,
              },
            }}
          />
          <VictoryAxis
            style={{
              axis: { stroke: 'transparent' },
              grid: { stroke: 'transparent' },
              ticks: { stroke: 'transparent' },
              tickLabels: { fill: 'transparent' },
            }}
          />
        </VictoryChart>
        {interactive && activeLabel ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 6,
              ...(tooltipPosition === 'left' ? { left: 6 } : { right: 6 }),
              minWidth: 90,
              minHeight: 36,
              backgroundColor: theme.colors.background.card,
              borderRadius: theme.borderRadius.xs,
              paddingHorizontal: theme.spacing.padding.sm,
              paddingVertical: theme.spacing.padding['1half'],
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
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
            marginTop: marginBottom,
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
