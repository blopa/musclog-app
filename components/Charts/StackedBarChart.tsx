import { FAB_ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { BarChart as OriginalBarChart } from 'react-native-charts-wrapper';
import { IconButton, Switch, Text, useTheme } from 'react-native-paper';
import { processColor } from 'react-native-reanimated';
import Share from 'react-native-share';
import ViewShot from 'react-native-view-shot';

interface StackedBarChartProps {
    data: {
        date: string;
        marker: string | string[];
        x: number;
        y: number[],
    }[];
    granularity?: number;
    labels: string[];
    secondaryLabels?: string[];
    shareButtonPosition?: 'bottom' | 'top';
    showShareImageButton?: boolean;
    stackLabels: string[];
    title: string;
    xAxisLabel: string;
    yAxis: { axisMaximum: number; axisMinimum: number };
    yAxisLabel: string;
}

const StackedBarChart: React.FC<StackedBarChartProps> = ({
    data,
    granularity = 3,
    labels,
    secondaryLabels = [],
    shareButtonPosition = 'bottom',
    showShareImageButton = true,
    stackLabels,
    title,
    xAxisLabel,
    yAxis,
    yAxisLabel,
}) => {
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);
    const [showTotalLabels, setShowTotalLabels] = useState(false);
    const chartRef = useRef(null);

    const hasTotalLabels = useMemo(
        () => secondaryLabels.length > 0,
        [secondaryLabels]
    );

    const onToggleSwitch = useCallback(
        () => setShowTotalLabels(!showTotalLabels),
        [showTotalLabels]
    );

    const stackColors = useMemo(() => [
        processColor(colors.quaternaryContainer),
        processColor(colors.secondaryContainer),
        processColor(colors.primary),
        processColor(colors.tertiaryContainer),
    ], [colors]);

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
        <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>{title}</Text>
            {hasTotalLabels ? (
                <Switch
                    onValueChange={onToggleSwitch}
                    style={styles.totalsToggle}
                    value={showTotalLabels}
                />
            ) : null}
            <ViewShot
                options={{ format: 'png', quality: 1.0 }}
                ref={chartRef}
                style={{
                    backgroundColor: colors.surface,
                    paddingHorizontal: 12,
                }}
            >
                <View style={styles.chartWrapper}>
                    <Text style={styles.yAxisLabel}>{yAxisLabel}</Text>
                    <OriginalBarChart
                        chartDescription={{ text: '' }}
                        data={{
                            dataSets: [
                                {
                                    config: {
                                        colors: stackColors,
                                        drawValues: false,
                                        stackLabels: stackLabels,
                                    },
                                    label: '',
                                    values: data.map(({ marker, x, y }) => ({
                                        marker,
                                        x,
                                        y,
                                    })),
                                },
                            ],
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
                            granularity: showTotalLabels ? 1 : granularity,
                            granularityEnabled: true,
                            labelCount: (showTotalLabels ? secondaryLabels : labels).length,
                            labelRotationAngle: showTotalLabels ? 80 : 45,
                            position: 'BOTTOM',
                            textColor: processColor(colors.onSurface),
                            valueFormatter: showTotalLabels ? secondaryLabels : labels,
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
        width: Dimensions.get('window').width - 32,
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
    shareButton: {
        position: 'absolute',
        right: 10,
    },
    sharePositionBottom: { bottom: 6 },
    sharePositionTop: { top: 10 },
    totalsToggle: {
        alignSelf: 'flex-end',
        position: 'absolute',
        right: 16,
        top: 14,
    },
    xAxisLabel: {
        color: colors.onBackground,
        fontSize: 14,
    },
    yAxisLabel: {
        color: colors.onBackground,
        fontSize: 14,
        left: -22,
        position: 'absolute',
        transform: [{ rotate: '-90deg' }],
    },
});

export default StackedBarChart;
