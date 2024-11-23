import { SYSTEM_DEFAULT } from '@/constants/colors';
import { THEME_CHOICE_TYPE } from '@/constants/storage';
import { getSetting } from '@/utils/database';
import { ThemeType } from '@/utils/types';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme as useOriginalUseColorScheme } from 'react-native';

interface CustomThemeContextValue {
    setTheme: (themeName: ThemeType) => void;
    theme: ThemeType;
}

const CustomThemeContext = createContext<CustomThemeContextValue>({
    setTheme: () => {},
    theme: SYSTEM_DEFAULT,
});

export const useCustomTheme = () => useContext(CustomThemeContext);

interface CustomThemeProviderProps {
    children: ReactNode;
}

export const CustomThemeProvider: React.FC<CustomThemeProviderProps> = ({ children }) => {
    const [theme, setTheme] = useState<ThemeType>(SYSTEM_DEFAULT);
    const colorScheme: 'dark' | 'light' | 'system_default' = useOriginalUseColorScheme() as 'dark' | 'light' | 'system_default';

    const fetchColorScheme = useCallback(async () => {
        const existingThemeChoice = await getSetting(THEME_CHOICE_TYPE);
        const newTheme = existingThemeChoice?.value as ThemeType || SYSTEM_DEFAULT;
        setTheme(newTheme);
    }, []);

    useEffect(() => {
        fetchColorScheme();
    }, [fetchColorScheme]);

    const effectiveTheme = theme === SYSTEM_DEFAULT ? colorScheme : (theme ?? colorScheme);

    return (
        <CustomThemeContext.Provider
            value={{
                setTheme,
                theme: effectiveTheme,
                // theme: DARK,
            }}
        >
            {children}
        </CustomThemeContext.Provider>
    );
};
