import { Text, View } from 'react-native';
import { Bar, CartesianChart } from 'victory-native';

import { useTheme } from '../hooks/useTheme';

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
  xAxisLabels?: string[];
  /** Custom margin top for the chart container (default: 16) */
  marginTop?: number;
  /** Custom margin bottom for X-axis labels (default: 16) */
  marginBottom?: number;
  /** Custom className for the container */
  className?: string;
  /** Domain padding to prevent first/last bar from being clipped (default: { left: 20, right: 20, top: 10 }) */
  domainPadding?: { left?: number; right?: number; top?: number; bottom?: number };
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
  marginTop = 16,
  marginBottom = 16,
  className,
  domainPadding = { left: 20, right: 20, top: 10 },
}: BarChartProps) {
  const theme = useTheme();
  const barColorResolved = barColor ?? theme.colors.accent.primary;

  if (data.length === 0) {
    return null;
  }

  const xMin = xDomain?.[0] ?? Math.min(...data.map((d) => d.x));
  const xMax = xDomain?.[1] ?? Math.max(...data.map((d) => d.x));
  const yMin = yDomain?.[0] ?? 0;
  const yMax = yDomain?.[1] ?? Math.max(...data.map((d) => d.y), 1);

  const chartData = data as { x: number; y: number }[];

  return (
    <View className={className || 'relative w-full'} style={{ marginTop }}>
      <View style={{ height, position: 'relative' }}>
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
      </View>
      {xAxisLabels && xAxisLabels.length > 0 ? (
        <View className="mt-4 flex-row justify-between px-1" style={{ marginTop: marginBottom }}>
          {xAxisLabels.map((label, index) => (
            <Text key={index} className="text-[10px] font-medium text-text-tertiary">
              {label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
