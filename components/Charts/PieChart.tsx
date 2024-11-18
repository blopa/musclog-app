import { FAB_ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { PieChart as OriginalPieChart } from 'react-native-charts-wrapper';
import { IconButton, useTheme, Text } from 'react-native-paper';
import { processColor } from 'react-native-reanimated';
import Share from 'react-native-share';
import ViewShot from 'react-native-view-shot';

interface PieChartProps {
    data: {
        color?: string;
        label: string;
        marker?: string;
        value: number;
    }[];
    shareButtonPosition?: 'bottom' | 'top';
    showShareImageButton?: boolean;
    title?: string;
    size?: number;
    showLabels?: boolean;
    showLegend?: boolean;
}

const PieChart: React.FC<PieChartProps> = ({
    data,
    shareButtonPosition = 'bottom',
    showShareImageButton = true,
    title,
    size = 300,
    showLabels = true,
    showLegend = true,
}) => {
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, size);
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

    const chartData = {
        dataSets: [{
            config: {
                colors: data.map(({ color }) => processColor(color || colors.primary)),
                sliceSpace: Math.round(size * 0.007),
                valueLineColor: processColor(colors.surface),
                valueTextColor: processColor(colors.inverseOnSurface),
                valueTextSize: Math.round(size * 0.05),
            },
            label: '',
            values: data.map(({ label, marker, value }) => ({ label, marker, value })),
        }],
    };

    return (
        <View style={styles.chartContainer}>
            {title ? (
                <Text style={styles.chartTitle}>
                    {title}
                </Text>
            ) : null}
            <ViewShot
                options={{ format: 'png', quality: 1.0 }}
                ref={chartRef}
                style={{ backgroundColor: colors.surface }}
            >
                <OriginalPieChart
                    chartDescription={{ text: '' }}
                    data={chartData}
                    entryLabelColor={showLabels ? processColor(colors.inverseOnSurface) : processColor('transparent')}
                    entryLabelTextSize={showLabels ? Math.round(size * 0.03) : 0}
                    legend={{
                        enabled: showLegend,
                        form: 'CIRCLE',
                        horizontalAlignment: 'CENTER',
                        orientation: 'HORIZONTAL',
                        textColor: processColor(colors.onSurface),
                        textSize: Math.round(size * 0.05),
                        verticalAlignment: 'BOTTOM',
                        wordWrapEnabled: true,
                    }}
                    marker={{
                        enabled: true,
                        markerColor: processColor(colors.surface),
                        textColor: processColor(colors.onSurface),
                        textSize: Math.round(size * 0.05),
                    }}
                    style={styles.chart}
                />
            </ViewShot>
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

const makeStyles = (colors: CustomThemeColorsType, size: number) => StyleSheet.create({
    chart: {
        height: size,
        width: size,
    },
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
    shareButton: {
        position: 'absolute',
        right: 10,
    },
    sharePositionBottom: { bottom: 6 },
    sharePositionTop: { top: 10 },
});

export default PieChart;
