import { Text, View } from 'react-native';
import { CartesianChart, StackedBar } from 'victory-native';

import { useTheme } from '../../hooks/useTheme';
import { XAxisLabel } from '../../utils/chartUtils';

/** One bar: x plus up to 4 segment values (e.g. [coffee, chocolate, soda, iceCream]) */
export type StackedBarChartDatum = {
  x: number;
  segments: [number, number?, number?, number?];
};

export type StackedBarChartProps = {
  /** Array of data points; each has x and up to 4 segment values */
  data: StackedBarChartDatum[];
  /** Height of the chart in pixels (default: 192) */
  height?: number;
  /** Colors for each stack layer (default: theme-based; up to 4) */
  stackColors?: [string, string?, string?, string?];
  /** Padding between bars, 0–1 (default: 0.2) */
  innerPadding?: number;
  /** Whether to show grid lines (default: true) */
  showGridLines?: boolean;
  /** Color of grid lines (default: theme border light) */
  gridLineColor?: string;
  /** Custom X-axis domain [min, max] */
  xDomain?: [number, number];
  /** Custom Y-axis domain [min, max]; default [0, max total across bars] */
  yDomain?: [number, number];
  /** Custom X-axis labels below the chart */
  xAxisLabels?: XAxisLabel[];
  /** Y-axis labels overlaid on the chart */
  yAxisLabels?: { label: string; yDomainValue: number }[];
  /** Custom margin top (default: 16) */
  marginTop?: number;
  /** Custom margin bottom for X labels (default: 16) */
  marginBottom?: number;
  /** Optional total labels above each bar (e.g. "$19") */
  showTotalLabels?: boolean;
  /** Format total label (default: value as string) */
  totalLabelFormatter?: (total: number, datum: StackedBarChartDatum) => string;
  /** Custom className */
  className?: string;
  /** Domain padding (default: { left: 20, right: 20, top: 10 }) */
  domainPadding?: { left?: number; right?: number; top?: number; bottom?: number };
};

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#eab308', // yellow
  '#22c55e', // green
];

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
  showTotalLabels = false,
  totalLabelFormatter = (t) => String(Math.round(t)),
  className,
  domainPadding = { left: 20, right: 20, top: 10 },
}: StackedBarChartProps) {
  const theme = useTheme();

  if (data.length === 0) {
    return null;
  }

  const colors: string[] = [
    stackColors?.[0] ?? theme.colors.accent.primary ?? DEFAULT_COLORS[0],
    stackColors?.[1] ?? DEFAULT_COLORS[1],
    stackColors?.[2] ?? DEFAULT_COLORS[2],
    stackColors?.[3] ?? DEFAULT_COLORS[3],
  ];

  // victory-native StackedBar expects raw segment values; it handles stacking internally
  const chartData: { x: number; seg0: number; seg1: number; seg2: number; seg3: number }[] =
    data.map((d) => ({
      x: d.x,
      seg0: d.segments[0] ?? 0,
      seg1: d.segments[1] ?? 0,
      seg2: d.segments[2] ?? 0,
      seg3: d.segments[3] ?? 0,
    }));

  const xMin = xDomain?.[0] ?? Math.min(...data.map((d) => d.x));
  const xMax = xDomain?.[1] ?? Math.max(...data.map((d) => d.x));
  const xPadding = (xMax - xMin) / Math.max(data.length, 1);
  const xDomainMin = xMin - xPadding;
  const xDomainSpan = xMax - xMin + 2 * xPadding;
  const xLabelPosition = (index: number) => (data[index].x - xDomainMin) / xDomainSpan;

  const maxTotal = Math.max(
    ...data.map(
      (d) =>
        (d.segments[0] ?? 0) + (d.segments[1] ?? 0) + (d.segments[2] ?? 0) + (d.segments[3] ?? 0)
    ),
    1
  );
  const yMin = yDomain?.[0] ?? 0;
  const yMax = yDomain?.[1] ?? maxTotal;

  return (
    <View className={className} style={{ marginTop }}>
      <View style={{ height, position: 'relative' }}>
        <CartesianChart
          data={chartData}
          xKey="x"
          yKeys={['seg0', 'seg1', 'seg2', 'seg3']}
          domain={{ x: [xMin, xMax], y: [yMin, yMax] }}
          domainPadding={domainPadding}
          padding={0}
          axisOptions={{
            lineColor: showGridLines ? (gridLineColor ?? theme.colors.border.light) : 'transparent',
            labelColor: 'transparent',
          }}
        >
          {({ points, chartBounds }) => (
            <StackedBar
              points={[points.seg0, points.seg1, points.seg2, points.seg3]}
              chartBounds={chartBounds}
              innerPadding={innerPadding}
              colors={colors}
              barOptions={({ isTop }) =>
                isTop ? { roundedCorners: { topLeft: 4, topRight: 4 } } : {}
              }
            />
          )}
        </CartesianChart>

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
            marginTop: 8,
            height: 20,
            width: '100%',
          }}
        >
          {xAxisLabels.map((label, index) => (
            <View
              key={index}
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
    </View>
  );
}
