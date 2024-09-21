import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, CardProps, useTheme } from 'react-native-paper';

const ThemeCard = ({ children, style, ...props }: CardProps) => {
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    return (
        // @ts-ignore
        <Card style={[styles.card, style]} {...props}>
            {children}
        </Card>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderColor: dark ? colors.shadow : 'transparent',
        borderRadius: 8,
        borderWidth: dark ? 1 : 0,
        elevation: 3,
        marginVertical: 8,
        shadowColor: colors.shadow,
        shadowOffset: { height: 2, width: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
});

export default ThemeCard;
