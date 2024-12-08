import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import React from 'react';
import { Platform, StyleSheet, TextInput, TextStyle, View, ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface CustomTextAreaProps {
    inputStyle?: TextStyle;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
    label?: string;
    numberOfLines?: number;
    onChangeText: (text: string) => void;
    placeholder: string;
    value: string;
    wrapperStyle?: ViewStyle;
}

const CustomTextArea: React.FC<CustomTextAreaProps> = ({
    inputStyle,
    keyboardType = 'default',
    label,
    numberOfLines = 4,
    onChangeText,
    placeholder,
    value,
    wrapperStyle,
}) => {
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, numberOfLines);

    return (
        <View style={[styles.formGroup, wrapperStyle]}>
            {label ? (
                <Text style={styles.label}>{label}</Text>
            ) : null}
            <TextInput
                keyboardType={keyboardType}
                multiline
                numberOfLines={numberOfLines}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={dark ? '#BDBDBD' : '#95a5a6'}
                style={[styles.textarea, inputStyle]}
                value={value}
            />
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType, numberOfLines: number) => StyleSheet.create({
    formGroup: {
        marginBottom: 16,
        width: '100%',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    textarea: {
        backgroundColor: colors.surface,
        borderColor: colors.onSurface,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.onSurface,
        // height: (numberOfLines * 40) + 15,
        height: 100,
        paddingLeft: 10,
        width: '100%',
        ...Platform.OS === 'web' && {
            paddingTop: 10,
        },
    },
});

export default CustomTextArea;
