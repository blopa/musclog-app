import { FAB_ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { safeToFixed } from '@/utils/string';
import { MaterialIcons } from '@expo/vector-icons';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import React, { useCallback } from 'react';
import { Pie } from 'react-chartjs-2';
import { StyleSheet, View } from 'react-native';
import { IconButton, useTheme, Text } from 'react-native-paper';

ChartJS.register(ArcElement, Tooltip, Legend);

interface PieChartProps {
    data: {
        color?: string;
        label: string;
        marker?: string;
        value: number;
    }[];
    shareButtonPosition?: 'bottom' | 'top';
    showShareImageButton?: boolean;
    title: string;
    size?: number;
}

const PieChart: React.FC<PieChartProps> = ({
    data,
    shareButtonPosition = 'bottom',
    showShareImageButton = true,
    title,
    size = 300,
}) => {
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, size);

    const chartData = {
        datasets: [
            {
                backgroundColor: data.map((item) => item.color || colors.primary),
                data: data.map((item) => item.value),
                label: title,
            },
        ],
        labels: data.map((item) => item.label),
    };

    const chartOptions = {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: colors.onSurface,
                    font: {
                        size: Math.round(size * 0.05),
                    },
                },
                position: 'bottom' as const,
            },
            tooltip: {
                callbacks: {
                    label: function (tooltipItem: { dataIndex: number; label: string; raw: number }): string {
                        const marker = data[tooltipItem.dataIndex].marker;
                        return `${tooltipItem.label}: ${safeToFixed(tooltipItem.raw, 2)}${marker ? ` (${marker})` : ''}`;
                    },
                },
            },
        },
    };

    const shareChart = useCallback(() => {
        console.log('share image clicked');
    }, []);

    return (
        <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>{title}</Text>
            <View style={styles.chartWrapper}>
                <Pie
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
                        shareButtonPosition === 'top' ? styles.sharePositionTop : styles.sharePositionBottom
                    ]}
                />
            ) : null}
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType, size: number) => StyleSheet.create({
    chartContainer: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: Math.round(size * 0.06),
        marginVertical: Math.round(size * 0.03),
        padding: Math.round(size * 0.03),
    },
    chartTitle: {
        color: colors.onSurface,
        fontSize: Math.round(size * 0.06),
        fontWeight: 'bold',
        marginBottom: Math.round(size * 0.015),
    },
    chartWrapper: {
        height: size,
        width: size,
    },
    shareButton: {
        position: 'absolute',
        right: 10,
    },
    sharePositionBottom: { bottom: 6 },
    sharePositionTop: { top: 10 },
});

export default PieChart;
