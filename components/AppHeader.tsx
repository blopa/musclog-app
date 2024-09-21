import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Appbar, useTheme } from 'react-native-paper';

const AppHeader = ({ title } : {title: string}) => {
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    return (
        <Appbar.Header
            mode="small"
            statusBarHeight={0}
            style={styles.appbarHeader}
        >
            <Appbar.Content title={title} titleStyle={styles.appbarTitle} />
        </Appbar.Header>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    appbarHeader: {
        backgroundColor: colors.primary,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    appbarTitle: {
        color: colors.onPrimary,
        fontSize: Platform.OS === 'web' ? 20 : 26,
    },
});

export default AppHeader;
