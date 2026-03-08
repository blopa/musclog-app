import { useState } from 'react';
import { Text, View } from 'react-native';
import { CartesianChart, Line } from 'victory-native';

import { useTheme } from '../hooks/useTheme';

/** Map chart points to victory-native PointsArray (includes xValue, yValue) */
function toPointsArray(
  pts: { x: number; y: number }[]
): { x: number; y: number; xValue: number; yValue: number }[] {
  return pts.map((p) => ({ x: p.x, y: p.y, xValue: p.x, yValue: p.y }));
}

/** One data point: x plus one value per series key (e.g. active, resting) */
export type MultipleLinesChartDatum = { x: number; [key: string]: number };

/** Config for each line: key in data, label in legend, color, optional legend value (e.g. "2,450 kcal"), optional dashed */
export type MultipleLinesChartSeriesConfig = {
  key: string;
  label: string;
  color: string;
  /** Optional value shown in legend (e.g. "2,450 kcal") */
  value?: string;
  /** Draw line as dashed (default: false) */
  dashed?: boolean;
};

/** Callout label at a specific data point */
export type MultipleLinesChartCallout = {
  seriesKey: string;
  pointIndex: number;
  label: string;
};

export type MultipleLinesChartProps = {
  /** Chart title */
  title?: string;
  /** Chart subtitle */
  subtitle?: string;
  /** Data points; each has x and one numeric value per series key (max 4 series) */
  data: MultipleLinesChartDatum[];
  /** Series definitions, max 4 (order = draw order) */
  series: MultipleLinesChartSeriesConfig[];
  /** Height of the chart in pixels (default: 256) */
  height?: number;
  /** X domain [min, max] (default: from data) */
  xDomain?: [number, number];
  /** Y domain [min, max] (default: [0, 100]) */
  yDomain?: [number, number];
  /** X-axis labels below the chart */
  xAxisLabels?: string[];
  /** Y-axis labels on the left */
  yAxisLabels?: { label: string; yDomainValue: number }[];
  /** Optional callout labels at specific series/point indices */
  callouts?: MultipleLinesChartCallout[];
  /** Whether to show grid lines (default: true) */
  showGridLines?: boolean;
  /** Grid line color (default: theme border) */
  gridLineColor?: string;
  /** Line stroke width (default: 3) */
  lineWidth?: number;
  /** Custom margin top (default: 16) */
  marginTop?: number;
  /** Custom margin bottom for X labels (default: 16) */
  marginBottom?: number;
  /** Custom className */
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

  const yKeys = series.slice(0, 4).map((s) => s.key);
  const xDomainFinal: [number, number] = xDomain ?? [data[0].x, data[data.length - 1].x];
  const yDomainFinal = yDomain;
  const yRange = yDomainFinal[1] - yDomainFinal[0] || 1;
  const gridColor = gridLineColor ?? theme.colors.border.light;

  const chartData = data as Record<string, number>[];

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
          <CartesianChart
            data={chartData}
            xKey="x"
            yKeys={yKeys}
            domain={{ x: xDomainFinal, y: yDomainFinal }}
            padding={0}
            domainPadding={{ left: 0, right: 0, top: 10, bottom: 0 }}
            axisOptions={{
              lineColor: showGridLines ? gridColor : 'transparent',
              labelColor: 'transparent',
            }}
          >
            {({ points }) => {
              const ptsMap = points as Record<string, { x: number; y: number }[]>;
              return (
                <>
                  {series.slice(0, 4).map((s) => {
                    const pts = ptsMap[s.key];
                    if (!pts || pts.length === 0) {
                      return null;
                    }
                    return (
                      <Line
                        key={s.key}
                        points={toPointsArray(pts)}
                        curveType="monotoneX"
                        color={s.color}
                        strokeWidth={lineWidth}
                        strokeCap="round"
                      />
                    );
                  })}
                </>
              );
            }}
          </CartesianChart>
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
          const pixelY =
            (1 - (yVal - yDomainFinal[0]) / yRange) * (height - marginBottom - 16) -
            CALLOUT_HEIGHT -
            4;
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
          className="flex-row justify-between px-1"
          style={{
            marginTop: 8,
            marginBottom: marginBottom,
            paddingLeft: 32,
            paddingRight: 0,
          }}
        >
          {xAxisLabels.map((label, index) => (
            <Text key={index} className="text-[11px] font-medium text-text-tertiary">
              {label}
            </Text>
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
