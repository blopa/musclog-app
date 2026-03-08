import React from 'react';
import { Text, View } from 'react-native';
import {
  VictoryArea,
  VictoryAxis,
  VictoryChart,
  VictoryGroup,
  VictoryLabel,
  VictoryLine,
  VictoryScatter,
} from 'victory';

import { useTheme } from '../hooks/useTheme';

export type AreaChartDatum = { x: number; [key: string]: number };

export type AreaChartSeriesConfig = {
  key: string;
  label: string;
  color: string;
  value?: string;
};

export type AreaChartProps = {
  title?: string;
  subtitle?: string;
  data: AreaChartDatum[];
  series: AreaChartSeriesConfig[];
  height?: number;
  xDomain?: [number, number];
  yDomain?: [number, number];
  xAxisLabels?: string[];
  yAxisLabels?: { label: string; yDomainValue: number }[];
  peak?: { seriesKey: string; pointIndex: number; label?: string };
  showGridLines?: boolean;
  gridLineColor?: string;
  areaOpacity?: number;
  marginTop?: number;
  marginBottom?: number;
  className?: string;
};

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function AreaChart({
  title,
  subtitle,
  data,
  series,
  height = 280,
  xDomain,
  yDomain = [0, 100],
  xAxisLabels,
  yAxisLabels,
  peak,
  showGridLines = true,
  gridLineColor,
  areaOpacity = 0.35,
  marginTop = 8,
  marginBottom = 12,
  className,
}: AreaChartProps) {
  const theme = useTheme();

  if (data.length === 0 || series.length === 0) {
    return null;
  }

  const xDomainFinal: [number, number] = xDomain ?? [data[0].x, data[data.length - 1].x];
  const xAxisGap = 6;
  const chartHeight = height - marginBottom - xAxisGap;
  const gridColor = gridLineColor ?? theme.colors.border.light;
  const mutedColor = theme.colors.text.tertiary ?? '#7E8A87';

  const peakSeries = peak ? series.find((s) => s.key === peak.seriesKey) : null;
  const peakDatum =
    peak && peakSeries && data[peak.pointIndex]
      ? {
          x: data[peak.pointIndex].x,
          y: (data[peak.pointIndex] as Record<string, number>)[peak.seriesKey],
        }
      : null;

  // Tighter, symmetric padding so the chart uses the card space well
  const padding = { top: 12, bottom: 20, left: 24, right: 24 };
  const yTickValues = yAxisLabels?.map((l) => l.yDomainValue) ?? [0, 25, 50, 75, 100];

  return (
    <View className={className} style={{ marginTop, width: '100%', minWidth: 320 }}>
      {title != null || subtitle != null ? (
        <View style={{ marginBottom: 8 }}>
          {title != null ? (
            <Text
              className="text-xl font-semibold text-text-primary"
              style={{ fontSize: theme.typography.fontSize.xl }}
            >
              {title}
            </Text>
          ) : null}
          {subtitle != null ? (
            <Text
              className="mt-0.5 text-sm text-text-secondary"
              style={{ fontSize: theme.typography.fontSize.sm, marginTop: 2 }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ width: '100%', height, minHeight: 220 }}>
        <VictoryChart
          height={chartHeight}
          padding={padding}
          domain={{ x: xDomainFinal, y: yDomain }}
          domainPadding={{ x: 10, y: 0 }}
          style={{
            parent: {
              width: '100%',
              height: chartHeight,
            },
          }}
        >
          {showGridLines ? (
            <VictoryAxis
              dependentAxis
              tickValues={yTickValues}
              style={{
                axis: { stroke: 'transparent' },
                grid: {
                  stroke: gridColor,
                  strokeWidth: 1,
                  opacity: 0.5,
                },
                ticks: { stroke: 'transparent' },
                tickLabels: {
                  fill: mutedColor,
                  fontSize: 10,
                  fontFamily: 'Inter, sans-serif',
                },
              }}
            />
          ) : null}

          {series.map((s, idx) => {
            const seriesData = data.map((d) => ({
              x: d.x,
              y: (d as Record<string, number>)[s.key] ?? 0,
            }));
            const fillColor = hexToRgba(s.color, areaOpacity);
            return (
              <VictoryGroup key={s.key}>
                <VictoryArea
                  data={seriesData}
                  interpolation="monotoneX"
                  style={{
                    data: {
                      fill: fillColor,
                      stroke: s.color,
                      strokeWidth: idx === series.length - 1 ? 2.5 : 2,
                    },
                  }}
                />
                <VictoryLine
                  data={seriesData}
                  interpolation="monotoneX"
                  style={{
                    data: {
                      stroke: s.color,
                      strokeWidth: idx === series.length - 1 ? 2.5 : 2,
                      strokeLinecap: 'round',
                    },
                  }}
                />
              </VictoryGroup>
            );
          })}

          {peakDatum != null ? (
            <>
              <VictoryScatter
                data={[peakDatum]}
                size={8}
                style={{
                  data: {
                    fill: theme.colors.text.white,
                  },
                }}
              />
              {peak?.label != null ? (
                <VictoryScatter
                  data={[peakDatum]}
                  size={0}
                  labels={[peak.label]}
                  labelComponent={
                    <VictoryLabel
                      dy={-18}
                      style={{
                        fill: theme.colors.background.primary,
                        fontSize: 9,
                        fontWeight: 'bold',
                        fontFamily: 'Inter, sans-serif',
                      }}
                      backgroundStyle={{
                        fill: theme.colors.text.white,
                        rx: 4,
                        ry: 4,
                      }}
                      backgroundPadding={{ top: 4, bottom: 4, left: 8, right: 8 }}
                    />
                  }
                />
              ) : null}
            </>
          ) : null}

          <VictoryAxis
            style={{
              axis: { stroke: 'transparent' },
              grid: { stroke: 'transparent' },
              ticks: { stroke: 'transparent' },
              tickLabels: {
                fill: mutedColor,
                fontSize: 10,
                fontFamily: 'Inter, sans-serif',
              },
            }}
          />
        </VictoryChart>
      </View>

      {xAxisLabels != null && xAxisLabels.length > 0 ? (
        <View
          className="flex-row justify-between px-1"
          style={{
            marginTop: xAxisGap,
            paddingLeft: 24,
            paddingRight: 24,
          }}
        >
          {xAxisLabels.map((label, index) => (
            <Text key={index} className="text-[10px] font-medium text-text-tertiary">
              {label}
            </Text>
          ))}
        </View>
      ) : null}

      {series.length > 0 ? (
        <View
          className="flex-row justify-around border-t border-border-default"
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopColor: theme.colors.border.light,
            borderTopWidth: 1,
          }}
        >
          {series.map((s, idx) => (
            <View
              key={s.key}
              style={{
                flex: 1,
                alignItems: 'center',
                borderLeftWidth: idx === 0 ? 0 : 1,
                borderRightWidth: idx === series.length - 1 ? 0 : 1,
                borderColor: theme.colors.border.light,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: s.color,
                  }}
                />
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xxs,
                    color: theme.colors.text.tertiary,
                    textTransform: 'uppercase',
                  }}
                >
                  {s.label}
                </Text>
              </View>
              {s.value != null ? (
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: '700',
                    color: theme.colors.text.primary,
                  }}
                >
                  {s.value}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
