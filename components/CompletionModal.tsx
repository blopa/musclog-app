import ThemedModal from '@/components/ThemedModal';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { FontAwesome5 } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';

type CompletionModalProps = {
    buttonText: string,
    children?: React.ReactNode,
    isLoading?: boolean,
    isModalVisible: boolean,
    message?: string,
    onClose: () => void,
    title: string,
};

const CompletionModal = ({
    buttonText,
    children,
    isLoading = false,
    isModalVisible,
    message,
    onClose,
    title,
}: CompletionModalProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    return (
        <ThemedModal
            closeOnTouchOutside={false}
            onClose={onClose}
            onConfirm={onClose}
            title={title}
            visible={isModalVisible}
        >
            <View style={styles.modalContent}>
                <FontAwesome5 color="#FFD700" name="trophy" size={50} />
                <Text style={styles.modalText}>
                    {message || title}
                </Text>
                {children}
                {isLoading ? (
                    <ActivityIndicator color="#3b82f6" size="large" style={styles.loadingIndicator} />
                ) : (
                    <Button
                        disabled={isLoading}
                        mode="contained"
                        onPress={onClose}
                        style={styles.buttonSpacing}
                    >
                        {buttonText || t('button_text')}
                    </Button>
                )}
            </View>
        </ThemedModal>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    buttonSpacing: {
        marginTop: 16,
        width: '100%',
    },
    loadingIndicator: {
        marginVertical: 16,
    },
    modalContent: {
        alignItems: 'center',
        width: '100%',
    },
    modalText: {
        color: colors.onBackground,
        fontSize: 20,
        fontWeight: 'bold',
        marginVertical: 20,
        textAlign: 'center',
    },
});

export default CompletionModal;
