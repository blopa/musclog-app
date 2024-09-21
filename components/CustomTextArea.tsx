import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import React from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface CustomTextAreaProps {
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
    label?: string;
    numberOfLines?: number;
    onChangeText: (text: string) => void;
    placeholder: string;
    value: string;
}

const CustomTextArea: React.FC<CustomTextAreaProps> = ({
    keyboardType = 'default',
    label,
    numberOfLines = 4,
    onChangeText,
    placeholder,
    value,
}) => {
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);

    return (
        <View style={styles.formGroup}>
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
                style={styles.textarea}
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
        flex: 1,
        marginRight: 8,
        paddingLeft: 10,
        width: '100%',
        ...Platform.OS === 'web' && {
            paddingTop: 10,
        },
    },
});

export default CustomTextArea;
