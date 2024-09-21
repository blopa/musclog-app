import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface CustomPickerProps {
    items: { label: string; value: string }[];
    label?: string;
    onValueChange: (itemValue: string) => void;
    selectedValue: string;
    wrapperStyle?: ViewStyle;
}

const CustomPicker: React.FC<CustomPickerProps> = ({
    items,
    label,
    onValueChange,
    selectedValue,
    wrapperStyle,
}) => {
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);

    return (
        <View style={[styles.formGroup, wrapperStyle]}>
            {label ? (
                <Text style={styles.label}>
                    {label}
                </Text>
            ) : null}
            <View style={styles.pickerContainer}>
                <Picker
                    onValueChange={onValueChange}
                    selectedValue={selectedValue}
                    style={styles.picker}
                >
                    {items.map((item) => (
                        <Picker.Item key={item.value} label={item.label} value={item.value} />
                    ))}
                </Picker>
            </View>
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    formGroup: {
        marginBottom: 16,
        width: '100%',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    picker: {
        backgroundColor: 'transparent',
        borderRadius: 8,
        color: colors.onSurface,
        height: 55,
        paddingLeft: 10,
        width: '100%',
    },
    pickerContainer: {
        backgroundColor: colors.surface,
        borderColor: colors.onSurface,
        borderRadius: 8,
        borderWidth: 1,
        overflow: 'hidden',
        width: '100%',
    },
});

export default CustomPicker;
