import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBar, StyleSheet } from 'react-native';
import { Snackbar, useTheme } from 'react-native-paper';

import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';

interface SnackbarContextValue {
    hideSnackbar: () => void;
    showSnackbar: (message: string, label?: string, onPress?: () => void) => void;
}

const SnackbarContext = createContext<SnackbarContextValue>({
    hideSnackbar: () => {},
    showSnackbar: () => {},
});

export const useSnackbar = () => useContext(SnackbarContext);

// Module-level refs to store snackbar functions for access outside React components
const snackbarRef = {
    hideSnackbar: () => {},
    showSnackbar: (_message: string, _label?: string, _onPress?: () => void) => {},
};

// Export helper functions to access snackbar from outside React components
export const getShowSnackbar = () => snackbarRef.showSnackbar;
export const getHideSnackbar = () => snackbarRef.hideSnackbar;

interface SnackbarProviderProps {
    children: ReactNode;
}

export const SnackbarProvider: React.FC<SnackbarProviderProps> = ({ children }) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarLabel, setSnackbarLabel] = useState(t('ok'));
    const [snackbarOnPress, setSnackbarOnPress] = useState<() => void>(() => {});

    const showSnackbar = useCallback((message: string, label: string = t('ok'), onPress: () => void = () => {}) => {
        setSnackbarMessage(message);
        setSnackbarLabel(label);
        setSnackbarOnPress(() => onPress);
        setSnackbarVisible(true);
    }, [t]);

    const hideSnackbar = useCallback(() => {
        setSnackbarVisible(false);
    }, []);

    useEffect(() => {
        // Update module-level refs for access outside React components
        snackbarRef.showSnackbar = showSnackbar;
        snackbarRef.hideSnackbar = hideSnackbar;
    }, [hideSnackbar, showSnackbar]);

    return (
        <SnackbarContext.Provider value={{ hideSnackbar, showSnackbar }}>
            {children}
            <Snackbar
                action={{
                    label: snackbarLabel,
                    onPress: () => {
                        hideSnackbar();
                        snackbarOnPress();
                    },
                }}
                duration={Snackbar.DURATION_SHORT}
                onDismiss={hideSnackbar}
                style={styles.snackbar}
                visible={snackbarVisible}
                wrapperStyle={styles.snackbarWrapper}
            >
                {snackbarMessage}
            </Snackbar>
        </SnackbarContext.Provider>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    snackbar: {
        // width: '100%',
    },
    snackbarWrapper: {
        top: StatusBar.currentHeight || 0,
    },
});
