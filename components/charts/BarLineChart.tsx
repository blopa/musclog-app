import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Bar, CartesianChart, Line, Scatter } from 'victory-native';

import { useTheme } from '../../hooks/useTheme';
import { XAxisLabel } from '../../utils/chartUtils';

export type BarLineChartDatum = {
  /** X value (e.g. 0 = Mon, 1 = Tue, ...) */
  x: number;
  /** Bar series value (e.g. steps) */
  steps: number;
  /** Line series value (e.g. heart rate bpm) */
  heartRate: number;
};

export type BarLineChartProps = {
  /** Chart title */
  title?: string;
  /** Chart subtitle */
  subtitle?: string;
  /** Label for the bar series (left Y-axis, e.g. "Steps Taken") */
  barSeriesLabel?: string;
  /** Label for the line series (right Y-axis, e.g. "Avg Heart Rate") */
  lineSeriesLabel?: string;
  /** Array of data points */
  data: BarLineChartDatum[];
  /** Height of the chart in pixels (default: 256) */
  height?: number;
  /** Bar color (default: theme accent primary / neon) */
  barColor?: string;
  /** Line color (default: theme amber/warning for contrast) */
  lineColor?: string;
  /** Left Y-axis domain [min, max] for bar series (default: [0, 12000]) */
  stepsDomain?: [number, number];
  /** Right Y-axis domain [min, max] for line series (default: [60, 140]) */
  heartRateDomain?: [number, number];
  /** Left Y-axis tick labels (default: 0, 3k, 6k, 9k, 12k) */
  leftAxisLabels?: string[];
  /** Right Y-axis tick labels (default: 60, 80, 100, 120, 140) */
  rightAxisLabels?: string[];
  /** X-axis labels (e.g. ['Mon', 'Tue', ...]) */
  xAxisLabels?: XAxisLabel[];
  /** Format bar tooltip (default: formats steps with commas) */
  stepsFormatter?: (value: number) => string;
  /** Format line tooltip (default: value as string) */
  heartRateFormatter?: (value: number) => string;
  /** Enable touch tooltips (default: true) */
  interactive?: boolean;
  /** Custom className for container */
  className?: string;
};

const TOOLTIP_WIDTH = 72;
const TOOLTIP_HEIGHT = 32;

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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [labelContainerWidth, setLabelContainerWidth] = useState(0);
  const containerWidthRef = useRef(0);
  const chartWidthSv = useSharedValue(0);

  const barColorResolved = barColor ?? theme.colors.accent.primary;
  const lineColorResolved = lineColor ?? theme.colors.background.white;

  const barTooltipLeft = useSharedValue(0);
  const barTooltipTop = useSharedValue(0);
  const lineTooltipLeft = useSharedValue(0);
  const lineTooltipTop = useSharedValue(0);

  const barTooltipStyle = useAnimatedStyle(() => ({
    left: Math.max(0, Math.min(chartWidthSv.value - TOOLTIP_WIDTH, barTooltipLeft.value)),
    top: Math.max(0, barTooltipTop.value),
  }));

  const lineTooltipStyle = useAnimatedStyle(() => ({
    left: Math.max(0, Math.min(chartWidthSv.value - TOOLTIP_WIDTH, lineTooltipLeft.value)),
    top: Math.max(0, lineTooltipTop.value),
  }));

  if (data.length === 0) {
    return null;
  }

  const xDomain: [number, number] = [0, data.length - 1];
  const stepsRange = stepsDomain[1] - stepsDomain[0];
  const hrRange = heartRateDomain[1] - heartRateDomain[0];

  const handleTouchAt = (touchX: number) => {
    const w = containerWidthRef.current;
    if (w === 0) {
      return;
    }
    const chartWidth = w - 64;
    if (chartWidth <= 0) {
      return;
    }
    const t = Math.max(0, Math.min(1, touchX / chartWidth));
    const index = Math.round(t * (data.length - 1));
    const datum = data[Math.min(index, data.length - 1)];
    if (!datum) {
      return;
    }

    const idx = Math.min(index, data.length - 1);
    setActiveIndex(idx);
    const barCenterX = (idx / Math.max(1, data.length - 1)) * chartWidth;
    const barTopY = ((stepsDomain[1] - datum.steps) / stepsRange) * (height - 24) + 12;
    barTooltipLeft.value = barCenterX - TOOLTIP_WIDTH / 2;
    barTooltipTop.value = barTopY - TOOLTIP_HEIGHT - 6;

    const lineY = ((heartRateDomain[1] - datum.heartRate) / hrRange) * (height - 24) + 12;
    lineTooltipLeft.value = barCenterX - TOOLTIP_WIDTH / 2;
    lineTooltipTop.value = lineY - TOOLTIP_HEIGHT - 6;
  };

  const chartData = data as { x: number; steps: number; heartRate: number }[];

  const activeDatum = activeIndex != null ? data[activeIndex] : null;

  // Match chart's domainPadding (left: 12, right: 12): data x [0, n-1] maps to 12px .. (width - 12)px
  const CHART_PADDING_X = 12;
  const LABEL_BOX_WIDTH = 40;
  const xLabelLeft = (index: number) => {
    if (labelContainerWidth <= 0) {
      return 0;
    }

    const dataWidth = labelContainerWidth - 2 * CHART_PADDING_X;
    const barCenterX = CHART_PADDING_X + (index / Math.max(1, data.length - 1)) * dataWidth;
    return barCenterX - LABEL_BOX_WIDTH / 2;
  };

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

      <View
        style={{ height, position: 'relative' }}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          containerWidthRef.current = w;
          chartWidthSv.value = Math.max(0, w - 64);
        }}
      >
        {/* Left Y-axis labels */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 12,
            bottom: 12,
            width: 28,
            justifyContent: 'space-between',
            zIndex: 2,
          }}
        >
          {[...leftAxisLabels].reverse().map((label, i) => (
            <Text
              key={`${label}-${i}`}
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

        {/* Right Y-axis labels */}
        <View
          style={{
            position: 'absolute',
            right: 0,
            top: 12,
            bottom: 12,
            width: 28,
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            zIndex: 2,
          }}
        >
          {[...rightAxisLabels].reverse().map((label, i) => (
            <Text
              key={`${label}-${i}`}
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

        {/* Chart area inset for axes */}
        <View style={{ position: 'absolute', left: 32, right: 32, top: 0, bottom: 0 }}>
          <CartesianChart
            data={chartData}
            xKey="x"
            yKeys={['steps', 'heartRate']}
            domain={{ x: xDomain }}
            domainPadding={{ left: 12, right: 12, top: 10, bottom: 0 }}
            padding={0}
            yAxis={[
              {
                yKeys: ['steps'],
                domain: stepsDomain,
                axisSide: 'left',
                lineColor: theme.colors.border.light,
                tickCount: 0,
                labelColor: 'transparent',
              },
              {
                yKeys: ['heartRate'],
                domain: heartRateDomain,
                axisSide: 'right',
                lineColor: theme.colors.border.light,
                tickCount: 0,
                labelColor: 'transparent',
              },
            ]}
            xAxis={{
              lineColor: 'transparent',
              labelColor: 'transparent',
              tickCount: 0,
            }}
            frame={{ lineWidth: 0 }}
          >
            {({ points, chartBounds }) => (
              <>
                <Bar
                  points={points.steps}
                  chartBounds={chartBounds}
                  color={barColorResolved}
                  innerPadding={0.35}
                  roundedCorners={{ topLeft: 4, topRight: 4 }}
                />
                <Line
                  points={points.heartRate}
                  curveType="monotoneX"
                  color={lineColorResolved}
                  strokeWidth={2.5}
                  strokeCap="round"
                />
                <Scatter
                  points={points.heartRate}
                  radius={4}
                  color={lineColorResolved}
                  style="fill"
                />
              </>
            )}
          </CartesianChart>

          {interactive && activeDatum ? (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  barTooltipStyle,
                  {
                    position: 'absolute',
                    width: TOOLTIP_WIDTH,
                    height: TOOLTIP_HEIGHT,
                    backgroundColor: theme.colors.text.white,
                    borderRadius: theme.borderRadius.xs,
                    paddingHorizontal: theme.spacing.padding.sm,
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: theme.colors.text.black,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    elevation: 4,
                    zIndex: 10,
                  },
                ]}
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
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[
                  lineTooltipStyle,
                  {
                    position: 'absolute',
                    width: TOOLTIP_WIDTH,
                    height: TOOLTIP_HEIGHT,
                    backgroundColor: lineColorResolved,
                    borderRadius: theme.borderRadius.xs,
                    paddingHorizontal: theme.spacing.padding.sm,
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: theme.colors.text.black,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 4,
                    zIndex: 10,
                  },
                ]}
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
              </Animated.View>
            </>
          ) : null}
        </View>

        {interactive ? (
          <View
            style={{ position: 'absolute', left: 32, right: 32, top: 0, bottom: 0 }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onResponderGrant={(e) => handleTouchAt(e.nativeEvent.locationX)}
            onResponderMove={(e) => handleTouchAt(e.nativeEvent.locationX)}
            onResponderRelease={() => setActiveIndex(null)}
            onResponderTerminate={() => setActiveIndex(null)}
          />
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
                left: `${label.positionPercent}%`,
                width: 40,
                marginLeft: -20,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '500',
                  color: theme.colors.text.tertiary,
                  textAlign: 'center',
                  marginLeft: label.positionPercent === 0 ? 20 : label.positionPercent === 100 ? -20 : 0,
                }}
                numberOfLines={1}
              >
                {label.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Legend */}
      <View className="flex-row items-center justify-center gap-6" style={{ marginTop: 16 }}>
        <View className="flex-row items-center gap-2">
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
        <View className="flex-row items-center gap-2">
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
