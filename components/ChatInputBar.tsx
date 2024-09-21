import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { FontAwesome5 } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, TextInput, useTheme } from 'react-native-paper';

type InputBarProps = {
    handleSend: () => void;
    inputText: string;
    setInputText: (text: string) => void;
};

const ChatInputBar = ({ handleSend, inputText, setInputText }: InputBarProps) => {
    const { t } = useTranslation();
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);

    return (
        <View style={styles.inputContainer}>
            <TextInput
                multiline
                onChangeText={setInputText}
                placeholder={t('type_your_message')}
                style={styles.textArea}
                value={inputText}
            />
            <Button mode="contained" onPress={handleSend} style={styles.sendButton} >
                <FontAwesome5 color={colors.background} name="paper-plane" size={20} />
            </Button>
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    inputContainer: {
        alignItems: 'center',
        backgroundColor: colors.background,
        flexDirection: 'row',
        padding: 16,
    },
    sendButton: {
        backgroundColor: colors.primary,
    },
    textArea: {
        backgroundColor: colors.surface,
        color: colors.onSurface,
        flex: 1,
        marginRight: 8,
    },
});

export default ChatInputBar;
