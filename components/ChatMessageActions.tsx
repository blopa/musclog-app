import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface ChatMessageActionsProps {
    onCancel: () => void;
    onCopyText: () => void;
}

const ChatMessageActions: React.FC<ChatMessageActionsProps> = ({ onCancel, onCopyText }) => {
    const { t } = useTranslation();
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={onCopyText} style={styles.actionButton}>
                <Text style={styles.actionText}>{t('copy_text')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onCancel} style={styles.actionButton}>
                <Text style={styles.actionText}>{t('cancel')}</Text>
            </TouchableOpacity>
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    actionButton: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    actionText: {
        color: colors.primary,
        fontSize: 16,
    },
    container: {
        backgroundColor: colors.surface,
        borderRadius: 10,
        bottom: 0,
        padding: 10,
        position: 'absolute',
        width: '100%',
    },
});

export default ChatMessageActions;
