import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { FontAwesome } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

type SliderWithButtonsProps = {
    label: string;
    maximumValue?: number;
    minimumValue?: number;
    onValueChange: (value: number) => void;
    step?: number;
    value: number;
};

const SliderWithButtons = ({
    label,
    maximumValue = 10,
    minimumValue = 1,
    onValueChange,
    step = 1,
    value,
}: SliderWithButtonsProps) => {
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);

    return (
        <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>{label}</Text>
            <View style={styles.sliderWithButtons}>
                <TouchableOpacity
                    hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
                    onPress={() => onValueChange(Math.max(minimumValue, value - 1))}
                    style={styles.sliderButton}
                >
                    <FontAwesome color={colors.shadow} name="minus" size={26} />
                </TouchableOpacity>
                <Slider
                    maximumTrackTintColor={colors.outline}
                    maximumValue={maximumValue}
                    minimumTrackTintColor={colors.shadow}
                    minimumValue={minimumValue}
                    onValueChange={onValueChange}
                    step={step}
                    style={styles.slider}
                    thumbTintColor={colors.shadow}
                    value={value}
                />
                <TouchableOpacity
                    hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
                    onPress={() => onValueChange(Math.min(maximumValue, value + 1))}
                    style={styles.sliderButton}
                >
                    <FontAwesome color={colors.shadow} name="plus" size={26} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    slider: {
        height: 40,
        width: '80%',
    } as ViewStyle,
    sliderButton: {
        marginHorizontal: 5,
    },
    sliderContainer: {
        marginBottom: 16,
        marginVertical: 10,
        paddingHorizontal: 16,
    },
    sliderLabel: {
        color: colors.onBackground,
        fontSize: 16,
        marginBottom: 5,
    },
    sliderWithButtons: {
        alignItems: 'center',
        flexDirection: 'row',
    } as ViewStyle,
});

export default SliderWithButtons;
