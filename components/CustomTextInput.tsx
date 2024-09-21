import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import React from 'react';
import { StyleSheet, TextInput, TextStyle, View, ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface CustomTextInputProps {
    inputStyle?: TextStyle;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
    label?: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    value: string;
    wrapperStyle?: ViewStyle;
}

const CustomTextInput: React.FC<CustomTextInputProps> = ({
    inputStyle,
    keyboardType = 'default',
    label,
    onChangeText,
    placeholder,
    value,
    wrapperStyle,
}) => {
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);

    return (
        <View style={[styles.formGroup, wrapperStyle]}>
            {label ? (
                <Text style={styles.label}>{label}</Text>
            ) : null}
            <TextInput
                keyboardType={keyboardType}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={dark ? '#BDBDBD' : '#95a5a6'}
                style={[styles.input, inputStyle]}
                value={value}
            />
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    formGroup: {
        marginBottom: 16,
        width: '100%',
    },
    input: {
        backgroundColor: colors.surface,
        borderColor: colors.onSurface,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.onSurface,
        height: 55,
        paddingLeft: 10,
        width: '100%',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
});

export default CustomTextInput;
