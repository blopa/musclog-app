import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    StyleSheet,
    TouchableWithoutFeedback,
    View,
    ViewStyle,
} from 'react-native';
import { Button, Portal, Text, useTheme } from 'react-native-paper';

interface ThemedModalProps {
    animate?: boolean;
    cancelText?: string;
    children?: React.ReactNode;
    closeOnTouchOutside?: boolean;
    confirmText?: string;
    onClose: (() => Promise<void>) | (() => void);
    onConfirm?: (() => Promise<void>) | (() => void);
    style?: ViewStyle;
    title?: string;
    visible: boolean;
}

const ThemedModal = ({
    animate = true,
    cancelText,
    children,
    closeOnTouchOutside = true,
    confirmText,
    onClose,
    onConfirm,
    style,
    title,
    visible,
}: ThemedModalProps) => {
    const [isVisible, setIsVisible] = useState(visible);
    const [isLoading, setIsLoading] = useState(false);

    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const translateY = useRef(new Animated.Value(300)).current;

    useEffect(() => {
        if (visible) {
            setIsVisible(true);
            if (animate) {
                Animated.timing(translateY, {
                    duration: 300,
                    easing: Easing.out(Easing.ease),
                    toValue: 0,
                    useNativeDriver: true,
                }).start();
            } else {
                translateY.setValue(0);
            }
        } else {
            if (animate) {
                Animated.timing(translateY, {
                    duration: 300,
                    easing: Easing.in(Easing.ease),
                    toValue: 300,
                    useNativeDriver: true,
                }).start(() => setIsVisible(false));
            } else {
                translateY.setValue(300);
                setIsVisible(false);
            }
        }
    }, [visible, animate, translateY]);

    const handleOnConfirm = useCallback(async () => {
        setIsLoading(true);
        await onConfirm?.();
        setIsLoading(false);
    }, [onConfirm]);

    const handleOnClose = useCallback(() => {
        setIsLoading(false);
        onClose();
    }, [onClose]);

    const handleDismissOnOverlayPress = useCallback(() => {
        if (closeOnTouchOutside) {
            handleOnClose();
        }
    }, [closeOnTouchOutside, handleOnClose]);

    if (!isVisible) {
        return null;
    }

    return (
        <Portal>
            <TouchableWithoutFeedback
                accessible={false}
                onPress={handleDismissOnOverlayPress}
            >
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback accessible={false}>
                        <Animated.View
                            style={[
                                styles.animatedContainer,
                                { transform: [{ translateY }] },
                            ]}
                        >
                            <View style={[styles.modalContent, style]}>
                                {title && (
                                    <Text style={styles.modalMessage}>{title}</Text>
                                )}
                                <View style={{ width: 'auto' }}>
                                    {children}
                                </View>
                                <View style={styles.buttonContainer}>
                                    {cancelText && (
                                        <Button
                                            disabled={isLoading}
                                            mode="outlined"
                                            onPress={handleOnClose}
                                            style={[
                                                styles.button,
                                                !onConfirm ? styles.wideButton : {},
                                            ]}
                                        >
                                            {cancelText}
                                        </Button>
                                    )}
                                    {confirmText && onConfirm && (
                                        <Button
                                            disabled={isLoading}
                                            mode="contained"
                                            onPress={handleOnConfirm}
                                            style={styles.button}
                                        >
                                            {confirmText}
                                        </Button>
                                    )}
                                </View>
                            </View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Portal>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    animatedContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    button: {
        marginHorizontal: 5,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    modalContent: {
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: colors.background,
        borderColor: colors.shadow,
        borderRadius: 8,
        borderWidth: 1,
        padding: 16,
        width: '80%',
    },
    modalMessage: {
        color: colors.onBackground,
        fontSize: 18,
        marginBottom: 20,
        textAlign: 'center',
    },
    overlay: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        flex: 1,
        justifyContent: 'center',
    },
    wideButton: {
        marginHorizontal: 'auto',
        width: '80%',
    },
});

export default memo(ThemedModal);
