import { FAB_ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Title, Tooltip } from 'chart.js';
import React, { ReactNode, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import { Dimensions, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

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

    const shareChart = useCallback(async () => {
        console.log('share image clicked');
    }, []);

    const chartData = {
        datasets: [
            {
                backgroundColor: colors.secondary,
                borderColor: colors.primary,
                data: data.map(({ marker, x, y }) => ({ marker, x, y })),
                label: title,
                pointBackgroundColor: colors.primary,
                pointBorderColor: colors.secondary,
                pointHoverRadius: 6,
                pointRadius: 4,
            },
        ],
        labels: labels,
    };

    const chartOptions = {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                callbacks: {
                    label: function (tooltipItem: { raw: { marker: string; }; }): string {
                        return tooltipItem.raw.marker.split('\n')[0];
                    },
                },
            },
        },
        scales: {
            x: {
                ticks: {
                    color: colors.onSurface,
                    maxRotation: 45,
                },
                title: {
                    display: true,
                    text: xAxisLabel,
                },
            },
            y: {
                beginAtZero: true,
                max: yAxis.axisMaximum,
                min: yAxis.axisMinimum,
                ticks: {
                    color: colors.onSurface,
                },
                title: {
                    display: true,
                    text: yAxisLabel,
                },
            },
        },
    };

    return (
        <View style={[styles.chartContainer, { width: Dimensions.get('window').width - (padding * 2) }]}>
            <Text style={styles.chartTitle}>
                {title}
            </Text>
            <View style={styles.chartWrapper}>
                <Line
                    data={chartData}
                    // @ts-ignore
                    options={chartOptions}
                />
            </View>
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
        height: 200,
        width: Dimensions.get('window').width - 64,
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
});

export default LineChart;
