import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { FontAwesome5 } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, StyleSheet, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export default function AnimatedSearchBar({ isOpen: forceOpen = false, searchQuery, setSearchQuery }: { isOpen?: boolean, searchQuery: string; setSearchQuery: (query: string) => void }) {
    const { t } = useTranslation();
    const inputWidth = useSharedValue(0);
    const iconOpacity = useSharedValue(1);
    const inputRef = useRef<TextInput>(null);
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const [isOpened, setIsOpened] = useState(forceOpen);

    const inputStyle = useAnimatedStyle(() => {
        return {
            width: withTiming(inputWidth.value ? 250 : 0, { duration: 300 }),
        };
    });

    const iconStyle = useAnimatedStyle(() => {
        return {
            opacity: withTiming(iconOpacity.value, { duration: 300 }),
        };
    });

    const toggleSearch = useCallback(() => {
        if (inputWidth.value === 0) {
            setIsOpened(true);
            inputWidth.value = 1;
            iconOpacity.value = 0;
            setTimeout(() => {
                inputRef.current?.focus();
            }, 300);
        } else {
            setIsOpened(false);
            inputWidth.value = 0;
            iconOpacity.value = 1;
            Keyboard.dismiss();
        }
    }, [iconOpacity, inputWidth]);

    const handleClickOutside = useCallback(() => {
        if (inputWidth.value === 1) {
            setIsOpened(false);
            inputWidth.value = 0;
            iconOpacity.value = 1;
            Keyboard.dismiss();
        }
    }, [iconOpacity, inputWidth]);

    useEffect(() => {
        const handleKeyboardDidHide = () => {
            handleClickOutside();
        };

        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', handleKeyboardDidHide);
        return () => {
            keyboardDidHideListener.remove();
        };
    }, [handleClickOutside]);

    return (
        <TouchableWithoutFeedback onPress={handleClickOutside}>
            <View style={styles.container}>
                <TouchableOpacity onPress={toggleSearch}>
                    <Animated.View style={iconStyle}>
                        <FontAwesome5 color={colors.background} name="search" size={24} />
                    </Animated.View>
                </TouchableOpacity>
                <Animated.View style={[styles.inputContainer, inputStyle]}>
                    <TextInput
                        onBlur={handleClickOutside}
                        onChangeText={setSearchQuery}
                        placeholder={t('search')}
                        ref={inputRef}
                        style={[styles.input, isOpened ? { paddingLeft: 10 } : null]}
                        value={searchQuery}
                    />
                </Animated.View>
            </View>
        </TouchableWithoutFeedback>
    );
}

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    container: {
        alignItems: 'center',
        flexDirection: 'row',
    },
    input: {
        borderRadius: 1,
        height: '100%',
        width: '100%',
    },
    inputContainer: {
        backgroundColor: dark ? 'transparent' : colors.background,
        height: 40,
        marginLeft: 10,
    },
});
