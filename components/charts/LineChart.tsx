import { useEffect, useId, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Area, CartesianChart, Line, Scatter } from 'victory-native';

import { useChartTooltip } from '../../context/ChartTooltipContext';
import { useTheme } from '../../hooks/useTheme';
import { XAxisLabel } from '../../utils/chartUtils';

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
  /** Y-axis labels overlaid on the chart. yDomainValue should be in the y-domain space [yDomain[0], yDomain[1]]. */
  yAxisLabels?: { label: string; yDomainValue: number }[];
  /** Custom margin top for the chart container (default: 16) */
  marginTop?: number;
  /** Custom margin bottom for X-axis labels (default: 16) */
  marginBottom?: number;
  /** Custom className for the container */
  className?: string;
  /** Enable touch interaction to show a tooltip on press (default: false) */
  interactive?: boolean;
  /** Format the tooltip label for a given data point (default: shows rounded y value) */
  tooltipFormatter?: (point: LineChartDataPoint) => string;
  /** Called when the user starts touching the chart — use to disable parent ScrollView */
  onInteractionStart?: () => void;
  /** Called when the user stops touching the chart — use to re-enable parent ScrollView */
  onInteractionEnd?: () => void;
};

const INTERPOLATION_TO_CURVE: Record<
  NonNullable<LineChartProps['interpolation']>,
  'linear' | 'monotoneX' | 'natural' | 'step' | 'stepAfter' | 'stepBefore'
> = {
  linear: 'linear',
  monotoneX: 'monotoneX',
  monotoneY: 'monotoneX',
  natural: 'natural',
  step: 'step',
  stepBefore: 'stepBefore',
  stepAfter: 'stepAfter',
};

const TOOLTIP_WIDTH = 90;
const TOOLTIP_HEIGHT = 36;

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
  xAxisLabels,
  yAxisLabels,
  marginTop = 16,
  marginBottom = 16,
  className,
  interactive = true,
  tooltipFormatter,
  onInteractionStart,
  onInteractionEnd,
}: LineChartProps) {
  const theme = useTheme();
  const chartId = useId();
  const { registerChart, unregisterChart, notifyChartActive } = useChartTooltip();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const containerWidthRef = useRef(0);
  const activeXPos = useSharedValue(0);
  const activeYPos = useSharedValue(0);

  useEffect(() => {
    registerChart(chartId, () => setActiveLabel(null));
    return () => unregisterChart(chartId);
  }, [chartId]);

  const cursorLineStyle = useAnimatedStyle(() => ({
    left: activeXPos.value,
  }));

  const activeDotStyle = useAnimatedStyle(() => ({
    left: activeXPos.value - 6,
    top: activeYPos.value - 6,
  }));

  if (data.length === 0) {
    return null;
  }

  const xDomainFinal = xDomain ?? [0, chartWidth];
  const yDomainFinal = yDomain ?? [0, chartHeight];
  const curveType = INTERPOLATION_TO_CURVE[interpolation];
  const lineColorResolved = lineColor ?? theme.colors.accent.primary;
  const areaColorResolved = areaColor ?? theme.colors.accent.primary30;

  const handleTouchAt = (touchX: number) => {
    const w = containerWidthRef.current;
    if (w === 0) {
      return;
    }
    const domainX = xDomainFinal[0] + (touchX / w) * (xDomainFinal[1] - xDomainFinal[0]);
    const nearest = data.reduce((prev, curr) =>
      Math.abs(curr.x - domainX) < Math.abs(prev.x - domainX) ? curr : prev
    );
    const pixelX = ((nearest.x - xDomainFinal[0]) / (xDomainFinal[1] - xDomainFinal[0])) * w;
    const pixelY = ((yDomainFinal[1] - nearest.y) / (yDomainFinal[1] - yDomainFinal[0])) * height;
    activeXPos.value = pixelX;
    activeYPos.value = pixelY;
    const label = tooltipFormatter
      ? tooltipFormatter(nearest)
      : String(Math.round(nearest.y * 10) / 10);
    notifyChartActive(chartId);
    setActiveLabel(label);
  };

  // CartesianChart (victory-native) uses standard math coordinates: y=0 at bottom, y increases upward.
  // Callers provide values where high metric = high y = near top of chart.
  const chartData = data as { x: number; y: number }[];

  return (
    <View className={className || 'relative w-full'} style={{ marginTop }}>
      <View
        style={{ height, position: 'relative' }}
        onLayout={(e) => {
          containerWidthRef.current = e.nativeEvent.layout.width;
        }}
      >
        <CartesianChart
          data={chartData}
          xKey="x"
          yKeys={['y']}
          domain={{ x: xDomainFinal, y: yDomainFinal }}
          padding={0}
          axisOptions={{
            lineColor: showGridLines ? (gridLineColor ?? theme.colors.border.light) : 'transparent',
            labelColor: 'transparent',
          }}
        >
          {({ points, chartBounds }) => (
            <>
              <Area
                points={points.y}
                y0={chartBounds.bottom}
                curveType={curveType}
                color={areaColorResolved}
              />
              <Line
                points={points.y}
                curveType={curveType}
                color={lineColorResolved}
                strokeWidth={lineWidth}
                strokeCap="round"
              />
              {showLastPoint && points.y.length > 0 ? (
                <>
                  <Scatter
                    points={points.y.slice(-1)}
                    radius={lastPointSize / 2 + lastPointStrokeWidth}
                    color={lastPointStrokeColor ?? theme.colors.background.card}
                    style="fill"
                  />
                  <Scatter
                    points={points.y.slice(-1)}
                    radius={lastPointSize / 2}
                    color={lineColorResolved}
                    style="fill"
                  />
                </>
              ) : null}
            </>
          )}
        </CartesianChart>
        {interactive ? (
          <View
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onStartShouldSetResponder={() => true}
            onResponderTerminationRequest={() => true}
            onResponderRelease={(e) => handleTouchAt(e.nativeEvent.locationX)}
          />
        ) : null}
        {interactive && activeLabel ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                cursorLineStyle,
                {
                  position: 'absolute',
                  width: 1,
                  top: 0,
                  bottom: 0,
                  backgroundColor: theme.colors.border.light,
                  opacity: 0.8,
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                activeDotStyle,
                {
                  position: 'absolute',
                  width: 12,
                  height: 12,
                  borderRadius: theme.borderRadius.full,
                  backgroundColor: lineColorResolved,
                  borderWidth: 2,
                  borderColor: theme.colors.background.card,
                },
              ]}
            />
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
                paddingVertical: theme.spacing.padding['1half'],
                shadowColor: theme.colors.text.black,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 4,
                zIndex: 10,
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
          </>
        ) : null}
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
              }}
            >
              {label}
            </Text>
          );
        })}
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
                  marginLeft:
                    label.positionPercent === 0 ? 20 : label.positionPercent === 100 ? -20 : 0,
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
