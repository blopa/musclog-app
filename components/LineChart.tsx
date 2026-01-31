import React from 'react';
import { Text, View } from 'react-native';
import { VictoryArea, VictoryAxis, VictoryChart, VictoryLine, VictoryScatter } from 'victory';

import { theme } from '../theme';

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
  lineColor = theme.colors.accent.primary,
  areaColor = theme.colors.accent.primary30,
  lineWidth = 3,
  showLastPoint = true,
  lastPointSize = 10,
  lastPointStrokeColor = theme.colors.background.card,
  lastPointStrokeWidth = 2,
  xDomain,
  yDomain,
  interpolation = 'monotoneX',
  showGridLines = true,
  gridLineColor = theme.colors.border.light,
  gridTickValues,
  xAxisLabels,
  marginTop = 16,
  marginBottom = 16,
  className,
}: LineChartProps) {
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
                stroke: gridLineColor,
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
              fill: areaColor,
            },
          }}
        />
        {/* Line */}
        <VictoryLine
          data={data}
          interpolation={interpolation}
          style={{
            data: {
              stroke: lineColor,
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
                fill: lineColor,
                stroke: lastPointStrokeColor,
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
      {/* Custom X-axis labels */}
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
