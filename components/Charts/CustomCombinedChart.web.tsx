import { FAB_ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { MaterialIcons } from '@expo/vector-icons';
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
} from 'chart.js';
import React, { ReactNode, useCallback } from 'react';
import { Chart } from 'react-chartjs-2';
import { Dimensions, StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

interface CustomCombinedChartProps {
    barData: {
        label: string;
        values: { marker: string; x: number; y: number }[];
    }[];
    customLegend?: {
        colors?: string[];
        labels?: string[];
    };
    extraInfo?: ReactNode;
    granularity?: number;
    labelLeftMargin?: number;
    labels: string[];
    lineData: {
        label: string;
        values: { marker: string; x: number; y: number }[];
    }[];
    padding?: number;
    shareButtonPosition?: 'bottom' | 'top';
    showShareImageButton?: boolean;
    title: string;
    xAxisLabel: string;
    yAxis: {
        leftAxisMaximum: number;
        leftAxisMinimum: number;
        rightAxisMaximum: number;
        rightAxisMinimum: number;
    };
    yAxisLabel: string;
}

const CustomCombinedChart: React.FC<CustomCombinedChartProps> = ({
    barData,
    customLegend,
    extraInfo,
    granularity = 3,
    labelLeftMargin = -55,
    labels,
    lineData,
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

    const combinedData = {
        datasets: [
            ...lineData.map((dataset) => ({
                backgroundColor: colors.secondary,
                borderColor: colors.primary,
                data: dataset.values.map((item) => item.y),
                fill: false,
                label: dataset.label,
                pointBackgroundColor: colors.secondary,
                pointBorderColor: colors.primary,
                type: 'line' as const,
                yAxisID: 'y-right',
            })),
            ...barData.map((dataset) => ({
                backgroundColor: colors.primaryContainer,
                data: dataset.values.map((item) => item.y),
                label: dataset.label,
                type: 'bar' as const,
                yAxisID: 'y-left',
            })),
        ],
        labels,
    };

    const options = {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: colors.onSurface,
                },
                ...(customLegend && {
                    display: true,
                    labels: {
                        generateLabels: (chart: any) =>
                            customLegend.labels?.map((label, index) => ({
                                fillStyle: customLegend.colors?.[index],
                                text: label,
                            })) || [],
                    },
                }),
            },
            tooltip: {
                callbacks: {
                    label: (context: any) => {
                        const marker = barData[context.dataIndex]?.values[context.dataIndex]?.marker;
                        return `${context.dataset.label}: ${context.raw} (${marker})`;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
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
            'y-left': {
                beginAtZero: true,
                max: yAxis.leftAxisMaximum,
                min: yAxis.leftAxisMinimum,
                position: 'left' as const,
                ticks: {
                    color: colors.onSurface,
                },
                title: {
                    color: colors.onSurface,
                    display: true,
                    text: yAxisLabel,
                },
            },
            'y-right': {
                beginAtZero: true,
                max: yAxis.rightAxisMaximum,
                min: yAxis.rightAxisMinimum,
                position: 'right' as const,
                ticks: {
                    color: colors.onSurface,
                },
            },
        },
    };

    return (
        <View style={[styles.chartContainer, { width: Dimensions.get('window').width - padding * 2 }]}>
            <Text style={styles.chartTitle}>{title}</Text>
            <View style={styles.chartWrapper}>
                <Chart data={combinedData} options={options} type="bar" />
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

export default CustomCombinedChart;
