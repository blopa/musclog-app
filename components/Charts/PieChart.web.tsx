import { FAB_ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { safeToFixed } from '@/utils/string';
import { MaterialIcons } from '@expo/vector-icons';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import React, { useCallback } from 'react';
import { Pie } from 'react-chartjs-2';
import { Dimensions, StyleSheet, View } from 'react-native';
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
}

const PieChart: React.FC<PieChartProps> = ({
    data,
    shareButtonPosition = 'bottom',
    showShareImageButton = true,
    title,
}) => {
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);

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
                },
                position: 'bottom' as const,
            },
            tooltip: {
                callbacks: {
                    label: function (tooltipItem: { dataIndex: number; label: string, raw: number }): string {
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
        height: 300,
        width: Dimensions.get('window').width - 64,
    },
    shareButton: {
        position: 'absolute',
        right: 10,
    },
    sharePositionBottom: { bottom: 6 },
    sharePositionTop: { top: 10 },
});

export default PieChart;
