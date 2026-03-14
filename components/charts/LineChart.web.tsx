import type { MouseEvent } from 'react';
import { useEffect, useId, useState } from 'react';
import type { ViewProps } from 'react-native';
import { Text, View } from 'react-native';
import { VictoryArea, VictoryAxis, VictoryChart, VictoryLine, VictoryScatter } from 'victory';

import { useChartTooltip } from '../../context/ChartTooltipContext';
import { useTheme } from '../../hooks/useTheme';
import { X_AXIS_LABEL_OFFSET, X_AXIS_LABEL_WIDTH, XAxisLabel } from '../../utils/chartUtils';

/** View props plus web mouse events (RN Web renders View as div and supports these) */
type ViewWithMouseProps = ViewProps & {
  onClick?: (e: MouseEvent<HTMLElement>) => void;
};

export type LineChartDataPoint = {
  x: number;
  y: number;
};

export type LineChartProps = {
  /** Array of data points to display on the chart */
  data: LineChartDataPoint[];
  /** Height of the chart in pixels (default: 192) */
  height?: number;
  /** Width of the chart domain (default: 400) */
  chartWidth?: number;
  /** Height of the chart domain (default: 150) */
  chartHeight?: number;
  /** Color of the line (default: theme accent primary) */
  lineColor?: string;
  /** Color of the area fill (default: theme accent primary30) */
  areaColor?: string;
  /** Width of the line stroke (default: 3) */
  lineWidth?: number;
  /** Whether to show the last data point as a circle marker (default: true) */
  showLastPoint?: boolean;
  /** Size of the last point marker (default: 10) */
  lastPointSize?: number;
  /** Color of the last point marker stroke (default: theme background card) */
  lastPointStrokeColor?: string;
  /** Width of the last point marker stroke (default: 2) */
  lastPointStrokeWidth?: number;
  /** Custom X-axis domain [min, max] (default: [0, chartWidth]) */
  xDomain?: [number, number];
  /** Custom Y-axis domain [min, max] (default: [0, chartHeight]) */
  yDomain?: [number, number];
  /** Interpolation method for the line (default: "monotoneX") */
  interpolation?:
    | 'linear'
    | 'monotoneX'
    | 'monotoneY'
    | 'natural'
    | 'step'
    | 'stepBefore'
    | 'stepAfter';
  /** Whether to show grid lines (default: true) */
  showGridLines?: boolean;
  /** Color of grid lines (default: theme border light) */
  gridLineColor?: string;
  /** Grid line tick values for Y-axis (default: calculated based on chartHeight) */
  gridTickValues?: number[];
  /** Custom X-axis labels to display below the chart */
  xAxisLabels?: XAxisLabel[];
  /** Y-axis labels overlaid on the chart */
  yAxisLabels?: { label: string; yDomainValue: number }[];
  /** Custom margin top for the chart container (default: 16) */
  marginTop?: number;
  /** Custom margin bottom for X-axis labels (default: 16) */
  marginBottom?: number;
  /** Custom className for the container */
  className?: string;
  /** Enable touch/hover interaction to show a tooltip (default: false) */
  interactive?: boolean;
  /** Format the tooltip label for a given data point (default: shows rounded y value) */
  tooltipFormatter?: (point: LineChartDataPoint) => string;
  /** No-op on web — only used by native to lock parent ScrollView */
  onInteractionStart?: () => void;
  /** No-op on web — only used by native to lock parent ScrollView */
  onInteractionEnd?: () => void;
};

/**
 * A reusable line chart component built with Victory Native.
 * Displays a smooth line chart with optional area fill, grid lines, and custom labels.
 *
 * @example
 * ```tsx
 * <LineChart
 *   data={[
 *     { x: 0, y: 50 },
 *     { x: 100, y: 75 },
 *     { x: 200, y: 60 },
 *     { x: 400, y: 90 }
 *   ]}
 *   xAxisLabels={['Jan', 'Feb', 'Mar', 'Apr']}
 * />
 * ```
 */
export function LineChart({
  data,
  height = 192,
  chartWidth = 400,
  chartHeight = 150,
  lineColor,
  areaColor,
  lineWidth = 3,
  showLastPoint = true,
  lastPointSize = 10,
  lastPointStrokeColor,
  lastPointStrokeWidth = 2,
  xDomain,
  yDomain,
  interpolation = 'monotoneX',
  showGridLines = true,
  gridLineColor,
  gridTickValues,
  xAxisLabels,
  yAxisLabels,
  marginTop = 16,
  marginBottom = 16,
  className,
  interactive = true,
  tooltipFormatter,
}: LineChartProps) {
  const theme = useTheme();
  const chartId = useId();
  const { registerChart, unregisterChart, notifyChartActive, tooltipPosition } = useChartTooltip();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  useEffect(() => {
    registerChart(chartId, () => setActiveLabel(null));
    return () => unregisterChart(chartId);
  }, [chartId]);

  if (data.length === 0) {
    return null;
  }

  // Calculate default grid tick values if not provided
  const defaultGridTickValues = gridTickValues || [
    chartHeight * 0.25,
    chartHeight * 0.5,
    chartHeight * 0.75,
  ];

  // Use provided domains or default to chart dimensions
  const xDomainFinal = xDomain || [0, chartWidth];
  const yDomainFinal = yDomain || [0, chartHeight];

  // Last data point for the circle marker
  const lastPoint = data[data.length - 1];

  return (
    <View className={className || `relative w-full`} style={{ marginTop }}>
      {/* Y-axis labels overlaid on the chart */}
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
                const xValue = xDomainFinal[0] + ratio * (xDomainFinal[1] - xDomainFinal[0]);
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
          domain={{ x: xDomainFinal, y: yDomainFinal }}
          style={{
            parent: {
              height,
              width: '100%',
            },
          }}
        >
          {/* Grid lines - horizontal dashed lines */}
          {showGridLines ? (
            <VictoryAxis
              dependentAxis
              style={{
                axis: { stroke: 'transparent' },
                grid: {
                  stroke: gridLineColor || theme.colors.border.light,
                  strokeDasharray: '4,4',
                  strokeWidth: 1,
                },
                ticks: { stroke: 'transparent' },
                tickLabels: { fill: 'transparent' },
              }}
              tickValues={defaultGridTickValues}
            />
          ) : null}
          {/* Area fill with gradient */}
          <VictoryArea
            data={data}
            interpolation={interpolation}
            style={{
              data: {
                fill: areaColor || theme.colors.accent.primary30,
              },
            }}
          />
          {/* Line */}
          <VictoryLine
            data={data}
            interpolation={interpolation}
            style={{
              data: {
                stroke: lineColor || theme.colors.accent.primary,
                strokeWidth: lineWidth,
                strokeLinecap: 'round',
              },
            }}
          />
          {/* Data point circle at the end */}
          {showLastPoint ? (
            <VictoryScatter
              data={[lastPoint]}
              size={lastPointSize}
              style={{
                data: {
                  fill: lineColor || theme.colors.accent.primary,
                  stroke: lastPointStrokeColor || theme.colors.background.card,
                  strokeWidth: lastPointStrokeWidth,
                },
              }}
            />
          ) : null}
          {/* Hidden independent axis (x-axis) */}
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
      {/* Custom X-axis labels */}
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
                left: `${label.positionPercent}%` as any,
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
