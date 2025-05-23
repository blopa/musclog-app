import { MaterialIcons } from '@expo/vector-icons';
import React, { ReactNode, useCallback, useRef } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { BarChart as OriginalBarChart } from 'react-native-charts-wrapper';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { processColor } from 'react-native-reanimated';
import Share from 'react-native-share';
import ViewShot from 'react-native-view-shot';

import { FAB_ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';

interface BarChartProps {
    data: {
        label: string;
        values: { marker: string; x: number; y: number }[];
    }[];
    extraInfo?: ReactNode;
    granularity?: number;
    labelLeftMargin?: number;
    labels: string[];
    padding?: number;
    shareButtonPosition?: 'bottom' | 'top';
    showShareImageButton?: boolean;
    title: string;
    xAxisLabel: string;
    yAxis: { axisMaximum: number; axisMinimum: number };
    yAxisLabel: string;
}

const BarChart: React.FC<BarChartProps> = ({
    data,
    extraInfo,
    granularity = 1,
    labelLeftMargin = -30,
    labels,
    padding = 16,
    shareButtonPosition = 'bottom',
    showShareImageButton = true,
    title,
    xAxisLabel,
    yAxis,
    yAxisLabel,
}) => {
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);
    const chartRef = useRef(null);

    const shareChart = useCallback(async () => {
        try {
            const uri = await (chartRef.current as any)?.capture?.();
            if (!uri) {
                return;
            }

            await Share.open({ url: uri });
        } catch (error) {
            console.error('Error sharing chart image:', error);
        }
    }, []);

    return (
        <View style={[styles.chartContainer, { width: Dimensions.get('window').width - (padding * 2) }]}>
            <Text style={styles.chartTitle}>
                {title}
            </Text>
            <ViewShot
                options={{ format: 'png', quality: 1.0 }}
                ref={chartRef}
                style={{
                    backgroundColor: colors.surface,
                    paddingHorizontal: 12,
                }}
            >
                <View style={styles.chartWrapper}>
                    <Text style={[styles.yAxisLabel, { left: labelLeftMargin }]}>
                        {yAxisLabel}
                    </Text>
                    <OriginalBarChart
                        chartDescription={{ text: '' }}
                        data={{
                            dataSets: data.map((dataset) => ({
                                config: {
                                    barShadowColor: processColor(colors.background),
                                    color: processColor(colors.primaryContainer),
                                    drawValues: false,
                                },
                                label: dataset.label,
                                values: dataset.values.map(({ marker, x, y }) => ({ marker, x, y })),
                            })),
                        }}
                        doubleTapToZoomEnabled={false}
                        dragEnabled={false}
                        highlightPerDragEnabled={false}
                        highlightPerTapEnabled={true}
                        legend={{
                            enabled: true,
                            textColor: processColor(colors.onSurface),
                        }}
                        marker={{
                            enabled: true,
                            markerColor: processColor(colors.surface),
                            textColor: processColor(colors.onSurface),
                            textSize: 14,
                        }}
                        pinchZoom={false}
                        scaleXEnabled={false}
                        scaleYEnabled={false}
                        style={styles.chart}
                        touchEnabled={true}
                        xAxis={{
                            granularity,
                            granularityEnabled: true,
                            labelCount: labels.length,
                            labelRotationAngle: 45,
                            position: 'BOTTOM',
                            textColor: processColor(colors.onSurface),
                            valueFormatter: labels,
                        }}
                        yAxis={{
                            left: {
                                axisMaximum: yAxis.axisMaximum,
                                axisMinimum: yAxis.axisMinimum,
                                drawGridLines: false,
                                textColor: processColor(colors.onSurface),
                            },
                            right: {
                                enabled: false,
                            },
                        }}
                    />
                </View>
            </ViewShot>
            <Text style={styles.xAxisLabel}>{xAxisLabel}</Text>
            {showShareImageButton ? (
                <IconButton
                    icon={() => <MaterialIcons color={colors.primary} name="share" size={FAB_ICON_SIZE} />}
                    onPress={shareChart}
                    style={[
                        styles.shareButton,
                        shareButtonPosition === 'top' ? styles.sharePositionTop : styles.sharePositionBottom,
                    ]}
                />
            ) : null}
            {extraInfo ? (
                <View style={styles.extraInfoWrapper}>
                    {extraInfo}
                </View>
            ) : null}
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    chart: {
        height: 200,
        marginVertical: 8,
        width: Dimensions.get('window').width - 64,
    },
    chartContainer: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        marginVertical: 16,
        padding: 16,
    },
    chartTitle: {
        color: colors.onSurface,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    chartWrapper: {
        alignItems: 'center',
        flexDirection: 'row',
        paddingLeft: 15,
    },
    extraInfoWrapper: {
        alignItems: 'center',
        marginBottom: 16,
    },
    shareButton: {
        position: 'absolute',
        right: 10,
    },
    sharePositionBottom: { bottom: 6 },
    sharePositionTop: { top: 10 },
    xAxisLabel: {
        color: colors.onBackground,
        fontSize: 14,
    },
    yAxisLabel: {
        color: colors.onBackground,
        fontSize: 14,
        position: 'absolute',
        transform: [{ rotate: '-90deg' }],
    },
});

export default BarChart;
