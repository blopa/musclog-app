import { CustomThemeColorsType, CustomThemeType, addTransparency } from '@/utils/colors';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';

interface ThemedModalProps {
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
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(300)).current;
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const handleOnClose = useCallback(async () => {
        setIsLoading(true);
        await onClose();
        setIsLoading(false);
    }, [onClose]);

    const handleOnConfirm = useCallback(async () => {
        setIsLoading(true);
        await onConfirm?.();
        setIsLoading(false);
    }, [onConfirm]);

    useEffect(() => {
        if (visible) {
            setIsVisible(true);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    duration: 300,
                    toValue: 1,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    duration: 300,
                    toValue: 0,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    duration: 300,
                    toValue: 0,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    duration: 300,
                    toValue: 300,
                    useNativeDriver: true,
                }),
            ]).start(() => setIsVisible(false));
        }
    }, [fadeAnim, slideAnim, visible]);

    if (!isVisible) {
        return null;
    }

    return (
        <Modal
            animationType="none"
            onRequestClose={handleOnClose}
            transparent={true}
            visible={isVisible}
        >
            <Pressable
                onPress={closeOnTouchOutside ? handleOnClose : undefined}
                style={styles.modalOverlay}
            >
                <Animated.View style={[styles.modalContent, style, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <Pressable style={styles.innerPressable}>
                        {title && (
                            <Text style={styles.modalMessage}>{title}</Text>
                        )}
                        {children}
                        <View style={styles.buttonContainer}>
                            {cancelText && (
                                <Button
                                    disabled={isLoading}
                                    mode="outlined"
                                    onPress={handleOnClose}
                                    style={[styles.button, !onConfirm ? styles.wideButton : {}]}
                                >
                                    {cancelText}
                                </Button>
                            )}
                            {(confirmText && onConfirm) && (
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
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    button: {
        marginHorizontal: 5,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    innerPressable: {
        width: '100%',
    },
    modalContent: {
        alignItems: 'center',
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
    modalOverlay: {
        alignItems: 'center',
        backgroundColor: addTransparency(colors.background, 0.5),
        flex: 1,
        justifyContent: 'center',
    },
    wideButton: {
        marginHorizontal: 'auto',
        width: '80%',
    },
});

export default ThemedModal;
