import { useEffect, useId, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Bar, CartesianChart } from 'victory-native';

import { useChartTooltip } from '../../context/ChartTooltipContext';
import { useFormatAppNumber } from '../../hooks/useFormatAppNumber';
import { useTheme } from '../../hooks/useTheme';
import { XAxisLabel } from '../../utils/chartUtils';

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
  /** Enable touch interaction to show a tooltip on press (default: true) */
  interactive?: boolean;
  /** Format the tooltip label for a given data point (default: shows rounded y value) */
  tooltipFormatter?: (point: BarChartDataPoint) => string;
  /** Called when the user starts touching the chart — use to disable parent ScrollView */
  onInteractionStart?: () => void;
  /** Called when the user stops touching the chart — use to re-enable parent ScrollView */
  onInteractionEnd?: () => void;
};

const TOOLTIP_WIDTH = 90;
const TOOLTIP_HEIGHT = 36;

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
  domainPadding = { left: 20, right: 20, top: 10 },
  interactive = true,
  tooltipFormatter,
  onInteractionStart,
  onInteractionEnd,
}: BarChartProps) {
  const theme = useTheme();
  const chartId = useId();
  const { registerChart, unregisterChart, notifyChartActive, tooltipPosition } = useChartTooltip();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const containerWidthRef = useRef(0);

  useEffect(() => {
    registerChart(chartId, () => setActiveLabel(null));
    return () => unregisterChart(chartId);
  }, [chartId, registerChart, unregisterChart]);

  const { formatRoundedDecimal } = useFormatAppNumber();

  if (data.length === 0) {
    return null;
  }

  const xMin = xDomain?.[0] ?? Math.min(...data.map((d) => d.x));
  const xMax = xDomain?.[1] ?? Math.max(...data.map((d) => d.x));
  const yMin = yDomain?.[0] ?? 0;
  const yMax = yDomain?.[1] ?? Math.max(...data.map((d) => d.y), 1);

  const handleTouchAt = (touchX: number) => {
    const w = containerWidthRef.current;
    if (w === 0) {
      return;
    }
    const domainX = xMin + (touchX / w) * (xMax - xMin);
    const nearest = data.reduce((prev, curr) =>
      Math.abs(curr.x - domainX) < Math.abs(prev.x - domainX) ? curr : prev
    );
    const label = tooltipFormatter ? tooltipFormatter(nearest) : formatRoundedDecimal(nearest.y, 1);
    notifyChartActive(chartId);
    setActiveLabel(label);
  };

  const barColorResolved = barColor ?? theme.colors.accent.primary;
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
          domain={{ x: [xMin, xMax], y: [yMin, yMax] }}
          domainPadding={domainPadding}
          padding={0}
          axisOptions={{
            lineColor: showGridLines ? (gridLineColor ?? theme.colors.border.light) : 'transparent',
            labelColor: 'transparent',
          }}
        >
          {({ points, chartBounds }) => (
            <Bar
              points={points.y}
              chartBounds={chartBounds}
              color={barColorResolved}
              innerPadding={innerPadding}
              roundedCorners={{
                topLeft: roundedCornerRadius,
                topRight: roundedCornerRadius,
              }}
            />
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
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 6,
              ...(tooltipPosition === 'left' ? { left: 6 } : { right: 6 }),
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
        ) : null}
        {yAxisLabels?.map(({ label, yDomainValue }, i) => {
          const yRange = yMax - yMin;
          const topOffset = (1 - (yDomainValue - yMin) / yRange) * height;
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
