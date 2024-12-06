import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import React, { memo, useCallback, useState } from 'react';
import { StyleSheet, TouchableWithoutFeedback, View, ViewStyle } from 'react-native';
import { Button, Modal, Portal, Text, useTheme } from 'react-native-paper';

interface ThemedModalProps {
    cancelText?: string;
    children?: React.ReactNode;
    closeOnTouchOutside?: boolean;
    confirmText?: string;
    disabled?: boolean;
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
    disabled = false,
    onClose,
    onConfirm,
    style,
    title,
    visible,
}: ThemedModalProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

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

    if (!visible) {
        return null;
    }

    return (
        <Portal>
            {visible && (
                <TouchableWithoutFeedback
                    accessible={false} // Prevent the overlay from interfering with accessibility
                    // onPress={handleDismissOnOverlayPress}
                >
                    <View style={styles.overlay}>
                        <Modal
                            contentContainerStyle={[styles.modalContent, style]}
                            dismissable={false} // We handle dismissal ourselves
                            visible={visible}
                        >
                            <View style={styles.innerContent}>
                                {title ? (
                                    <Text style={styles.modalMessage}>{title}</Text>
                                ) : null}
                                {children}
                                <View style={styles.buttonContainer}>
                                    {cancelText && (
                                        <Button
                                            disabled={isLoading || disabled}
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
                                            disabled={isLoading || disabled}
                                            mode="contained"
                                            onPress={handleOnConfirm}
                                            style={styles.button}
                                        >
                                            {confirmText}
                                        </Button>
                                    )}
                                </View>
                            </View>
                        </Modal>
                    </View>
                </TouchableWithoutFeedback>
            )}
        </Portal>
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
    innerContent: {
        width: '100%',
    },
    modalContent: {
        alignItems: 'center',
        alignSelf: 'center', // Center the modal horizontally
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
