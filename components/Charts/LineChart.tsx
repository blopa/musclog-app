import { FAB_ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { MaterialIcons } from '@expo/vector-icons';
import React, { ReactNode, useCallback, useRef } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { LineChart as OriginalLineChart } from 'react-native-charts-wrapper';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { processColor } from 'react-native-reanimated';
import Share from 'react-native-share';
import ViewShot from 'react-native-view-shot';

interface LineChartProps {
    data: { marker: string; x: number; y: number }[];
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

const LineChart: React.FC<LineChartProps> = ({
    data,
    extraInfo,
    granularity = 3,
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
                    <OriginalLineChart
                        chartDescription={{ text: '' }}
                        data={{
                            dataSets: [
                                {
                                    config: {
                                        circleColor: processColor(colors.secondary),
                                        circleRadius: 4,
                                        color: processColor(colors.primary),
                                        drawCircles: true,
                                        drawHighlightIndicators: false,
                                        drawValues: false,
                                        valueFormatter: 'largeValue',
                                    },
                                    label: title,
                                    values: data.map(({ marker, x, y }) => ({ marker, x, y })),
                                },
                            ],
                        }}
                        doubleTapToZoomEnabled={false}
                        dragEnabled={false}
                        highlightPerDragEnabled={false}
                        highlightPerTapEnabled={true}
                        legend={{ enabled: false }}
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
            <Text style={styles.xAxisLabel}>
                {xAxisLabel}
            </Text>
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

export default LineChart;
