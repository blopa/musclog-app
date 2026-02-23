import { Text, View } from 'react-native';
import { Area, CartesianChart, Line, Scatter } from 'victory-native';

import { useTheme } from '../hooks/useTheme';

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
  xAxisLabels?: string[];
  /** Custom margin top for the chart container (default: 16) */
  marginTop?: number;
  /** Custom margin bottom for X-axis labels (default: 16) */
  marginBottom?: number;
  /** Custom className for the container */
  className?: string;
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
  lastPointStrokeColor, // TODO: use this
  lastPointStrokeWidth = 2, // TODO: use this
  xDomain,
  yDomain,
  interpolation = 'monotoneX',
  showGridLines = true,
  gridLineColor,
  xAxisLabels,
  marginTop = 16,
  marginBottom = 16,
  className,
}: LineChartProps) {
  const theme = useTheme();

  if (data.length === 0) {
    return null;
  }

  const xDomainFinal = xDomain ?? [0, chartWidth];
  const yDomainFinal = yDomain ?? [0, chartHeight];
  const curveType = INTERPOLATION_TO_CURVE[interpolation];
  const lineColorResolved = lineColor ?? theme.colors.accent.primary;
  const areaColorResolved = areaColor ?? theme.colors.accent.primary30;

  // CartesianChart expects data with x and y keys; our data already has that shape
  const chartData = data as { x: number; y: number }[];

  return (
    <View className={className || 'relative w-full'} style={{ marginTop }}>
      <View style={{ height }}>
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
          {({ points }) => (
            <>
              <Area
                points={points.y}
                y0={yDomainFinal[0]}
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
                <Scatter
                  points={points.y.slice(-1)}
                  radius={lastPointSize / 2}
                  color={lineColorResolved}
                  style="fill"
                />
              ) : null}
            </>
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
