import type { MouseEvent } from 'react';
import { useEffect, useId, useState } from 'react';
import type { ViewProps } from 'react-native';
import { Text, View } from 'react-native';
import {
  VictoryAxis,
  VictoryBar,
  VictoryChart,
  VictoryLine,
  VictoryScatter,
  VictoryStack,
} from 'victory';

import { useChartTooltip } from '../../context/ChartTooltipContext';
import { useTheme } from '../../hooks/useTheme';
import { X_AXIS_LABEL_OFFSET, X_AXIS_LABEL_WIDTH, XAxisLabel } from '../../utils/chartUtils';

export type StackedBarLineChartDatum = {
  x: number;
  segments: [number, number?, number?, number?];
  lineValue: number;
};

/** View props plus web mouse events (RN Web renders View as div and supports these) */
type ViewWithMouseProps = ViewProps & {
  onClick?: (e: MouseEvent<HTMLElement>) => void;
};

export type StackedBarLineChartProps = {
  title?: string;
  subtitle?: string;
  barSeriesLabel?: string;
  lineSeriesLabel?: string;
  data: StackedBarLineChartDatum[];
  height?: number;
  stackColors?: [string, string?, string?, string?];
  lineColor?: string;
  stackedDomain?: [number, number];
  lineDomain?: [number, number];
  innerPadding?: number;
  leftAxisLabels?: string[];
  rightAxisLabels?: string[];
  xAxisLabels?: XAxisLabel[];
  totalFormatter?: (total: number, datum: StackedBarLineChartDatum) => string;
  lineFormatter?: (value: number) => string;
  interactive?: boolean;
  className?: string;
};

const DEFAULT_STACK_COLORS = ['#3b82f6', '#ef4444', '#eab308', '#22c55e'];
const DEFAULT_LEFT_LABELS = ['0', '5', '10', '15', '20'];
const DEFAULT_RIGHT_LABELS = ['60', '80', '100', '120', '140'];

function sumSegments(d: StackedBarLineChartDatum): number {
  const s = d.segments;
  return (s[0] ?? 0) + (s[1] ?? 0) + (s[2] ?? 0) + (s[3] ?? 0);
}

export function StackedBarLineChart({
  title,
  subtitle,
  barSeriesLabel = 'Total',
  lineSeriesLabel = 'Avg Heart Rate',
  data,
  height = 256,
  stackColors,
  lineColor,
  stackedDomain,
  lineDomain = [60, 140],
  innerPadding = 0.2,
  leftAxisLabels = DEFAULT_LEFT_LABELS,
  rightAxisLabels = DEFAULT_RIGHT_LABELS,
  xAxisLabels,
  totalFormatter = (t) => String(Math.round(t)),
  lineFormatter = (v) => String(Math.round(v)),
  interactive = true,
  className,
}: StackedBarLineChartProps) {
  const theme = useTheme();
  const chartId = useId();
  const { registerChart, unregisterChart, notifyChartActive, tooltipPosition } = useChartTooltip();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    registerChart(chartId, () => setHoveredIndex(null));
    return () => unregisterChart(chartId);
  }, [chartId, registerChart, unregisterChart]);

  const colors: string[] = [
    stackColors?.[0] ?? (theme.colors.accent?.primary as string) ?? DEFAULT_STACK_COLORS[0],
    stackColors?.[1] ?? DEFAULT_STACK_COLORS[1],
    stackColors?.[2] ?? DEFAULT_STACK_COLORS[2],
    stackColors?.[3] ?? DEFAULT_STACK_COLORS[3],
  ];
  // Use a color distinct from stack (blue, red, yellow, green)
  const lineColorResolved = lineColor ?? theme.colors.background.white;

  if (data.length === 0) {
    return null;
  }

  const maxStackTotal = Math.max(...data.map(sumSegments), 1);
  const stackedMin = stackedDomain?.[0] ?? 0;
  const stackedMax = stackedDomain?.[1] ?? Math.ceil(maxStackTotal * 1.1);
  const stackedRange = stackedMax - stackedMin;
  const lineMin = lineDomain[0];
  const lineMax = lineDomain[1];
  const lineRange = lineMax - lineMin;

  const xDomain: [number, number] = [0, data.length - 1];

  // Transform line values to stacked scale so line and bars share one y-axis in Victory
  const lineData = data.map((d) => ({
    x: d.x,
    y: ((d.lineValue - lineMin) / lineRange) * stackedRange + stackedMin,
    lineValue: d.lineValue,
  }));

  const segmentData = [
    data.map((d) => ({ x: d.x, y: d.segments[0] ?? 0 })),
    data.map((d) => ({ x: d.x, y: d.segments[1] ?? 0 })),
    data.map((d) => ({ x: d.x, y: d.segments[2] ?? 0 })),
    data.map((d) => ({ x: d.x, y: d.segments[3] ?? 0 })),
  ];

  const activeDatum = hoveredIndex != null ? data[hoveredIndex] : null;
  const chartHeight = height + 128;
  const chartPaddingTop = 6;
  const chartPaddingBottom = 4;
  const padding = { left: 40, right: 0 };

  return (
    <View className={className} style={{ paddingHorizontal: 4 }}>
      {title || subtitle ? (
        <View className="mb-4">
          {title ? (
            <Text
              className="text-xl font-semibold text-text-primary"
              style={{ fontSize: theme.typography.fontSize.xl }}
            >
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text
              className="text-sm text-text-secondary"
              style={{ fontSize: theme.typography.fontSize.sm, marginTop: 2 }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ height, position: 'relative' }}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: chartPaddingTop,
            bottom: chartPaddingBottom,
            width: 28,
            justifyContent: 'space-between',
            zIndex: 10,
          }}
        >
          {[...leftAxisLabels].reverse().map((label, idx) => (
            <Text
              key={`${label}-${idx}`}
              style={{
                fontSize: theme.typography.fontSize.xxs,
                fontWeight: '600',
                color: theme.colors.text.tertiary,
              }}
            >
              {label}
            </Text>
          ))}
        </View>

        <View
          style={{
            position: 'absolute',
            right: 0,
            top: chartPaddingTop,
            bottom: chartPaddingBottom,
            width: 28,
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            zIndex: 10,
          }}
        >
          {[...rightAxisLabels].reverse().map((label, idx) => (
            <Text
              key={`${label}-${idx}`}
              style={{
                fontSize: theme.typography.fontSize.xxs,
                fontWeight: '600',
                color: theme.colors.text.tertiary,
              }}
            >
              {label}
            </Text>
          ))}
        </View>

        <View
          style={{
            position: 'absolute',
            left: 32,
            right: 32,
            top: 0,
            bottom: 0,
            overflow: 'hidden',
          }}
        >
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
                  const chartWidth = rect.width;
                  const x = e.clientX - rect.left;
                  const t = Math.max(0, Math.min(1, x / chartWidth));
                  const index = Math.round(t * (data.length - 1));
                  notifyChartActive(chartId);
                  setHoveredIndex(Math.min(index, data.length - 1));
                },
              } as ViewWithMouseProps)}
            />
          ) : null}
          <VictoryChart
            height={chartHeight}
            padding={{
              top: chartPaddingTop,
              bottom: -chartPaddingBottom,
              left: 40,
              right: 0,
            }}
            domain={{ x: xDomain, y: [stackedMin, stackedMax] }}
            minDomain={{ y: stackedMin }}
            maxDomain={{ y: stackedMax }}
            domainPadding={{ x: 40 }}
            style={{ parent: { height: chartHeight, width: '100%', overflow: 'hidden' } }}
          >
            <VictoryAxis
              dependentAxis
              style={{
                axis: { stroke: 'transparent' },
                grid: {
                  stroke: theme.colors.border.light,
                  strokeDasharray: '4,4',
                  strokeWidth: 1,
                },
                ticks: { stroke: 'transparent' },
                tickLabels: { fill: 'transparent' },
              }}
            />
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
            <VictoryLine
              data={lineData}
              x="x"
              y="y"
              interpolation="monotoneX"
              style={{
                data: {
                  stroke: lineColorResolved,
                  strokeWidth: 3,
                  strokeLinecap: 'round',
                },
              }}
            />
            <VictoryScatter
              data={lineData}
              x="x"
              y="y"
              size={6}
              style={{
                data: {
                  fill: lineColorResolved,
                  stroke: lineColorResolved,
                  strokeWidth: 2,
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

          {xAxisLabels && xAxisLabels.length > 0 ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 20,
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

          {interactive && activeDatum ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 6,
                ...(tooltipPosition === 'left' ? { left: 6 } : { right: 6 }),
                gap: 4,
                zIndex: 100,
              }}
            >
              <View
                style={{
                  minWidth: 72,
                  height: 32,
                  backgroundColor: theme.colors.background.card,
                  borderRadius: theme.borderRadius.xs,
                  paddingHorizontal: theme.spacing.padding.sm,
                  justifyContent: 'center',
                  alignItems: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                }}
              >
                <Text
                  style={{
                    color: theme.colors.text.primary,
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: '700',
                  }}
                >
                  {totalFormatter(sumSegments(activeDatum), activeDatum)}
                </Text>
              </View>
              <View
                style={{
                  minWidth: 72,
                  height: 32,
                  backgroundColor: lineColorResolved,
                  borderRadius: theme.borderRadius.xs,
                  paddingHorizontal: theme.spacing.padding.sm,
                  justifyContent: 'center',
                  alignItems: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                <Text
                  style={{
                    color: theme.colors.background.card,
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: '700',
                  }}
                >
                  {lineFormatter(activeDatum.lineValue)}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 24,
          marginTop: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {colors.slice(0, 4).map((c, i) => (
              <View
                key={i}
                style={{
                  width: 8,
                  height: 12,
                  borderRadius: 1,
                  backgroundColor: c,
                }}
              />
            ))}
          </View>
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.tertiary,
            }}
          >
            {barSeriesLabel}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 16,
              height: 3,
              borderRadius: 2,
              backgroundColor: lineColorResolved,
            }}
          />
          <Text
            style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.tertiary,
            }}
          >
            {lineSeriesLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}
