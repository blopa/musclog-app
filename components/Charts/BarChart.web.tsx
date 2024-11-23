import { FAB_ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { MaterialIcons } from '@expo/vector-icons';
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    Title,
    Tooltip,
} from 'chart.js';
import React, { ReactNode, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import { Dimensions, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

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

    const shareChart = useCallback(() => {
        console.log('share image clicked');
    }, []);

    const chartData = {
        datasets: data.map((dataset) => ({
            backgroundColor: colors.primary,
            data: dataset.values.map((item) => item.y),
            label: dataset.label,
        })),
        labels,
    };

    const chartOptions = {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: colors.onSurface,
                },
            },
            tooltip: {
                callbacks: {
                    label: function (context: any): string {
                        const marker = data[context.dataIndex]?.values[context.dataIndex]?.marker;
                        return `${context.dataset.label}: ${context.raw} (${marker})`;
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
                    color: colors.onSurface,
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
                    color: colors.onSurface,
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
                <Bar data={chartData} options={chartOptions} />
            </View>
            {showShareImageButton && (
                <IconButton
                    icon={() => <MaterialIcons color={colors.primary} name="share" size={FAB_ICON_SIZE} />}
                    onPress={shareChart}
                    style={[
                        styles.shareButton,
                        shareButtonPosition === 'top' ? styles.sharePositionTop : styles.sharePositionBottom,
                    ]}
                />
            )}
            {extraInfo && <View style={styles.extraInfoWrapper}>{extraInfo}</View>}
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
        width: Dimensions.get('window').width - 32,
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

export default BarChart;
