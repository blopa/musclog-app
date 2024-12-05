import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Button, useTheme } from 'react-native-paper';

type GoogleSignInButtonProps = {
    disabled?: boolean,
    onSignIn: () => void,
    variant?: 'reauthenticate' | 'sign-in',
};

export function GoogleSignInButton({
    disabled = false,
    onSignIn,
    variant = 'sign-in',
}: GoogleSignInButtonProps) {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    return (
        <Button
            contentStyle={styles.contentStyle}
            disabled={disabled}
            labelStyle={{
                marginLeft: -2,
            }}
            mode="contained"
            onPress={onSignIn}
            style={[styles.button, disabled && styles.buttonDisabled]}
        >
            <View style={styles.innerContainer}>
                <View style={styles.googleIconWrapper}>
                    <Image
                        source={require('@/assets/google-icon.png')}
                        style={styles.googleIcon}
                    />
                </View>
                <Text style={[styles.text, disabled && styles.textDisabled]}>
                    {variant === 'sign-in' ? t('sign_in_with_google') : t('reauthenticate')}
                </Text>
            </View>
        </Button>
    );
}

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    button: {
        backgroundColor: dark ? '#4285f4' : '#ffffff',
        borderColor: dark ? '#ffffff' : '#dddddd',
        borderRadius: 4,
        borderWidth: 1,
        marginVertical: 16,
        paddingHorizontal: 0,
    },
    buttonDisabled: {
        backgroundColor: dark ? '#3a3b3c' : '#f5f5f5',
    },
    contentStyle: {
        flexDirection: 'row',
        height: 48,
        justifyContent: 'flex-start',
    },
    googleIcon: {
        height: 18,
        width: 18,
    },
    googleIconWrapper: {
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 2,
        height: 40,
        justifyContent: 'center',
        width: 40,
    },
    innerContainer: {
        alignItems: 'center',
        flexDirection: 'row',
        margin: 0,
        paddingRight: 16,
    },
    text: {
        color: dark ? '#ffffff' : '#757575',
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 12,
    },
    textDisabled: {
        color: dark ? '#8a8a8a' : '#bdbdbd',
    },
});
