import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { VictoryArea, VictoryAxis, VictoryChart, VictoryLine, VictoryScatter } from 'victory';

import { useTheme } from '../hooks/useTheme';

const PEAK_MARKER_R = 4;

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
  height = 256,
  xDomain,
  yDomain = [0, 100],
  xAxisLabels,
  yAxisLabels,
  peak,
  showGridLines = true,
  gridLineColor,
  areaOpacity = 0.35,
  marginTop = 16,
  marginBottom = 16,
  className,
}: AreaChartProps) {
  const theme = useTheme();
  const [chartWidth, setChartWidth] = useState(0);

  if (data.length === 0 || series.length === 0) {
    return null;
  }

  const xDomainFinal: [number, number] = xDomain ?? [data[0].x, data[data.length - 1].x];
  const chartHeight = height - marginBottom - 16;
  const gridColor = gridLineColor ?? theme.colors.border.light;

  const peakSeries = peak ? series.find((s) => s.key === peak.seriesKey) : null;
  const peakDatum =
    peak && peakSeries && data[peak.pointIndex]
      ? {
          x: data[peak.pointIndex].x,
          y: (data[peak.pointIndex] as Record<string, number>)[peak.seriesKey],
        }
      : null;

  return (
    <View className={className} style={{ marginTop }}>
      {title != null || subtitle != null ? (
        <View className="mb-4">
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

      <View style={{ height, position: 'relative', width: '100%' }}>
        {yAxisLabels != null && yAxisLabels.length > 0 ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: marginBottom + 16,
              width: 28,
              justifyContent: 'space-between',
              zIndex: 2,
            }}
          >
            {yAxisLabels.map(({ label }) => (
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
        ) : null}

        <View
          style={{
            position: 'absolute',
            left: 32,
            right: 0,
            top: 0,
            bottom: marginBottom + 16,
            minWidth: 200,
          }}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) {
              setChartWidth(w);
            }
          }}
        >
          {chartWidth > 0 ? (
            <VictoryChart
              width={chartWidth}
              height={chartHeight}
              padding={{ left: 0, right: 0, top: 0, bottom: 0 }}
              domain={{ x: xDomainFinal, y: yDomain }}
              domainPadding={{ x: 0, y: 0 }}
              style={{
                parent: {
                  width: chartWidth,
                  height: chartHeight,
                },
              }}
            >
              {showGridLines ? (
                <VictoryAxis
                  dependentAxis
                  style={{
                    axis: { stroke: 'transparent' },
                    grid: {
                      stroke: gridColor,
                      strokeWidth: 1,
                      opacity: 0.3,
                    },
                    ticks: { stroke: 'transparent' },
                    tickLabels: { fill: 'transparent' },
                  }}
                  tickValues={yAxisLabels?.map((l) => l.yDomainValue) ?? [0, 25, 50, 75, 100]}
                />
              ) : null}
              {series.map((s, idx) => {
                const seriesData = data.map((d) => ({
                  x: d.x,
                  y: (d as Record<string, number>)[s.key] ?? 0,
                }));
                const fillColor = hexToRgba(s.color, areaOpacity);
                return (
                  <React.Fragment key={s.key}>
                    <VictoryArea
                      data={seriesData}
                      interpolation="monotoneX"
                      style={{
                        data: {
                          fill: fillColor,
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
                  </React.Fragment>
                );
              })}
              {peakDatum != null ? (
                <VictoryScatter
                  data={[peakDatum]}
                  size={8}
                  style={{
                    data: {
                      fill: theme.colors.text.white,
                    },
                  }}
                />
              ) : null}
              <VictoryAxis
                style={{
                  axis: { stroke: 'transparent' },
                  grid: { stroke: 'transparent' },
                  ticks: { stroke: 'transparent' },
                  tickLabels: { fill: 'transparent' },
                }}
              />
            </VictoryChart>
          ) : null}
        </View>

        {peak != null && peak.label != null && peakDatum != null && chartWidth > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left:
                32 +
                ((peakDatum.x - xDomainFinal[0]) / (xDomainFinal[1] - xDomainFinal[0] || 1)) *
                  chartWidth -
                20,
              top: 0,
              width: 40,
              height: 24,
              backgroundColor: theme.colors.text.white,
              borderRadius: theme.borderRadius.xs,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: theme.colors.text.black,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 4,
              zIndex: 10,
            }}
          >
            <Text
              style={{
                fontSize: 9,
                fontWeight: '700',
                color: theme.colors.background.primary,
              }}
            >
              {peak.label}
            </Text>
          </View>
        ) : null}
      </View>

      {xAxisLabels != null && xAxisLabels.length > 0 ? (
        <View
          className="flex-row justify-between px-1"
          style={{
            marginTop: marginBottom,
            paddingLeft: 32,
            paddingRight: 0,
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
          className="mt-6 flex-row justify-around border-t border-border-default pt-6"
          style={{
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
