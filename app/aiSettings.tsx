import CustomTextInput from '@/components/CustomTextInput';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { Screen } from '@/components/Screen';
import ThemedModal from '@/components/ThemedModal';
import {
    EXERCISE_IMAGE_GENERATION_TYPE,
    GEMINI_API_KEY_TYPE,
    GOOGLE_OAUTH_GEMINI_ENABLED_TYPE,
    GOOGLE_REFRESH_TOKEN_TYPE,
    OPENAI_API_KEY_TYPE,
} from '@/constants/storage';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useSettings } from '@/storage/SettingsContext';
import { isValidApiKey } from '@/utils/ai';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { getSetting } from '@/utils/database';
import { deleteAllData, handleGoogleSignIn } from '@/utils/googleAuth';
import { NavigationProp } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, List, Text, useTheme } from 'react-native-paper';


export default function AISettings({ navigation }: { navigation: NavigationProp<any> }) {
    const { i18n, t } = useTranslation();
    const { addOrUpdateSettingValue, getSettingByType, updateSettingValue } = useSettings();
    const { authData, promptAsync } = useGoogleAuth();

    const [apiKey, setApiKey] = useState<null | string>(null);
    const [googleGeminiApiKey, setGoogleGeminiApiKey] = useState<null | string>(null);
    const [openAiModalVisible, setOpenAiModalVisible] = useState(false);
    const [geminiModalVisible, setOpenGeminiVisible] = useState(false);
    const [keyInput, setKeyInput] = useState('');
    const [googleGeminiKeyInput, setGoogleGeminiKeyInput] = useState('');
    const [exerciseImageGeneration, setExerciseImageGeneration] = useState<boolean>(false);
    const [tempExerciseImageGeneration, setTempExerciseImageGeneration] = useState<boolean>(false);
    const [exerciseImageModalVisible, setExerciseImageModalVisible] = useState(false);

    const [loading, setLoading] = useState(false);

    const [isGoogleOauthGeminiEnabled, setIsGoogleOauthGeminiEnabled] = useState<boolean | undefined>(undefined);

    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [refreshToken, setRefreshToken] = useState<null | string>(null);
    const [googleSignInModalVisible, setGoogleSignInModalVisible] = useState(false);

    const fetchSettings = useCallback(async () => {
        const apiKeyFromDb = await getSettingByType(OPENAI_API_KEY_TYPE);
        if (apiKeyFromDb) {
            setApiKey(apiKeyFromDb.value);
        }

        const googleGeminiApiKeyFromDb = await getSettingByType(GEMINI_API_KEY_TYPE);
        if (googleGeminiApiKeyFromDb) {
            setGoogleGeminiApiKey(googleGeminiApiKeyFromDb.value);
        }

        const exerciseImageGenerationFromDb = await getSettingByType(EXERCISE_IMAGE_GENERATION_TYPE);
        if (exerciseImageGenerationFromDb) {
            const value = exerciseImageGenerationFromDb.value === 'true';
            setExerciseImageGeneration(value);
            setTempExerciseImageGeneration(value);
        }

        const googleRefreshTokenFromDb = await getSettingByType(GOOGLE_REFRESH_TOKEN_TYPE);
        if (googleRefreshTokenFromDb) {
            setRefreshToken(googleRefreshTokenFromDb.value);
        }

        const googleOauthGeminiElabledFromDb = await getSettingByType(GOOGLE_OAUTH_GEMINI_ENABLED_TYPE);
        if (googleOauthGeminiElabledFromDb) {
            const value = googleOauthGeminiElabledFromDb.value === 'true';
            setIsGoogleOauthGeminiEnabled(value);
        }
    }, [getSettingByType]);

    useFocusEffect(
        useCallback(() => {
            fetchSettings();
        }, [fetchSettings])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.navigate('settings');
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [navigation])
    );

    const updateSettingWithLoadingState = useCallback(async (type: string, value: string) => {
        // this hack is necessary so that the UI can update before the async operation
        await new Promise((resolve) => setTimeout(async (data) => {
            await addOrUpdateSettingValue(type, value);
            return resolve(data);
        }, 0));
    }, [addOrUpdateSettingValue]);

    const handleGoogleSignInPress = useCallback(async () => {
        setLoading(true);
        await promptAsync();
        setLoading(false);
    }, [promptAsync]);

    const handleGoogleSignOut = useCallback(async () => {
        setLoading(true);
        await deleteAllData();
        setRefreshToken(null);
        await updateSettingValue(GOOGLE_REFRESH_TOKEN_TYPE, '');
        setLoading(false);
        setGoogleSignInModalVisible(false);
    }, [updateSettingValue]);

    useEffect(() => {
        const handleGoogleSignInResponse = async () => {
            if (authData) {
                setLoading(true);
                const isAllowed = await handleGoogleSignIn(authData);
                if (isAllowed) {
                    const storedRefreshToken = await getSetting(GOOGLE_REFRESH_TOKEN_TYPE);

                    if (storedRefreshToken?.value) {
                        setRefreshToken(storedRefreshToken.value);
                    }
                }

                setLoading(false);
                setGoogleSignInModalVisible(false);
            }
        };

        handleGoogleSignInResponse();
    }, [authData, updateSettingValue]);

    const handleSaveOpenAiKey = useCallback(async () => {
        setLoading(true);
        const isValid = await isValidApiKey(keyInput, OPENAI_API_KEY_TYPE);
        if (!isValid) {
            setOpenAiModalVisible(false);
            setLoading(false);
            return;
        }

        await updateSettingWithLoadingState(OPENAI_API_KEY_TYPE, keyInput);

        setApiKey(keyInput);
        setOpenAiModalVisible(false);
        setLoading(false);
    }, [keyInput, updateSettingWithLoadingState]);

    const handleRemoveKey = useCallback(async () => {
        setLoading(true);
        await updateSettingValue(OPENAI_API_KEY_TYPE, '');
        setApiKey(null);
        setKeyInput('');
        setOpenAiModalVisible(false);
        setLoading(false);
    }, [updateSettingValue]);

    const handleSaveGoogleGeminiKey = useCallback(async () => {
        setLoading(true);
        const isValid = await isValidApiKey(googleGeminiKeyInput, GEMINI_API_KEY_TYPE);
        if (!isValid) {
            setOpenGeminiVisible(false);
            setLoading(false);
            return;
        }

        await updateSettingWithLoadingState(GEMINI_API_KEY_TYPE, googleGeminiKeyInput);

        setGoogleGeminiApiKey(googleGeminiKeyInput);
        setOpenGeminiVisible(false);
        setLoading(false);
    }, [googleGeminiKeyInput, updateSettingWithLoadingState]);

    const handleRemoveGoogleGeminiKey = useCallback(async () => {
        setLoading(true);
        await updateSettingValue(GEMINI_API_KEY_TYPE, '');
        setGoogleGeminiApiKey(null);
        setGoogleGeminiKeyInput('');
        setOpenGeminiVisible(false);
        setLoading(false);
    }, [updateSettingValue]);

    const handleConfirmExerciseImageGenerationChange = useCallback(async () => {
        setLoading(true);
        await updateSettingWithLoadingState(EXERCISE_IMAGE_GENERATION_TYPE, tempExerciseImageGeneration.toString());

        setExerciseImageGeneration(tempExerciseImageGeneration);
        setExerciseImageModalVisible(false);
        setLoading(false);
    }, [updateSettingWithLoadingState, tempExerciseImageGeneration]);

    const handleToggleGoogleOauthGeminiElabled = useCallback(async () => {
        setLoading(true);
        setIsGoogleOauthGeminiEnabled(!isGoogleOauthGeminiEnabled);
        setLoading(false);
    }, [isGoogleOauthGeminiEnabled]);

    useEffect(() => {
        const saveGoogleOauthGeminiElabled = async () => {
            if (isGoogleOauthGeminiEnabled !== undefined) {
                const newValue = isGoogleOauthGeminiEnabled.toString();
                await updateSettingWithLoadingState(GOOGLE_OAUTH_GEMINI_ENABLED_TYPE, newValue);
            }
        };

        saveGoogleOauthGeminiElabled();
    }, [isGoogleOauthGeminiEnabled, updateSettingWithLoadingState]);

    const resetScreenData = useCallback(() => {
        setOpenAiModalVisible(false);
        setOpenGeminiVisible(false);
        setExerciseImageModalVisible(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            return () => {
                resetScreenData();
            };
        }, [resetScreenData])
    );

    return (
        <Screen style={styles.container}>
            <Appbar.Header
                mode="small"
                statusBarHeight={0}
                style={styles.appbarHeader}
            >
                <Appbar.Content title={t('ai_settings')} titleStyle={styles.appbarTitle} />
                <Button
                    mode="outlined"
                    onPress={() => navigation.navigate('settings')}
                    textColor={colors.onPrimary}
                >
                    {t('back')}
                </Button>
            </Appbar.Header>
            <ScrollView contentContainerStyle={styles.settingsContainer} keyboardShouldPersistTaps="handled">
                <List.Section>
                    <List.Subheader>{t('ai_provider_settings')}</List.Subheader>
                    <List.Item
                        description={t('google_gemini_oauth_description')}
                        onPress={handleToggleGoogleOauthGeminiElabled}
                        right={() => (
                            <View style={styles.rightContainer}>
                                <Text>{isGoogleOauthGeminiEnabled ? t('enabled') : t('disabled')}</Text>
                                <List.Icon icon="chevron-right" />
                            </View>
                        )}
                        title={t('google_gemini_oauth')}
                    />
                    <List.Item
                        description={t('openai_key_description')}
                        onPress={() => {
                            setKeyInput(apiKey || '');
                            setOpenAiModalVisible(true);
                        }}
                        right={() => (
                            <View style={styles.rightContainer}>
                                <Text>{apiKey ? '**********' : t('not_set')}</Text>
                                <List.Icon icon="chevron-right" />
                            </View>
                        )}
                        title={t('openai_key')}
                    />
                    <List.Item
                        description={t('google_gemini_key_description')}
                        onPress={() => {
                            setGoogleGeminiKeyInput(googleGeminiApiKey || '');
                            setOpenGeminiVisible(true);
                        }}
                        right={() => (
                            <View style={styles.rightContainer}>
                                <Text>{googleGeminiApiKey ? '**********' : t('not_set')}</Text>
                                <List.Icon icon="chevron-right" />
                            </View>
                        )}
                        title={t('google_gemini_key')}
                    />
                </List.Section>
                <List.Section>
                    <List.Subheader>{t('misc')}</List.Subheader>
                    <List.Item
                        description={t('exercise_image_generation_description')}
                        onPress={() => setExerciseImageModalVisible(true)}
                        right={() => (
                            <View style={styles.rightContainer}>
                                <Text>{exerciseImageGeneration ? t('enabled') : t('disabled')}</Text>
                                <List.Icon icon="chevron-right" />
                            </View>
                        )}
                        title={t('exercise_image_generation')}
                    />
                </List.Section>
            </ScrollView>
            <ThemedModal
                cancelText={t('cancel')}
                onClose={() => setGoogleSignInModalVisible(false)}
                title={t('google_sign_in')}
                visible={googleSignInModalVisible}
            >
                <View style={styles.modalContent}>
                    {refreshToken ? (
                        <>
                            <Text style={styles.modalText}>
                                {t('signed_in')}
                            </Text>
                            <GoogleSignInButton
                                disabled={loading}
                                onSignIn={handleGoogleSignInPress}
                                variant="reauthenticate"
                            />
                            <Button
                                disabled={loading}
                                mode="contained"
                                onPress={handleGoogleSignOut}
                                style={styles.modalButton}
                            >
                                {t('sign_out')}
                            </Button>
                        </>
                    ) : (
                        <GoogleSignInButton disabled={loading} onSignIn={handleGoogleSignInPress} />
                    )}
                    {loading ? <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} /> : null}
                </View>
            </ThemedModal>
            <ThemedModal
                cancelText={t('cancel')}
                confirmText={t('confirm')}
                onClose={() => setOpenAiModalVisible(false)}
                onConfirm={handleSaveOpenAiKey}
                title={t('openai_key')}
                visible={openAiModalVisible}
            >
                <View style={styles.openAiModalContent}>
                    <CustomTextInput
                        label={t('openai_key')}
                        onChangeText={setKeyInput}
                        placeholder={t('enter_openai_key')}
                        value={keyInput}
                    />
                    {apiKey ? (
                        <Button
                            disabled={loading}
                            labelStyle={styles.deleteButtonContent}
                            mode="contained"
                            onPress={handleRemoveKey}
                            style={styles.deleteButton}
                        >
                            {loading ? <ActivityIndicator color={colors.surface} /> : t('remove')}
                        </Button>
                    ) : null}
                    {loading ? <ActivityIndicator color={colors.surface} /> : null}
                </View>
            </ThemedModal>
            <ThemedModal
                cancelText={t('cancel')}
                confirmText={t('confirm')}
                onClose={() => setOpenGeminiVisible(false)}
                onConfirm={handleSaveGoogleGeminiKey}
                title={t('google_gemini_key')}
                visible={geminiModalVisible}
            >
                <View style={styles.openAiModalContent}>
                    <CustomTextInput
                        label={t('google_gemini_key')}
                        onChangeText={setGoogleGeminiKeyInput}
                        placeholder={t('enter_google_gemini_key')}
                        value={googleGeminiKeyInput}
                    />
                    {googleGeminiApiKey ? (
                        <Button
                            disabled={loading}
                            labelStyle={styles.deleteButtonContent}
                            mode="contained"
                            onPress={handleRemoveGoogleGeminiKey}
                            style={styles.deleteButton}
                        >
                            {loading ? <ActivityIndicator color={colors.surface} /> : t('remove')}
                        </Button>
                    ) : null}
                    {loading ? <ActivityIndicator color={colors.surface} /> : null}
                </View>
            </ThemedModal>
            <ThemedModal
                cancelText={t('cancel')}
                confirmText={t('confirm')}
                onClose={() => setExerciseImageModalVisible(false)}
                onConfirm={handleConfirmExerciseImageGenerationChange}
                title={t('exercise_image_generation')}
                visible={exerciseImageModalVisible}
            >
                <View style={styles.radioContainer}>
                    <TouchableOpacity onPress={() => setTempExerciseImageGeneration(true)} style={styles.radio}>
                        <Text style={styles.radioText}>{t('enabled')}</Text>
                        <Text style={styles.radioText}>{tempExerciseImageGeneration ? '✔' : ''}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setTempExerciseImageGeneration(false)} style={styles.radio}>
                        <Text style={styles.radioText}>{t('disabled')}</Text>
                        <Text style={styles.radioText}>{!tempExerciseImageGeneration ? '✔' : ''}</Text>
                    </TouchableOpacity>
                    {loading ? <ActivityIndicator color={colors.surface} /> : null}
                </View>
            </ThemedModal>
        </Screen>
    );
}

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    appbarHeader: {
        backgroundColor: colors.primary,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    appbarTitle: {
        color: colors.onPrimary,
        fontSize: Platform.OS === 'web' ? 20 : 26,
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    deleteButton: {
        backgroundColor: colors.tertiary,
        borderRadius: 28,
        marginTop: 8,
        width: '100%',
    },
    deleteButtonContent: {
        color: colors.surface,
    },
    loadingIndicator: {
        marginTop: 16,
    },
    modalButton: {
        marginVertical: 8,
        width: '80%',
    },
    modalContent: {
        alignItems: 'center',
        backgroundColor: colors.background,
        padding: 16,
    },
    modalText: {
        color: colors.onSurface,
        fontSize: 16,
        marginBottom: 16,
        textAlign: 'center',
    },
    openAiModalContent: {
        backgroundColor: colors.background,
        padding: 16,
    },
    radio: {
        backgroundColor: colors.surface,
        borderColor: colors.shadow,
        borderRadius: 28,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: '10%',
        marginVertical: 5,
        paddingHorizontal: 20,
        paddingVertical: 10,
        width: '80%',
    },
    radioContainer: {
        backgroundColor: colors.background,
        borderRadius: 28,
        marginBottom: 20,
        width: '100%',
    },
    radioText: {
        color: colors.onSurface,
        fontSize: 16,
    },
    rightContainer: {
        alignItems: 'center',
        flexDirection: 'row',
    },
    settingsContainer: {
        backgroundColor: colors.background,
        borderRadius: 28,
        padding: 16,
    },
});
