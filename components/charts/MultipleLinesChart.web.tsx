import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { VictoryAxis, VictoryChart, VictoryLine } from 'victory';

import { useTheme } from '../../hooks/useTheme';
import { XAxisLabel } from '../../utils/chartUtils';

export type MultipleLinesChartDatum = { x: number; [key: string]: number };

export type MultipleLinesChartSeriesConfig = {
  key: string;
  label: string;
  color: string;
  value?: string;
  dashed?: boolean;
};

export type MultipleLinesChartCallout = {
  seriesKey: string;
  pointIndex: number;
  label: string;
};

export type MultipleLinesChartProps = {
  title?: string;
  subtitle?: string;
  data: MultipleLinesChartDatum[];
  series: MultipleLinesChartSeriesConfig[];
  height?: number;
  xDomain?: [number, number];
  yDomain?: [number, number];
  xAxisLabels?: XAxisLabel[];
  yAxisLabels?: { label: string; yDomainValue: number }[];
  callouts?: MultipleLinesChartCallout[];
  showGridLines?: boolean;
  gridLineColor?: string;
  lineWidth?: number;
  marginTop?: number;
  marginBottom?: number;
  className?: string;
};

const CALLOUT_WIDTH = 44;
const CALLOUT_HEIGHT = 28;

export function MultipleLinesChart({
  title,
  subtitle,
  data,
  series,
  height = 256,
  xDomain,
  yDomain = [0, 100],
  xAxisLabels,
  yAxisLabels,
  callouts = [],
  showGridLines = true,
  gridLineColor,
  lineWidth = 3,
  marginTop = 16,
  marginBottom = 16,
  className,
}: MultipleLinesChartProps) {
  const theme = useTheme();
  const [chartWidth, setChartWidth] = useState(0);

  if (data.length === 0 || series.length === 0) {
    return null;
  }

  const xDomainFinal: [number, number] = xDomain ?? [data[0].x, data[data.length - 1].x];
  const yDomainFinal = yDomain;
  const yRange = yDomainFinal[1] - yDomainFinal[0] || 1;
  const chartHeight = height - marginBottom - 16;
  const gridColor = gridLineColor ?? theme.colors.border.light;

  return (
    <View className={className} style={{ marginTop }}>
      {title != null || subtitle != null ? (
        <View className="mb-6">
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

      <View style={{ height, position: 'relative' }}>
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
          }}
          onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
        >
          <VictoryChart
            height={height}
            padding={{ left: 0, right: 0, top: 0, bottom: 0 }}
            domain={{ x: xDomainFinal, y: yDomainFinal }}
            style={{ parent: { height, width: '100%' } }}
          >
            {showGridLines ? (
              <VictoryAxis
                dependentAxis
                style={{
                  axis: { stroke: 'transparent' },
                  grid: {
                    stroke: gridColor,
                    strokeWidth: 1,
                    opacity: 0.5,
                  },
                  ticks: { stroke: 'transparent' },
                  tickLabels: { fill: 'transparent' },
                }}
                tickValues={yAxisLabels?.map((l) => l.yDomainValue) ?? [0, 25, 50, 75, 100]}
              />
            ) : null}
            {series.slice(0, 4).map((s) => {
              const seriesData = data.map((d) => ({
                x: d.x,
                y: (d as Record<string, number>)[s.key] ?? 0,
              }));
              return (
                <VictoryLine
                  key={s.key}
                  data={seriesData}
                  interpolation="monotoneX"
                  style={{
                    data: {
                      stroke: s.color,
                      strokeWidth: lineWidth,
                      strokeLinecap: 'round',
                      strokeLinejoin: 'round',
                      strokeDasharray: s.dashed ? '4,4' : undefined,
                    },
                  }}
                />
              );
            })}
            <VictoryAxis
              style={{
                axis: { stroke: 'transparent' },
                grid: { stroke: 'transparent' },
                ticks: { stroke: 'transparent' },
                tickLabels: { fill: 'transparent' },
              }}
            />
          </VictoryChart>
        </View>

        {callouts.map((callout, idx) => {
          const datum = data[callout.pointIndex];
          if (!datum) {
            return null;
          }
          const yVal = (datum as Record<string, number>)[callout.seriesKey];
          if (yVal == null) {
            return null;
          }
          const dataX = datum.x;
          const pixelX =
            32 +
            ((dataX - xDomainFinal[0]) / (xDomainFinal[1] - xDomainFinal[0] || 1)) * chartWidth -
            CALLOUT_WIDTH / 2;
          const pixelY = (1 - (yVal - yDomainFinal[0]) / yRange) * chartHeight - CALLOUT_HEIGHT - 4;
          return (
            <View
              key={idx}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: Math.max(8, Math.min(pixelX, 32 + chartWidth - CALLOUT_WIDTH - 8)),
                top: Math.max(0, pixelY),
                width: CALLOUT_WIDTH,
                height: CALLOUT_HEIGHT,
                backgroundColor: theme.colors.text.white,
                borderRadius: theme.borderRadius.sm,
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
                  fontSize: 10,
                  fontWeight: '700',
                  color: theme.colors.background.primary,
                }}
              >
                {callout.label}
              </Text>
            </View>
          );
        })}
      </View>

      {xAxisLabels != null && xAxisLabels.length > 0 ? (
        <View
          style={{
            marginTop: 8,
            marginBottom: marginBottom,
            paddingLeft: 32,
            height: 20,
            position: 'relative',
          }}
        >
          {xAxisLabels.map((label, index) => (
            <View
              key={index}
              style={{
                position: 'absolute',
                left: `calc(32px + ${label.positionPercent}% * (100% - 32px) / 100)`,
                width: 40,
                transform: [{ translateX: -20 }],
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '500',
                  color: theme.colors.text.tertiary,
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {label.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {series.length > 0 ? (
        <View
          className="flex-row items-center justify-around border-t border-border-default pt-6"
          style={{
            borderTopColor: theme.colors.border.light,
            borderTopWidth: 1,
          }}
        >
          {series.slice(0, 4).map((s) => (
            <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 24,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: s.color,
                }}
              />
              <View>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xxs,
                    color: theme.colors.text.tertiary,
                    textTransform: 'uppercase',
                    letterSpacing: -0.5,
                  }}
                >
                  {s.label}
                </Text>
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
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
