import AppHeader from '@/components/AppHeader';
import CustomTextInput from '@/components/CustomTextInput';
import ThemedModal from '@/components/ThemedModal';
import { DARK, LIGHT, SYSTEM_DEFAULT } from '@/constants/colors';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { EATING_PHASES, NUTRITION_TYPES } from '@/constants/nutrition';
import {
    ADVANCED_SETTINGS_TYPE,
    AI_SETTINGS_TYPE,
    CAN_USE_GEMINI,
    CSV_IMPORT_TYPE,
    EXERCISE_IMAGE_GENERATION_TYPE,
    GEMINI_API_KEY_TYPE,
    HEALTH_CONNECT_TYPE,
    IMPERIAL_SYSTEM,
    JSON_IMPORT_TYPE,
    LANGUAGE_CHOICE_TYPE,
    METRIC_SYSTEM,
    OPENAI_API_KEY_TYPE,
    THEME_CHOICE_TYPE,
    UNIT_CHOICE_TYPE,
    USE_FAT_PERCENTAGE_TDEE_TYPE,
} from '@/constants/storage';
import { AVAILABLE_LANGUAGES, EN_US } from '@/lang/lang';
import { useCustomTheme } from '@/storage/CustomThemeProvider';
import { useHealthConnect } from '@/storage/HealthConnectProvider';
import { useSettings } from '@/storage/SettingsContext';
import { isValidApiKey } from '@/utils/ai';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { addUserMetrics, addUserNutrition, getUser } from '@/utils/database';
import { exportDatabase, importDatabase } from '@/utils/file';
import { aggregateUserNutritionMetricsDataByDate } from '@/utils/healthConnect';
import { generateHash } from '@/utils/string';
import { ThemeType } from '@/utils/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationProp } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Button, List, Switch, Text, useTheme } from 'react-native-paper';

import packageJson from '../package.json';

export default function Settings({ navigation }: { navigation: NavigationProp<any> }) {
    const { i18n, t } = useTranslation();
    const { checkIsPermitted, getHealthData, requestPermissions } = useHealthConnect();
    const { addOrUpdateSettingValue, getSettingByType, updateSettingValue } = useSettings();

    const [apiKey, setApiKey] = useState<null | string>(null);
    const [googleGeminiApiKey, setGoogleGeminiApiKey] = useState<null | string>(null);
    const [openAiModalVisible, setOpenAiModalVisible] = useState(false);
    const [geminiModalVisible, setOpenGeminiVisible] = useState(false);
    const [keyInput, setKeyInput] = useState('');
    const [googleGeminiKeyInput, setGoogleGeminiKeyInput] = useState('');
    const [themedModalVisible, setThemedModalVisible] = useState(false);
    const [selectedTheme, setSelectedTheme] = useState<ThemeType>(SYSTEM_DEFAULT);
    const [tempSelectedTheme, setTempSelectedTheme] = useState<ThemeType>(SYSTEM_DEFAULT);
    const [languageModalVisible, setLanguageModalVisible] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState<string>(EN_US);
    const [unitModalVisible, setUnitModalVisible] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState<string>(METRIC_SYSTEM);
    const [tempSelectedUnit, setTempSelectedUnit] = useState<string>(METRIC_SYSTEM);
    const [exerciseImageGeneration, setExerciseImageGeneration] = useState<boolean>(false);
    const [tempExerciseImageGeneration, setTempExerciseImageGeneration] = useState<boolean>(false);
    const [exerciseImageModalVisible, setExerciseImageModalVisible] = useState(false);
    const [healthConnectEnabled, setHealthConnectEnabled] = useState<boolean>(false);
    const [tempHealthConnectEnabled, setTempHealthConnectEnabled] = useState<boolean>(false);
    const [healthConnectModalVisible, setHealthConnectModalVisible] = useState(false);
    const [showCheckPermissionButton, setShowCheckPermissionButton] = useState(false);
    const [advancedSettingsEnabled, setAdvancedSettingsEnabled] = useState<boolean | undefined>(undefined);
    const [aiSettingsEnabled, setAiSettingsEnabled] = useState<boolean | undefined>(undefined);
    const [exportModalVisible, setExportModalVisible] = useState(false);
    const [importModalVisible, setImportModalVisible] = useState(false);
    const [jsonImportEnabled, setJsonImportEnabled] = useState<boolean>(false);
    const [tempJsonImportEnabled, setTempJsonImportEnabled] = useState<boolean>(false);
    const [jsonImportModalVisible, setJsonImportModalVisible] = useState(false);
    const [csvImportEnabled, setCsvImportEnabled] = useState<boolean>(false);
    const [tempCsvImportEnabled, setTempCsvImportEnabled] = useState<boolean>(false);
    const [csvImportModalVisible, setCsvImportModalVisible] = useState(false);
    const [canUseGemini, setCanUseGemini] = useState(false);
    const [loading, setLoading] = useState(false);
    const [appInfoModalVisible, setAppInfoModalVisible] = useState(false);
    const [encryptionPhrase, setEncryptionPhrase] = useState('');
    const [decryptionPhrase, setDecryptionPhrase] = useState('');
    const [useFatPercentageTDEE, setUseFatPercentageTDEE] = useState<boolean | undefined>(undefined);

    const { colors, dark } = useTheme<CustomThemeType>();
    const { setTheme } = useCustomTheme();
    const styles = makeStyles(colors, dark);

    const fetchSettings = useCallback(async () => {
        const apiKeyFromDb = await getSettingByType(OPENAI_API_KEY_TYPE);
        if (apiKeyFromDb) {
            setApiKey(apiKeyFromDb.value);
        }

        const googleGeminiApiKeyFromDb = await getSettingByType(GEMINI_API_KEY_TYPE);
        if (googleGeminiApiKeyFromDb) {
            setGoogleGeminiApiKey(googleGeminiApiKeyFromDb.value);
        }

        const themeChoiceFromDb = await getSettingByType(THEME_CHOICE_TYPE);
        if (themeChoiceFromDb) {
            setSelectedTheme(themeChoiceFromDb.value as ThemeType);
            setTempSelectedTheme(themeChoiceFromDb.value as ThemeType);
        }

        const languageChoiceFromDb = await getSettingByType(LANGUAGE_CHOICE_TYPE);
        if (languageChoiceFromDb) {
            setSelectedLanguage(languageChoiceFromDb.value);
            await i18n.changeLanguage(languageChoiceFromDb.value);
        }

        const unitChoiceFromDb = await getSettingByType(UNIT_CHOICE_TYPE);
        if (unitChoiceFromDb) {
            setSelectedUnit(unitChoiceFromDb.value);
            setTempSelectedUnit(unitChoiceFromDb.value);
        }

        const exerciseImageGenerationFromDb = await getSettingByType(EXERCISE_IMAGE_GENERATION_TYPE);
        if (exerciseImageGenerationFromDb) {
            const value = exerciseImageGenerationFromDb.value === 'true';
            setExerciseImageGeneration(value);
            setTempExerciseImageGeneration(value);
        }

        const healthConnectFromDb = await getSettingByType(HEALTH_CONNECT_TYPE);
        if (healthConnectFromDb) {
            const value = healthConnectFromDb.value === 'true';
            setHealthConnectEnabled(value);
            setTempHealthConnectEnabled(value);
        }

        const advancedSettingsFromDb = await getSettingByType(ADVANCED_SETTINGS_TYPE);
        if (advancedSettingsFromDb) {
            const value = advancedSettingsFromDb.value === 'true';
            setAdvancedSettingsEnabled(value);
        }

        const aiSettingsFromDb = await getSettingByType(AI_SETTINGS_TYPE);
        if (aiSettingsFromDb) {
            const value = aiSettingsFromDb.value === 'true';
            setAiSettingsEnabled(value);
        }

        const jsonImportFromDb = await getSettingByType(JSON_IMPORT_TYPE);
        if (jsonImportFromDb) {
            const value = jsonImportFromDb.value === 'true';
            setJsonImportEnabled(value);
            setTempJsonImportEnabled(value);
        }

        const csvImportFromDb = await getSettingByType(CSV_IMPORT_TYPE);
        if (csvImportFromDb) {
            const value = csvImportFromDb.value === 'true';
            setCsvImportEnabled(value);
            setTempCsvImportEnabled(value);
        }

        const useFatPercentageTDEEFromDb = await getSettingByType(USE_FAT_PERCENTAGE_TDEE_TYPE);
        if (useFatPercentageTDEEFromDb) {
            const value = useFatPercentageTDEEFromDb.value === 'true';
            setUseFatPercentageTDEE(value);
        }

        const canUseGemini = await AsyncStorage.getItem(CAN_USE_GEMINI);
        setCanUseGemini(canUseGemini === 'true');
    }, [i18n, getSettingByType]);

    useFocusEffect(useCallback(() => {
        fetchSettings();
    }, [fetchSettings]));

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.navigate('index');
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

    const handleConfirmThemeChange = useCallback(async () => {
        setLoading(true);
        await updateSettingWithLoadingState(THEME_CHOICE_TYPE, tempSelectedTheme);

        setSelectedTheme(tempSelectedTheme);
        setThemedModalVisible(false);
        setTheme(tempSelectedTheme);
        setLoading(false);
    }, [updateSettingWithLoadingState, tempSelectedTheme, setTheme]);

    const handleConfirmLanguageChange = useCallback(async () => {
        setLoading(true);
        await updateSettingWithLoadingState(LANGUAGE_CHOICE_TYPE, selectedLanguage);

        await i18n.changeLanguage(selectedLanguage);
        setLanguageModalVisible(false);
        setLoading(false);
    }, [updateSettingWithLoadingState, selectedLanguage, i18n]);

    const handleConfirmUnitChange = useCallback(async () => {
        setLoading(true);
        await updateSettingWithLoadingState(UNIT_CHOICE_TYPE, tempSelectedUnit);

        setSelectedUnit(tempSelectedUnit);
        setUnitModalVisible(false);
        setLoading(false);
    }, [updateSettingWithLoadingState, tempSelectedUnit]);

    const handleConfirmExerciseImageGenerationChange = useCallback(async () => {
        setLoading(true);
        await updateSettingWithLoadingState(EXERCISE_IMAGE_GENERATION_TYPE, tempExerciseImageGeneration.toString());

        setExerciseImageGeneration(tempExerciseImageGeneration);
        setExerciseImageModalVisible(false);
        setLoading(false);
    }, [updateSettingWithLoadingState, tempExerciseImageGeneration]);

    const getHealthConnectData = useCallback(async () => {
        const isPermitted = await checkIsPermitted();
        if (isPermitted) {
            const healthData = await getHealthData();

            if (healthData) {
                const latestHeight = healthData?.heightRecords?.[0];
                const latestWeight = healthData?.weightRecords?.[0];
                const latestBodyFat = healthData?.bodyFatRecords?.[0];

                const aggregatedData = aggregateUserNutritionMetricsDataByDate(
                    latestHeight,
                    latestWeight,
                    latestBodyFat
                );

                const user = await getUser();
                for (const [date, healthData] of Object.entries(aggregatedData)) {
                    await addUserMetrics({
                        dataId: healthData.bodyFatData?.metadata?.id
                            || healthData.heightData?.metadata?.id
                            || healthData.weightData?.metadata?.id
                            || generateHash(),
                        date,
                        eatingPhase: user?.metrics?.eatingPhase || EATING_PHASES.MAINTENANCE,
                        fatPercentage: healthData.bodyFatData?.percentage || 0,
                        height: healthData.heightData?.height?.inMeters || 0,
                        source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                        weight: healthData.weightData?.weight?.inKilograms || 0,
                    });
                }

                if (healthData.nutritionRecords) {
                    for (const nutrition of healthData.nutritionRecords) {
                        await addUserNutrition({
                            calories: nutrition.energy?.inKilocalories || 0,
                            carbohydrate: nutrition.totalCarbohydrate?.inGrams || 0,
                            createdAt: nutrition.startTime,
                            dataId: nutrition?.metadata?.id || generateHash(),
                            date: nutrition.startTime,
                            fat: nutrition?.totalFat?.inGrams || 0,
                            fiber: nutrition?.dietaryFiber?.inGrams || 0,
                            monounsaturatedFat: nutrition?.monounsaturatedFat?.inGrams || 0,
                            name: nutrition?.name || '',
                            polyunsaturatedFat: nutrition?.polyunsaturatedFat?.inGrams || 0,
                            protein: nutrition?.protein?.inGrams || 0,
                            saturatedFat: nutrition?.saturatedFat?.inGrams || 0,
                            source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                            sugar: nutrition?.sugar?.inGrams || 0,
                            transFat: nutrition?.transFat?.inGrams || 0,
                            type: NUTRITION_TYPES.MEAL,
                            unsaturatedFat: nutrition?.unsaturatedFat?.inGrams || 0,
                        });
                    }
                }
            }
        }
    }, [checkIsPermitted, getHealthData]);

    const handleConfirmHealthConnectChange = useCallback(async () => {
        setLoading(true);
        await updateSettingWithLoadingState(HEALTH_CONNECT_TYPE, tempHealthConnectEnabled.toString());

        setHealthConnectEnabled(tempHealthConnectEnabled);
        setHealthConnectModalVisible(false);
        await getHealthConnectData();
        setLoading(false);
    }, [updateSettingWithLoadingState, tempHealthConnectEnabled, getHealthConnectData]);

    const handleEnableHealthConnect = useCallback(async () => {
        const isPermitted = await checkIsPermitted();
        if (isPermitted) {
            setTempHealthConnectEnabled(true);
            setShowCheckPermissionButton(false);
            await getHealthConnectData();
        } else {
            requestPermissions();
            setShowCheckPermissionButton(true);
        }
    }, [checkIsPermitted, getHealthConnectData, requestPermissions]);

    const handleCheckPermissions = useCallback(async () => {
        const isPermitted = await checkIsPermitted();
        if (isPermitted) {
            setTempHealthConnectEnabled(true);
            setShowCheckPermissionButton(false);
        } else {
            setTempHealthConnectEnabled(false);
            setShowCheckPermissionButton(false);
        }
    }, [checkIsPermitted]);

    const handleToggleAdvancedSettings = useCallback(async () => {
        setLoading(true);
        setAdvancedSettingsEnabled(!advancedSettingsEnabled);
        setLoading(false);
    }, [advancedSettingsEnabled]);

    const handleToggleAISettings = useCallback(async () => {
        setLoading(true);
        setAiSettingsEnabled(!aiSettingsEnabled);
        setLoading(false);
    }, [aiSettingsEnabled]);

    const handleToggleUseFatPercentageTDEE = useCallback(async () => {
        setLoading(true);
        setUseFatPercentageTDEE(!useFatPercentageTDEE);
        setLoading(false);
    }, [useFatPercentageTDEE]);

    useEffect(() => {
        const saveAdvancedSettings = async () => {
            if (advancedSettingsEnabled !== undefined) {
                const newValue = advancedSettingsEnabled.toString();
                await updateSettingWithLoadingState(ADVANCED_SETTINGS_TYPE, newValue);
            }
        }

        saveAdvancedSettings();
    }, [advancedSettingsEnabled, updateSettingWithLoadingState, updateSettingValue]);

    useEffect(() => {
        const saveAISettings = async () => {
            if (aiSettingsEnabled !== undefined) {
                const newValue = aiSettingsEnabled.toString();
                await updateSettingWithLoadingState(AI_SETTINGS_TYPE, newValue);
            }
        }

        saveAISettings();
    }, [aiSettingsEnabled, updateSettingValue, updateSettingWithLoadingState]);

    useEffect(() => {
        const saveUseFatPercentageTDEE = async () => {
            if (useFatPercentageTDEE !== undefined) {
                const newValue = useFatPercentageTDEE.toString();
                await updateSettingWithLoadingState(USE_FAT_PERCENTAGE_TDEE_TYPE, newValue);
            }
        }

        saveUseFatPercentageTDEE();
    }, [useFatPercentageTDEE, updateSettingValue, updateSettingWithLoadingState]);

    const handleExportDatabase = useCallback(async () => {
        setLoading(true);

        // this hack is necessary so that the UI can update before the async operation
        await new Promise((resolve) => setTimeout(async (data) => {
            await exportDatabase(encryptionPhrase);
            return resolve(data);
        }, 0));

        setExportModalVisible(false);
        setLoading(false);
    }, [encryptionPhrase]);

    const handleImportDatabase = useCallback(async () => {
        setLoading(true);

        // this hack is necessary so that the UI can update before the async operation
        await new Promise((resolve) => setTimeout(async (data) => {
            await importDatabase(decryptionPhrase);
            return resolve(data);
        }, 0));

        setImportModalVisible(false);
        setLoading(false);
    }, [decryptionPhrase]);

    const handleConfirmJsonImportChange = useCallback(async () => {
        setLoading(true);
        await updateSettingWithLoadingState(JSON_IMPORT_TYPE, tempJsonImportEnabled.toString());

        setJsonImportEnabled(tempJsonImportEnabled);
        setJsonImportModalVisible(false);
        setLoading(false);
    }, [updateSettingWithLoadingState, tempJsonImportEnabled]);

    const handleConfirmCsvImportChange = useCallback(async () => {
        setLoading(true);
        await updateSettingWithLoadingState(CSV_IMPORT_TYPE, tempCsvImportEnabled.toString());

        setCsvImportEnabled(tempCsvImportEnabled);
        setCsvImportModalVisible(false);
        setLoading(false);
    }, [updateSettingWithLoadingState, tempCsvImportEnabled]);

    const resetScreenData = useCallback(() => {
        setOpenAiModalVisible(false);
        setOpenGeminiVisible(false);
        setThemedModalVisible(false);
        setLanguageModalVisible(false);
        setUnitModalVisible(false);
        setExerciseImageModalVisible(false);
        setHealthConnectModalVisible(false);
        setShowCheckPermissionButton(false);
        setExportModalVisible(false);
        setImportModalVisible(false);
        setJsonImportModalVisible(false);
        setCsvImportModalVisible(false);
        setAppInfoModalVisible(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            return () => {
                resetScreenData();
            };
        }, [resetScreenData])
    );

    const handleVisitOurWebsite = useCallback(() => {
        Linking.openURL('https://blopa.github.io/musclog-website/');
    }, []);

    return (
        <View style={styles.container}>
            <AppHeader title={t('settings')} />
            <ScrollView contentContainerStyle={styles.settingsContainer} keyboardShouldPersistTaps="handled">
                <List.Section>
                    <List.Subheader>{t('general_settings')}</List.Subheader>
                    <List.Item
                        description={t('theme_description')}
                        onPress={() => setThemedModalVisible(true)}
                        right={() => (
                            <View style={styles.rightContainer}>
                                <Text>{t(selectedTheme.toLowerCase().replace(' ', '_'))}</Text>
                                <List.Icon icon="chevron-right" />
                            </View>
                        )}
                        title={t('theme')}
                    />
                    <List.Item
                        description={t('language_description')}
                        onPress={() => setLanguageModalVisible(true)}
                        right={() => (
                            <View style={styles.rightContainer}>
                                <Text>{t(selectedLanguage)}</Text>
                                <List.Icon icon="chevron-right" />
                            </View>
                        )}
                        title={t('language')}
                    />
                    <List.Item
                        description={t('unit_description')}
                        onPress={() => setUnitModalVisible(true)}
                        right={() => (
                            <View style={styles.rightContainer}>
                                <Text>{t(selectedUnit)}</Text>
                                <List.Icon icon="chevron-right" />
                            </View>
                        )}
                        title={t('unit_system')}
                    />
                    <List.Item
                        description={t('health_connect_description')}
                        onPress={() => setHealthConnectModalVisible(true)}
                        right={() => (
                            <View style={styles.rightContainer}>
                                <Text>{healthConnectEnabled ? t('enabled') : t('disabled')}</Text>
                                <List.Icon icon="chevron-right" />
                            </View>
                        )}
                        title={t('health_connect')}
                    />
                    <List.Item
                        description={t('ai_settings_description')}
                        onPress={handleToggleAISettings}
                        right={() => (
                            <View style={styles.rightContainer}>
                                <Switch onChange={handleToggleAISettings} value={aiSettingsEnabled} />
                            </View>
                        )}
                        title={t('ai_settings')}
                    />
                    {aiSettingsEnabled ? (
                        <List.Section>
                            <List.Subheader>{t('ai_settings')}</List.Subheader>
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
                            {canUseGemini ? (
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
                            ) : null}
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
                    ) : null}
                    <List.Item
                        description={t('advanced_settings_description')}
                        onPress={handleToggleAdvancedSettings}
                        right={() => (
                            <View style={styles.rightContainer}>
                                <Switch onChange={handleToggleAdvancedSettings} value={advancedSettingsEnabled} />
                            </View>
                        )}
                        title={t('advanced_settings')}
                    />
                </List.Section>
                {advancedSettingsEnabled ? (
                    <List.Section>
                        <List.Subheader>{t('advanced_settings')}</List.Subheader>
                        <List.Item
                            description={t('export_description')}
                            onPress={() => setExportModalVisible(true)}
                            right={() => (
                                <View style={styles.rightContainer}>
                                    <List.Icon icon="chevron-right" />
                                </View>
                            )}
                            title={t('export_database')}
                        />
                        <List.Item
                            description={t('import_description')}
                            onPress={() => setImportModalVisible(true)}
                            right={() => (
                                <View style={styles.rightContainer}>
                                    <List.Icon icon="chevron-right" />
                                </View>
                            )}
                            title={t('import_database')}
                        />
                        <List.Item
                            description={t('json_import_description')}
                            onPress={() => setJsonImportModalVisible(true)}
                            right={() => (
                                <View style={styles.rightContainer}>
                                    <Text>{jsonImportEnabled ? t('enabled') : t('disabled')}</Text>
                                    <List.Icon icon="chevron-right" />
                                </View>
                            )}
                            title={t('json_import')}
                        />
                        <List.Item
                            description={t('csv_import_description')}
                            onPress={() => setCsvImportModalVisible(true)}
                            right={() => (
                                <View style={styles.rightContainer}>
                                    <Text>{csvImportEnabled ? t('enabled') : t('disabled')}</Text>
                                    <List.Icon icon="chevron-right" />
                                </View>
                            )}
                            title={t('csv_import')}
                        />
                    </List.Section>
                ) : null}
                <List.Section>
                    <List.Subheader>{t('user_metrics')}</List.Subheader>
                    <List.Item
                        description={t('use_fat_percentage_tdee_description')}
                        onPress={handleToggleUseFatPercentageTDEE}
                        right={() => (
                            <View style={styles.rightContainer}>
                                <Switch onChange={handleToggleUseFatPercentageTDEE} value={useFatPercentageTDEE} />
                            </View>
                        )}
                        title={t('use_fat_percentage_tdee')}
                    />
                </List.Section>
                <List.Section>
                    <List.Item
                        description={t('app_info_about')}
                        onPress={() => setAppInfoModalVisible(true)}
                        right={() => (
                            <View style={styles.rightContainer}>
                                <List.Icon icon="chevron-right" />
                            </View>
                        )}
                        title={t('app_info')}
                    />
                    <List.Item
                        description={t('learn_more_about_it')}
                        onPress={handleVisitOurWebsite}
                        right={() => (
                            <View style={styles.rightContainer}>
                                <List.Icon icon="chevron-right" />
                            </View>
                        )}
                        title={t('visit_our_website')}
                    />
                </List.Section>
            </ScrollView>
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
                onClose={() => setThemedModalVisible(false)}
                onConfirm={handleConfirmThemeChange}
                title={t('choose_theme')}
                visible={themedModalVisible}
            >
                <View style={styles.radioContainer}>
                    <TouchableOpacity onPress={() => setTempSelectedTheme(LIGHT)} style={styles.radio}>
                        <Text style={styles.radioText}>{t('light')}</Text>
                        <Text style={styles.radioText}>{tempSelectedTheme === LIGHT ? '✔' : ''}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setTempSelectedTheme(DARK)} style={styles.radio}>
                        <Text style={styles.radioText}>{t('dark')}</Text>
                        <Text style={styles.radioText}>{tempSelectedTheme === DARK ? '✔' : ''}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setTempSelectedTheme(SYSTEM_DEFAULT)} style={styles.radio}>
                        <Text style={styles.radioText}>{t('system_default')}</Text>
                        <Text style={styles.radioText}>{tempSelectedTheme === SYSTEM_DEFAULT ? '✔' : ''}</Text>
                    </TouchableOpacity>
                    {loading ? <ActivityIndicator color={colors.surface} /> : null}
                </View>
            </ThemedModal>
            <ThemedModal
                cancelText={t('cancel')}
                confirmText={t('confirm')}
                onClose={() => setLanguageModalVisible(false)}
                onConfirm={handleConfirmLanguageChange}
                title={t('language')}
                visible={languageModalVisible}
            >
                <View style={styles.radioContainer}>
                    {AVAILABLE_LANGUAGES.map((lang) => (
                        <TouchableOpacity key={lang} onPress={() => setSelectedLanguage(lang)} style={styles.radio}>
                            <Text style={styles.radioText}>{t(`langs.${lang.toLowerCase()}`)}</Text>
                            <Text style={styles.radioText}>{selectedLanguage === lang ? '✔' : ''}</Text>
                        </TouchableOpacity>
                    ))}
                    {loading ? <ActivityIndicator color={colors.surface} /> : null}
                </View>
            </ThemedModal>
            <ThemedModal
                cancelText={t('cancel')}
                confirmText={t('confirm')}
                onClose={() => setUnitModalVisible(false)}
                onConfirm={handleConfirmUnitChange}
                title={t('unit_system')}
                visible={unitModalVisible}
            >
                <View style={styles.radioContainer}>
                    <TouchableOpacity onPress={() => setTempSelectedUnit(METRIC_SYSTEM)} style={styles.radio}>
                        <Text style={styles.radioText}>{t('metric')}</Text>
                        <Text style={styles.radioText}>{tempSelectedUnit === METRIC_SYSTEM ? '✔' : ''}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setTempSelectedUnit(IMPERIAL_SYSTEM)} style={styles.radio}>
                        <Text style={styles.radioText}>{t('imperial')}</Text>
                        <Text style={styles.radioText}>{tempSelectedUnit === IMPERIAL_SYSTEM ? '✔' : ''}</Text>
                    </TouchableOpacity>
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
            <ThemedModal
                cancelText={t('cancel')}
                confirmText={showCheckPermissionButton ? undefined : (loading ? undefined : t('confirm'))}
                onClose={() => setHealthConnectModalVisible(false)}
                onConfirm={showCheckPermissionButton ? undefined : (loading ? undefined : handleConfirmHealthConnectChange)}
                title={t('health_connect')}
                visible={healthConnectModalVisible}
            >
                <View style={styles.radioContainer}>
                    {!showCheckPermissionButton ? (
                        <>
                            <TouchableOpacity onPress={() => handleEnableHealthConnect()} style={styles.radio}>
                                <Text style={styles.radioText}>{t('enabled')}</Text>
                                <Text style={styles.radioText}>{tempHealthConnectEnabled ? '✔' : ''}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setTempHealthConnectEnabled(false)} style={styles.radio}>
                                <Text style={styles.radioText}>{t('disabled')}</Text>
                                <Text style={styles.radioText}>{!tempHealthConnectEnabled ? '✔' : ''}</Text>
                            </TouchableOpacity>
                            {loading ? <ActivityIndicator color={colors.surface} /> : null}
                        </>
                    ) : null}
                    {showCheckPermissionButton ? (
                        <View style={styles.validateButtonWrapper}>
                            <Button
                                disabled={loading}
                                mode="contained"
                                onPress={loading ? undefined : handleCheckPermissions}
                                style={styles.validateButton}
                            >
                                {loading ? <ActivityIndicator color={colors.surface} /> : t('validate_permissions')}
                            </Button>
                        </View>
                    ) : null}
                </View>
            </ThemedModal>
            <ThemedModal
                cancelText={t('cancel')}
                confirmText={t('confirm')}
                onClose={() => setExportModalVisible(false)}
                onConfirm={handleExportDatabase}
                title={t('confirm_export')}
                visible={exportModalVisible}
            >
                <View style={styles.modalContent}>
                    <CustomTextInput
                        label={t('export_confirmation')}
                        onChangeText={setEncryptionPhrase}
                        placeholder={t('enter_encryption_phrase')}
                        value={encryptionPhrase}
                    />
                    {loading ? <ActivityIndicator color={colors.surface} /> : null}
                </View>
            </ThemedModal>
            <ThemedModal
                cancelText={t('cancel')}
                confirmText={t('confirm')}
                onClose={() => setImportModalVisible(false)}
                onConfirm={handleImportDatabase}
                title={t('confirm_import')}
                visible={importModalVisible}
            >
                <View style={styles.modalContent}>
                    <CustomTextInput
                        label={t('import_confirmation')}
                        onChangeText={setDecryptionPhrase}
                        placeholder={t('enter_decryption_phrase')}
                        value={decryptionPhrase}
                    />
                    {loading ? <ActivityIndicator color={colors.surface} /> : null}
                </View>
            </ThemedModal>
            <ThemedModal
                cancelText={t('cancel')}
                confirmText={t('confirm')}
                onClose={() => setJsonImportModalVisible(false)}
                onConfirm={handleConfirmJsonImportChange}
                title={t('json_import')}
                visible={jsonImportModalVisible}
            >
                <View style={styles.radioContainer}>
                    <TouchableOpacity onPress={() => setTempJsonImportEnabled(true)} style={styles.radio}>
                        <Text style={styles.radioText}>{t('enabled')}</Text>
                        <Text style={styles.radioText}>{tempJsonImportEnabled ? '✔' : ''}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setTempJsonImportEnabled(false)} style={styles.radio}>
                        <Text style={styles.radioText}>{t('disabled')}</Text>
                        <Text style={styles.radioText}>{!tempJsonImportEnabled ? '✔' : ''}</Text>
                    </TouchableOpacity>
                    {loading ? <ActivityIndicator color={colors.surface} /> : null}
                </View>
            </ThemedModal>
            <ThemedModal
                cancelText={t('cancel')}
                confirmText={t('confirm')}
                onClose={() => setCsvImportModalVisible(false)}
                onConfirm={handleConfirmCsvImportChange}
                title={t('csv_import')}
                visible={csvImportModalVisible}
            >
                <View style={styles.radioContainer}>
                    <TouchableOpacity onPress={() => setTempCsvImportEnabled(true)} style={styles.radio}>
                        <Text style={styles.radioText}>{t('enabled')}</Text>
                        <Text style={styles.radioText}>{tempCsvImportEnabled ? '✔' : ''}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setTempCsvImportEnabled(false)} style={styles.radio}>
                        <Text style={styles.radioText}>{t('disabled')}</Text>
                        <Text style={styles.radioText}>{!tempCsvImportEnabled ? '✔' : ''}</Text>
                    </TouchableOpacity>
                    {loading ? <ActivityIndicator color={colors.surface} /> : null}
                </View>
            </ThemedModal>
            <ThemedModal
                cancelText={t('close')}
                onClose={() => setAppInfoModalVisible(false)}
                title={t('app_info')}
                visible={appInfoModalVisible}
            >
                <ScrollView style={styles.modalContent}>
                    <Text>{t('app_info_description')}</Text>
                    <Text>{'\n'}</Text>
                    <Text>{t('app_resources')}</Text>
                    <View style={styles.resourcesList}>
                        <Text>{`\u2022 ${t('react_native')}`}</Text>
                        <Text>{`\u2022 ${t('expo')}`}</Text>
                        <Text>{`\u2022 ${t('chat_avatar')}`}</Text>
                    </View>
                    <Text>{t('app_version', { version: packageJson.version })}</Text>
                </ScrollView>
            </ThemedModal>
        </View>
    );
}

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    confirmMessage: {
        marginBottom: 28,
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
    modalContent: {
        backgroundColor: colors.background,
        padding: 16,
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
    resourcesList: {
        marginBottom: 10,
        marginTop: 10,
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
    validateButton: {
        borderRadius: 28,
        marginHorizontal: '10%',
        minWidth: '80%',
    },
    validateButtonWrapper: {
        marginHorizontal: 'auto',
        width: '100%',
    },
});