import type { MouseEvent } from 'react';
import { useEffect, useId, useState } from 'react';
import type { ViewProps } from 'react-native';
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

import { useChartTooltip } from '../../context/ChartTooltipContext';
import { useTheme } from '../../hooks/useTheme';
import { X_AXIS_LABEL_OFFSET, X_AXIS_LABEL_WIDTH, XAxisLabel } from '../../utils/chartUtils';

/** View props plus web mouse events (RN Web renders View as div and supports these) */
type ViewWithMouseProps = ViewProps & {
  onClick?: (e: MouseEvent<HTMLElement>) => void;
};

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
  xAxisLabels?: XAxisLabel[];
  yAxisLabels?: { label: string; yDomainValue: number }[];
  peak?: { seriesKey: string; pointIndex: number; label?: string };
  showGridLines?: boolean;
  gridLineColor?: string;
  areaOpacity?: number;
  marginTop?: number;
  marginBottom?: number;
  className?: string;
  /** Enable touch/hover interaction to show a tooltip (default: true) */
  interactive?: boolean;
  /** Format the tooltip label for a given data point (default: shows rounded y values) */
  tooltipFormatter?: (point: AreaChartDatum) => string;
};

const TOOLTIP_WIDTH = 120;
const TOOLTIP_HEIGHT = 56;

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
  marginBottom = 8,
  className,
  interactive = true,
  tooltipFormatter,
}: AreaChartProps) {
  const theme = useTheme();
  const chartId = useId();
  const { registerChart, unregisterChart, notifyChartActive } = useChartTooltip();
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  useEffect(() => {
    registerChart(chartId, () => setActiveLabel(null));
    return () => unregisterChart(chartId);
  }, [chartId]);

  if (data.length === 0 || series.length === 0) {
    return null;
  }

  const xDomainFinal: [number, number] = xDomain ?? [data[0].x, data[data.length - 1].x];
  const xAxisGap = 0;
  // Web: tight gap between chart and x-axis labels; marginBottom not used for this
  const gapChartToLabels = 2;
  const chartHeight = height - gapChartToLabels - xAxisGap;
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

  // Web: minimal top/bottom padding so chart uses card space
  const padding = { top: 0, bottom: 0, left: 20, right: 20 };
  const yTickValues = yAxisLabels?.map((l) => l.yDomainValue) ?? [0, 25, 50, 75, 100];

  return (
    <View className={className} style={{ marginTop, width: '100%', minWidth: 320 }}>
      {title != null || subtitle != null ? (
        <View style={{ marginBottom: 0 }}>
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
              style={{ fontSize: theme.typography.fontSize.sm, marginTop: 0 }}
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
            <View style={{ display: 'contents' }}>
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
            </View>
          ) : null}

          <VictoryAxis
            style={{
              axis: { stroke: 'transparent' },
              grid: { stroke: 'transparent' },
              ticks: { stroke: 'transparent' },
              tickLabels: {
                fill: xAxisLabels != null && xAxisLabels.length > 0 ? 'transparent' : mutedColor,
                fontSize: 10,
                fontFamily: 'Inter, sans-serif',
              },
            }}
          />
        </VictoryChart>
        {interactive && (
          <View
            {...({
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                cursor: 'pointer',
                pointerEvents: 'auto',
              },
              onClick: (e: MouseEvent<HTMLElement>) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                const xValue = xDomainFinal[0] + ratio * (xDomainFinal[1] - xDomainFinal[0]);
                let nearest = data[0];
                let minDist = Math.abs(data[0].x - xValue);
                for (const d of data) {
                  const dist = Math.abs(d.x - xValue);
                  if (dist < minDist) {
                    minDist = dist;
                    nearest = d;
                  }
                }
                const label = tooltipFormatter
                  ? tooltipFormatter(nearest)
                  : series
                      .map((s) => `${s.label}: ${Math.round((nearest[s.key] ?? 0) * 10) / 10}`)
                      .join('\n');
                notifyChartActive(chartId);
                setActiveLabel(label);
              },
            } as ViewWithMouseProps)}
          />
        )}
        {interactive && activeLabel ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              minWidth: TOOLTIP_WIDTH,
              minHeight: TOOLTIP_HEIGHT,
              backgroundColor: theme.colors.background.card,
              borderRadius: theme.borderRadius.xs,
              paddingHorizontal: theme.spacing.padding.sm,
              paddingVertical: theme.spacing.padding.sm,
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              zIndex: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: theme.colors.text.primary,
                fontSize: theme.typography.fontSize.xxs,
                fontWeight: '600',
                textAlign: 'center',
                whiteSpace: 'pre-line',
              }}
            >
              {activeLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {xAxisLabels != null && xAxisLabels.length > 0 ? (
        <View
          style={{
            marginTop: xAxisGap,
            paddingLeft: padding.left,
            paddingRight: padding.right,
            height: 20,
            position: 'relative',
          }}
        >
          {xAxisLabels.map((label, index) => (
            <View
              key={`${label.label}-${index}`}
              style={{
                position: 'absolute',
                left: `calc(${padding.left}px + ${label.positionPercent} * (100% - ${padding.left + padding.right}px) / 100)` as any,
                width: X_AXIS_LABEL_WIDTH,
                transform: [{ translateX: -X_AXIS_LABEL_OFFSET }] as any,
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
                    label.positionPercent === 0 ? 10 : label.positionPercent === 100 ? -10 : 0,
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
          className="flex-row justify-around border-t border-border-default"
          style={{
            marginTop: 14,
            paddingTop: 10,
            paddingBottom: 10,
            paddingHorizontal: 12,
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
                  marginBottom: 0,
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
