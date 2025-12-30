import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const addTransparency = (color: string, opacity: number): string => {
    const hexOpacity = Math.round(opacity * 255)
        .toString(16)
        .padStart(2, '0');
    return `${color}${hexOpacity}`;
};

export const CustomLightTheme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        backdrop: '#ECEFF1CC',
        background: '#FFFFFF',
        elevation: {
            level0: 'transparent',
            level1: '#F5F5F5',
            level2: '#EEEEEE',
            level3: '#E0E0E0',
            level4: '#BDBDBD',
            level5: '#9E9E9E',
        },
        error: '#D32F2F',
        errorContainer: '#FFCDD2',
        inverseOnSurface: '#E0E0E0',
        inversePrimary: '#0288D1',
        inverseSurface: '#2C2C2C',
        onBackground: '#212121',
        onError: '#FFFFFF',
        onErrorContainer: '#D32F2F',
        onPrimary: '#FFFFFF',
        onPrimaryContainer: '#0288D1',
        onQuaternary: '#000000',
        onQuaternaryContainer: '#FFD54F',
        onSecondary: '#212121',
        onSecondaryContainer: '#bafff2',
        onSurface: '#212121',
        onSurfaceDisabled: '#21212161',
        onSurfaceVariant: '#757575',
        onTertiary: '#FFFFFF',
        onTertiaryContainer: '#FF7043',
        outline: '#757575',
        outlineVariant: '#9E9E9E',
        primary: '#0288D1',
        primaryContainer: '#B3E5FC',
        quaternary: '#FFD54F',
        quaternaryContainer: '#FFECB3',
        scrim: '#000000',
        secondary: '#48C9B0',
        secondaryContainer: '#16A085',
        shadow: '#000000',
        surface: '#FAFAFA',
        surfaceDisabled: '#2121211F',
        surfaceVariant: '#E0E0E0',
        tertiary: '#FF7043',
        tertiaryContainer: '#FFCCBC',
    },
} as const;

export const CustomDarkTheme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        backdrop: '#263238CC',
        background: '#121212',
        elevation: {
            level0: 'transparent',
            level1: '#1E1E1E',
            level2: '#2C2C2C',
            level3: '#3A3A3A',
            level4: '#484848',
            level5: '#565656',
        },
        error: '#EF5350',
        errorContainer: '#FFEBEE',
        inverseOnSurface: '#2c2c2c',
        inversePrimary: '#B3E5FC',
        inverseSurface: '#FFFFFF',
        onBackground: '#E0E0E0',
        onError: '#000000',
        onErrorContainer: '#EF5350',
        onPrimary: '#000000',
        onPrimaryContainer: '#B3E5FC',
        onQuaternary: '#000000',
        onQuaternaryContainer: '#FFD54F',
        onSecondary: '#E0E0E0',
        onSecondaryContainer: '#bafff2',
        onSurface: '#E0E0E0',
        onSurfaceDisabled: '#E0E0E061',
        onSurfaceVariant: '#BDBDBD',
        onTertiary: '#000000',
        onTertiaryContainer: '#FF7043',
        outline: '#BDBDBD',
        outlineVariant: '#9E9E9E',
        primary: '#B3E5FC',
        primaryContainer: '#0288D1',
        quaternary: '#FFD54F',
        quaternaryContainer: '#FFECB3',
        scrim: '#FFFFFF',
        secondary: '#48C9B0',
        secondaryContainer: '#16A085',
        shadow: '#FFFFFF',
        surface: '#383838',
        surfaceDisabled: '#E0E0E01F',
        surfaceVariant: '#424242',
        tertiary: '#FF7043',
        tertiaryContainer: '#FFCCBC',
    },
} as const;

export type CustomThemeColorsType = CustomDarkThemeType['colors'] | CustomLightThemeType['colors'];

export type CustomThemeType = CustomDarkThemeType | CustomLightThemeType;

type CustomDarkThemeType = typeof CustomDarkTheme;

type CustomLightThemeType = typeof CustomLightTheme;
