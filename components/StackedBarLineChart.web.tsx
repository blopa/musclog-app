import type { MouseEvent } from 'react';
import { useState } from 'react';
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

import { useTheme } from '../hooks/useTheme';

export type StackedBarLineChartDatum = {
  x: number;
  segments: [number, number?, number?, number?];
  lineValue: number;
};

/** View props plus web mouse events (RN Web renders View as div and supports these) */
type ViewWithMouseProps = ViewProps & {
  onMouseMove?: (e: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: () => void;
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
  xAxisLabels?: string[];
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const colors: string[] = [
    stackColors?.[0] ?? (theme.colors.accent?.primary as string) ?? DEFAULT_STACK_COLORS[0],
    stackColors?.[1] ?? DEFAULT_STACK_COLORS[1],
    stackColors?.[2] ?? DEFAULT_STACK_COLORS[2],
    stackColors?.[3] ?? DEFAULT_STACK_COLORS[3],
  ];
  // Use a color distinct from stack (blue, red, yellow, green)
  const lineColorResolved =
    lineColor ?? theme.colors.status?.info ?? '#06b6d4';

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
  const barTopRatio = activeDatum
    ? (stackedMax - sumSegments(activeDatum)) / stackedRange
    : 0;
  const lineTopRatio = activeDatum
    ? (lineMax - activeDatum.lineValue) / lineRange
    : 0;

  const chartHeight = height + 128;
  const chartPaddingTop = 6;
  const chartPaddingBottom = 4;

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
            zIndex: 2,
          }}
        >
          {[...leftAxisLabels].reverse().map((label) => (
            <Text
              key={label}
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
            zIndex: 2,
          }}
        >
          {[...rightAxisLabels].reverse().map((label) => (
            <Text
              key={label}
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
          {...({
            style: {
              position: 'absolute',
              left: 32,
              right: 32,
              top: 0,
              bottom: 0,
              overflow: 'hidden',
            },
            onMouseMove: (e: MouseEvent<HTMLElement>) => {
              if (!interactive) return;
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const chartWidth = rect.width;
              const x = e.clientX - rect.left;
              const t = Math.max(0, Math.min(1, x / chartWidth));
              const index = Math.round(t * (data.length - 1));
              setHoveredIndex(Math.min(index, data.length - 1));
            },
            onMouseLeave: () => setHoveredIndex(null),
          } as ViewWithMouseProps)}
        >
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
              tickValues={data.map((_, i) => i)}
              tickFormat={(t) => (xAxisLabels && xAxisLabels[t] != null ? xAxisLabels[t] : '')}
              style={{
                axis: { stroke: 'transparent' },
                grid: { stroke: 'transparent' },
                ticks: { stroke: 'transparent' },
                tickLabels: {
                  fill: theme.colors.text.tertiary,
                  fontSize: 14,
                  fontWeight: 600,
                },
              }}
            />
          </VictoryChart>

          {interactive && activeDatum ? (
            <>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: `${((hoveredIndex ?? 0) / Math.max(1, data.length - 1)) * 100}%`,
                  top: barTopRatio * chartHeight - 38,
                  transform: 'translateX(-50%)',
                  width: 72,
                  height: 32,
                  backgroundColor: theme.colors.text.white,
                  borderRadius: theme.borderRadius.xs,
                  paddingHorizontal: theme.spacing.padding.sm,
                  justifyContent: 'center',
                  alignItems: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                  zIndex: 10,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.text.black,
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: '700',
                  }}
                >
                  {totalFormatter(sumSegments(activeDatum), activeDatum)}
                </Text>
              </View>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: `${((hoveredIndex ?? 0) / Math.max(1, data.length - 1)) * 100}%`,
                  top: lineTopRatio * chartHeight - 38,
                  transform: 'translateX(-50%)',
                  width: 72,
                  height: 32,
                  backgroundColor: lineColorResolved,
                  borderRadius: theme.borderRadius.xs,
                  paddingHorizontal: theme.spacing.padding.sm,
                  justifyContent: 'center',
                  alignItems: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  zIndex: 10,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.text.black,
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: '700',
                  }}
                >
                  {lineFormatter(activeDatum.lineValue)}
                </Text>
              </View>
            </>
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
