import { FAB_ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useRef } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
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
                sliceSpace: 2,
                valueLineColor: processColor(colors.surface),
                valueTextColor: processColor(colors.inverseOnSurface),
                valueTextSize: 14,
            },
            label: '',
            values: data.map(({ label, marker, value }) => ({ label, marker, value })),
        }],
    };

    return (
        <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>{title}</Text>
            <ViewShot
                options={{ format: 'png', quality: 1.0 }}
                ref={chartRef}
                style={{ backgroundColor: colors.surface }}
            >
                <OriginalPieChart
                    chartDescription={{ text: '' }}
                    data={chartData}
                    entryLabelColor={processColor(colors.inverseOnSurface)}
                    entryLabelTextSize={8}
                    legend={{
                        enabled: true,
                        form: 'CIRCLE',
                        horizontalAlignment: 'CENTER',
                        orientation: 'HORIZONTAL',
                        textColor: processColor(colors.onSurface),
                        textSize: 14,
                        verticalAlignment: 'BOTTOM',
                        wordWrapEnabled: true,
                    }}
                    marker={{
                        enabled: true,
                        markerColor: processColor(colors.surface),
                        textColor: processColor(colors.onSurface),
                        textSize: 14,
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
                        shareButtonPosition === 'top' ? styles.sharePositionTop : styles.sharePositionBottom
                    ]}
                />
            ) : null}
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    chart: {
        height: 300,
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
    shareButton: {
        position: 'absolute',
        right: 10,
    },
    sharePositionBottom: { bottom: 6 },
    sharePositionTop: { top: 10 },
});

export default PieChart;
