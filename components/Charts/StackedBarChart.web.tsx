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
import React, { useCallback, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Dimensions, StyleSheet, View } from 'react-native';
import { IconButton, Switch, Text, useTheme } from 'react-native-paper';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

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

    const hasTotalLabels = useMemo(
        () => secondaryLabels.length > 0,
        [secondaryLabels]
    );

    const onToggleSwitch = useCallback(
        () => setShowTotalLabels(!showTotalLabels),
        [showTotalLabels]
    );

    const datasetColors = [
        colors.quaternaryContainer,
        colors.secondaryContainer,
        colors.primary,
        colors.tertiaryContainer,
    ];

    const chartData = {
        datasets: stackLabels.map((label, index) => ({
            backgroundColor: datasetColors[index % datasetColors.length],
            data: data.map((item) => item.y[index]),
            label: label,
        })),
        labels: showTotalLabels ? secondaryLabels : labels,
    };

    const chartOptions = {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
            },
            tooltip: {
                callbacks: {
                    label: function (context: any): string {
                        const { dataset, raw } = context;
                        const { marker } = data[context.dataIndex];
                        return `${dataset.label}: ${raw} (${Array.isArray(marker) ? marker.join(', ') : marker})`;
                    },
                },
            },
        },
        scales: {
            x: {
                stacked: true,
                ticks: {
                    color: colors.onSurface,
                    maxRotation: showTotalLabels ? 80 : 45,
                },
                title: {
                    color: colors.onSurface,
                    display: true,
                    text: xAxisLabel,
                },
            },
            y: {
                beginAtZero: true,
                stacked: true,
                ticks: {
                    color: colors.onSurface,
                    max: yAxis.axisMaximum,
                    min: yAxis.axisMinimum,
                },
                title: {
                    color: colors.onSurface,
                    display: true,
                    text: yAxisLabel,
                },
            },
        },
    };

    const shareChart = useCallback(async () => {
        console.log('share image clicked');
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
            <View style={styles.chartWrapper}>
                <Bar data={chartData} options={chartOptions} />
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
});

export default StackedBarChart;
