import type { MouseEvent } from 'react';
import { useState } from 'react';
import type { ViewProps } from 'react-native';
import { Text, View } from 'react-native';
import { VictoryAxis, VictoryBar, VictoryChart, VictoryLine, VictoryScatter } from 'victory';

import { useTheme } from '../hooks/useTheme';

/** View props plus web mouse events (RN Web renders View as div and supports these) */
type ViewWithMouseProps = ViewProps & {
  onMouseMove?: (e: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: () => void;
};

export type BarLineChartDatum = {
  x: number;
  steps: number;
  heartRate: number;
};

export type BarLineChartProps = {
  title?: string;
  subtitle?: string;
  barSeriesLabel?: string;
  lineSeriesLabel?: string;
  data: BarLineChartDatum[];
  height?: number;
  barColor?: string;
  lineColor?: string;
  stepsDomain?: [number, number];
  heartRateDomain?: [number, number];
  leftAxisLabels?: string[];
  rightAxisLabels?: string[];
  xAxisLabels?: string[];
  stepsFormatter?: (value: number) => string;
  heartRateFormatter?: (value: number) => string;
  interactive?: boolean;
  className?: string;
};

const DEFAULT_LEFT_LABELS = ['0', '3k', '6k', '9k', '12k'];
const DEFAULT_RIGHT_LABELS = ['60', '80', '100', '120', '140'];

export function BarLineChart({
  title,
  subtitle,
  barSeriesLabel = 'Steps Taken',
  lineSeriesLabel = 'Avg Heart Rate',
  data,
  height = 256,
  barColor,
  lineColor,
  stepsDomain = [0, 12000],
  heartRateDomain = [60, 140],
  leftAxisLabels = DEFAULT_LEFT_LABELS,
  rightAxisLabels = DEFAULT_RIGHT_LABELS,
  xAxisLabels,
  stepsFormatter = (v) => v.toLocaleString(),
  heartRateFormatter = (v) => String(Math.round(v)),
  interactive = true,
  className,
}: BarLineChartProps) {
  const theme = useTheme();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const barColorResolved = barColor ?? theme.colors.accent.primary;
  const lineColorResolved =
    lineColor ?? theme.colors.status?.amber ?? theme.colors.status?.warning ?? '#f59e0b';

  if (data.length === 0) {
    return null;
  }

  const xDomain: [number, number] = [0, data.length - 1];
  const stepsMin = stepsDomain[0];
  const stepsMax = stepsDomain[1];
  const hrMin = heartRateDomain[0];
  const hrMax = heartRateDomain[1];
  const hrRange = hrMax - hrMin;
  const stepsRange = stepsMax - stepsMin;

  // Transform heart rate to steps scale so both plot on same chart
  const lineData = data.map((d) => ({
    x: d.x,
    y: ((d.heartRate - hrMin) / hrRange) * stepsRange + stepsMin,
    heartRate: d.heartRate,
  }));

  const chartXDomain: [number, number] = [xDomain[0], xDomain[1]];

  const activeDatum = hoveredIndex != null ? data[hoveredIndex] : null;
  const stepsRangeForTooltip = stepsMax - stepsMin;
  const barTopRatio = activeDatum ? (stepsMax - activeDatum.steps) / stepsRangeForTooltip : 0;
  const lineTopRatio = activeDatum ? (hrMax - activeDatum.heartRate) / (hrMax - hrMin) : 0;
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
        {/* Y-axis labels aligned exactly with VictoryChart plot area */}
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
              if (!interactive) {
                return;
              }
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
            padding={{ top: chartPaddingTop, bottom: -chartPaddingBottom, left: 0, right: 0 }}
            domain={{ x: chartXDomain, y: [stepsMin, stepsMax] }}
            minDomain={{ y: stepsMin }}
            maxDomain={{ y: stepsMax }}
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
            <VictoryBar
              data={data}
              x="x"
              y="steps"
              cornerRadius={{ top: 6, bottom: 6 }}
              style={{
                data: {
                  fill: barColorResolved,
                  width: 45,
                },
              }}
            />
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
                  {stepsFormatter(activeDatum.steps)}
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
                  {heartRateFormatter(activeDatum.heartRate)}
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
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              backgroundColor: barColorResolved,
            }}
          />
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
