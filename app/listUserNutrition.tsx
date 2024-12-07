import AnimatedSearchBar from '@/components/AnimatedSearchBar';
import CustomTextArea from '@/components/CustomTextArea';
import FABWrapper from '@/components/FABWrapper';
import { Screen } from '@/components/Screen';
import ThemedCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import {
    AI_SETTINGS_TYPE,
    CSV_IMPORT_TYPE,
    GRAMS,
    IMPERIAL_SYSTEM,
    JSON_IMPORT_TYPE,
    METRIC_SYSTEM,
    OUNCES,
} from '@/constants/storage';
import { FAB_ICON_SIZE, ICON_SIZE } from '@/constants/ui';
import useUnit from '@/hooks/useUnit';
import { useHealthConnect } from '@/storage/HealthConnectProvider';
import { useSettings } from '@/storage/SettingsContext';
import { useSnackbar } from '@/storage/SnackbarProvider';
import { getAiApiVendor, parsePastNutrition } from '@/utils/ai';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { isEmptyObject } from '@/utils/data';
import {
    deleteAllUserNutritionFromHealthConnect,
    deleteUserNutrition,
    getTotalUserNutritionCount,
    getUserNutritionPaginated,
    processPastNutrition,
} from '@/utils/database';
import { formatDate } from '@/utils/date';
import { importCsv, importJson } from '@/utils/file';
import { safeToFixed } from '@/utils/string';
import { ParsedPastNutrition, UserNutritionDecryptedReturnType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import { validateParsedPastNutritionArray } from '@/utils/validation';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    BackHandler,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { Appbar, Button, Card, Checkbox, Text, useTheme } from 'react-native-paper';

export default function ListUserNutrition({ navigation }: { navigation: NavigationProp<any> }) {
    const { t } = useTranslation();
    const [userNutritions, setUserNutritions] = useState<UserNutritionDecryptedReturnType[]>([]);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [isConfirmRemoveAllVisible, setIsConfirmRemoveAllVisible] = useState(false);
    const [nutritionToDelete, setNutritionToDelete] = useState<null | number>(null);
    const [isAiEnabled, setIsAiEnabled] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [jsonImportModalVisible, setJsonImportModalVisible] = useState(false);
    const [csvImportModalVisible, setCsvImportModalVisible] = useState(false);
    const [isModalLoading, setIsModalLoading] = useState(false);
    const [textInputValue, setTextInputValue] = useState('');
    const [jsonImportEnabled, setJsonImportEnabled] = useState(false);
    const [csvImportEnabled, setCsvImportEnabled] = useState(false);
    const [jsonData, setJsonData] = useState([]);
    const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
    const [jsonFilename, setJsonFilename] = useState('');
    const [csvFilename, setCsvFilename] = useState('');
    const [totalUserNutritionCount, setTotalUserNutritionCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [importAsFullDayOfEating, setImportAsFullDayOfEating] = useState(false);

    const { checkWriteIsPermitted, deleteHealthData } = useHealthConnect();

    const { showSnackbar } = useSnackbar();
    const { getSettingByType } = useSettings();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { unitSystem } = useUnit();
    const macroUnit = unitSystem === METRIC_SYSTEM ? GRAMS : OUNCES;
    const [searchQuery, setSearchQuery] = useState('');
    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const loadUserNutrition = useCallback(async (offset = 0, limit = 20) => {
        try {
            const loadedUserNutrition = await getUserNutritionPaginated(offset, limit, 'DESC');

            setUserNutritions((prevState) => {
                const combinedData = [
                    ...prevState,
                    ...loadedUserNutrition.filter(
                        (data) => !prevState.some((prevData) => prevData.id === data.id)
                    ),
                ];

                combinedData.sort((a, b) => {
                    if (a.date < b.date) {
                        return -1;
                    }

                    if (a.date > b.date) {
                        return 1;
                    }

                    if (a?.id! < b?.id!) {
                        return 1;
                    }

                    if (a?.id! > b?.id!) {
                        return -1;
                    }

                    return 0;
                });

                return combinedData;
            });

            const vendor = await getAiApiVendor();
            const isAiSettingsEnabled = await getSettingByType(AI_SETTINGS_TYPE);
            const hasAiEnabled = Boolean(vendor) && isAiSettingsEnabled?.value === 'true';
            setIsAiEnabled(hasAiEnabled);

            const jsonImportEnabledFromDb = await getSettingByType(JSON_IMPORT_TYPE);
            if (jsonImportEnabledFromDb) {
                const value = jsonImportEnabledFromDb.value === 'true';
                setJsonImportEnabled(value);
            }

            const csvImportEnabledFromDb = await getSettingByType(CSV_IMPORT_TYPE);
            if (csvImportEnabledFromDb) {
                const value = csvImportEnabledFromDb.value === 'true';
                setCsvImportEnabled(value);
            }
        } catch (error) {
            console.error('Failed to load user nutrition:', error);
        }
    }, [getSettingByType]);

    const resetScreenData = useCallback(() => {
        setSearchQuery('');
        setUserNutritions([]);
        setIsDeleteModalVisible(false);
        setIsConfirmRemoveAllVisible(false);
        setNutritionToDelete(null);
        setJsonImportModalVisible(false);
        setCsvImportModalVisible(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.navigate('userMetricsCharts');
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [navigation])
    );

    const fetchTotalUserNutritionCount = useCallback(async () => {
        const totalCount = await getTotalUserNutritionCount();
        setTotalUserNutritionCount(totalCount);
    }, []);

    const loadMoreUserNutrition = useCallback(() => {
        if (userNutritions.length >= totalUserNutritionCount) {
            return;
        }

        loadUserNutrition(userNutritions.length);
    }, [userNutritions.length, totalUserNutritionCount, loadUserNutrition]);

    const handleDeleteNutrition = useCallback(async (id: number) => {
        setNutritionToDelete(id);
        setIsDeleteModalVisible(true);
    }, []);

    const handleDeleteConfirmation = useCallback(async () => {
        if (nutritionToDelete) {
            try {
                await deleteUserNutrition(nutritionToDelete);

                const isWritePermitted = await checkWriteIsPermitted(['Nutrition']);
                if (isWritePermitted) {
                    const userNutrition = userNutritions.find((nutrition) => nutrition.id === nutritionToDelete);
                    if (userNutrition?.source === USER_METRICS_SOURCES.HEALTH_CONNECT && userNutrition.dataId) {
                        await deleteHealthData('Nutrition', [userNutrition.dataId]);
                        console.log(`Deleted health connect data with dataId: ${userNutrition.dataId}`);
                    }
                }

                const updatedUserNutrition = userNutritions.filter((nutrition) => nutrition.id !== nutritionToDelete);
                setUserNutritions(updatedUserNutrition);
                setIsDeleteModalVisible(false);
                setNutritionToDelete(null);
            } catch (error) {
                console.error('Failed to delete user nutrition:', error);
            }
        }
    }, [checkWriteIsPermitted, deleteHealthData, nutritionToDelete, userNutritions]);

    const handleImportNutritionWithAi = useCallback(async () => {
        setIsModalLoading(true);

        try {
            const response = await parsePastNutrition(textInputValue);

            if (response) {
                const parsedNutrition = response?.pastNutrition as ParsedPastNutrition[];
                await processPastNutrition(parsedNutrition);
                showSnackbar(t('nutrition_imported'), t('ok'), () => {});
            }
        } catch (error) {
            console.error('Failed to import nutrition:', error);
            showSnackbar(t('failed_to_parse_data'), t('ok'), () => {});
        }

        setModalVisible(false);
        setIsModalLoading(false);
        loadUserNutrition();
    }, [loadUserNutrition, textInputValue, t, showSnackbar]);

    const handleImportJsonFile = useCallback(async () => {
        if (!isEmptyObject(jsonData) && validateParsedPastNutritionArray(jsonData)) {
            await processPastNutrition(jsonData as ParsedPastNutrition[], importAsFullDayOfEating);
            showSnackbar(t('nutrition_imported'), t('ok'), () => {});
            setJsonData([]);
            setJsonFilename('');
        } else {
            showSnackbar(t('failed_to_parse_data'), t('ok'), () => {});
        }

        setJsonImportModalVisible(false);
        loadUserNutrition();
    }, [jsonData, showSnackbar, t, loadUserNutrition, importAsFullDayOfEating]);

    const handleImportCsvFile = useCallback(async () => {
        if (!isEmptyObject(csvData) && validateParsedPastNutritionArray(csvData)) {
            await processPastNutrition(csvData as ParsedPastNutrition[]);
            showSnackbar(t('nutrition_imported'), t('ok'), () => {});
            setCsvData([]);
            setCsvFilename('');
        } else {
            showSnackbar(t('failed_to_parse_data'), t('ok'), () => {});
        }

        setCsvImportModalVisible(false);
        loadUserNutrition();
    }, [csvData, showSnackbar, t, loadUserNutrition]);

    const handleSelectJsonFile = useCallback(async () => {
        try {
            const { data, fileName } = await importJson();

            if (fileName && data) {
                setJsonData(data);
                setJsonFilename(fileName);
            }
        } catch (error) {
            console.error('Failed to import JSON file:', error);
            showSnackbar(t('failed_to_parse_data'), t('ok'), () => {});
        }
    }, [showSnackbar, t]);

    const handleSelectCsvFile = useCallback(async () => {
        try {
            const { data, fileName } = await importCsv();

            if (fileName && data) {
                setCsvData(data);
                setCsvFilename(fileName);
            }
        } catch (error) {
            console.error('Failed to import CSV file:', error);
            showSnackbar(t('failed_to_parse_data'), t('ok'), () => {});
        }
    }, [showSnackbar, t]);

    const handleDeleteCancel = () => {
        setIsDeleteModalVisible(false);
        setNutritionToDelete(null);
    };

    const filteredUserNutrition = useMemo(() => userNutritions.reverse().filter((nutrition) => {
        const searchLower = searchQuery.toLowerCase();
        return (
            nutrition.name?.toLowerCase().includes(searchLower)
            || nutrition.calories?.toString().toLowerCase()
                .includes(searchLower)
            || nutrition.carbohydrate?.toString().toLowerCase()
                .includes(searchLower)
            || nutrition.fat?.toString().toLowerCase()
                .includes(searchLower)
            || nutrition.protein?.toString().toLowerCase()
                .includes(searchLower)
            || nutrition.date?.toLowerCase().includes(searchLower)
            || nutrition.dataId?.toLowerCase().includes(searchLower)
            || nutrition.deletedAt?.toLowerCase().includes(searchLower)
            || nutrition.userId?.toString().toLowerCase()
                .includes(searchLower)
        );
    }), [userNutritions, searchQuery]);

    const handleCancelImportJson = useCallback(() => {
        setJsonImportModalVisible(false);
        setJsonData([]);
        setJsonFilename('');
    }, []);

    const handleCancelImportCsv = useCallback(() => {
        setCsvImportModalVisible(false);
        setCsvData([]);
        setCsvFilename('');
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchTotalUserNutritionCount();
            loadUserNutrition();

            return () => {
                resetScreenData();
            };
        }, [fetchTotalUserNutritionCount, loadUserNutrition, resetScreenData])
    );

    const handleRemoveAllHealthConnectData = useCallback(async () => {
        setIsConfirmRemoveAllVisible(true);
    }, []);

    const handleRemoveAllConfirmation = useCallback(async () => {
        try {
            setIsLoading(true);
            await deleteAllUserNutritionFromHealthConnect();
            setUserNutritions([]);
            setTotalUserNutritionCount(0);
            await fetchTotalUserNutritionCount();
            await loadUserNutrition();
            setIsLoading(false);
            setIsConfirmRemoveAllVisible(false);
        } catch (error) {
            console.error('Failed to delete all nutrition data:', error);
        }
    }, [fetchTotalUserNutritionCount, loadUserNutrition]);

    const fabActions = useMemo(() => {
        const actions = [{
            icon: () => <FontAwesome5 color={colors.primary} name="plus" size={FAB_ICON_SIZE} />,
            label: t('create_user_nutrition'),
            onPress: () => navigation.navigate('createUserNutrition'),
            style: { backgroundColor: colors.surface },
        }, {
            icon: () => <FontAwesome5 color={colors.primary} name="trash" size={FAB_ICON_SIZE} />,
            label: t('delete_all_health_connect_data'),
            onPress: handleRemoveAllHealthConnectData,
            style: { backgroundColor: colors.surface },
        }];

        if (jsonImportEnabled) {
            actions.unshift({
                icon: () => <FontAwesome5 color={colors.primary} name="file-import" size={FAB_ICON_SIZE} />,
                label: t('import_from_json_file'),
                onPress: () => setJsonImportModalVisible(true),
                style: { backgroundColor: colors.surface },
            });
        }

        if (csvImportEnabled) {
            actions.unshift({
                icon: () => <FontAwesome5 color={colors.primary} name="file-csv" size={FAB_ICON_SIZE} />,
                label: t('import_from_csv_file'),
                onPress: () => setCsvImportModalVisible(true),
                style: { backgroundColor: colors.surface },
            });
        }

        if (isAiEnabled) {
            actions.unshift({
                icon: () => <FontAwesome5 color={colors.primary} name="brain" size={ICON_SIZE} />,
                label: t('import_nutrition_data'),
                onPress: () => setModalVisible(true),
                style: { backgroundColor: colors.surface },
            });
        }

        return actions;
    }, [t, colors.surface, colors.primary, handleRemoveAllHealthConnectData, jsonImportEnabled, csvImportEnabled, isAiEnabled, navigation]);

    return (
        <Screen style={styles.container}>
            <FABWrapper actions={fabActions} icon="cog" visible>
                <View style={styles.container}>
                    <Appbar.Header
                        mode="small"
                        statusBarHeight={0}
                        style={styles.appbarHeader}
                    >
                        <Appbar.Content title={t('user_nutrition')} titleStyle={styles.appbarTitle} />
                        <AnimatedSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
                    </Appbar.Header>
                    <FlashList
                        contentContainerStyle={styles.scrollViewContent}
                        data={filteredUserNutrition}
                        estimatedItemSize={115}
                        keyExtractor={(item) => (item?.id ? item.id.toString() : 'default')}
                        ListFooterComponent={userNutritions.length < totalUserNutritionCount ? <ActivityIndicator /> : null}
                        onEndReached={loadMoreUserNutrition}
                        onEndReachedThreshold={0.5}
                        renderItem={({ item: nutrition }) => (
                            <ThemedCard key={nutrition.id}>
                                <Card.Content style={styles.cardContent}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardTitle}>
                                            {formatDate(nutrition.date)}
                                        </Text>
                                        <View style={styles.metricRow}>
                                            <Text style={styles.metricDetail}>{t('name')}: {nutrition.name}</Text>
                                        </View>
                                        <View style={styles.metricRow}>
                                            <Text style={styles.metricDetail}>{t('calories')}: {safeToFixed(nutrition.calories)}kcal</Text>
                                            <Text style={styles.metricDetail}>{t('carbs')}: {getDisplayFormattedWeight(nutrition.carbohydrate, GRAMS, isImperial)}{macroUnit}</Text>
                                        </View>
                                        <View style={styles.metricRow}>
                                            <Text style={styles.metricDetail}>{t('fats')}: {getDisplayFormattedWeight(nutrition.fat, GRAMS, isImperial)}{macroUnit}</Text>
                                            <Text style={styles.metricDetail}>{t('proteins')}: {getDisplayFormattedWeight(nutrition.protein, GRAMS, isImperial)}{macroUnit}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.cardActions}>
                                        <FontAwesome5
                                            color={colors.primary}
                                            name="edit"
                                            onPress={() => navigation.navigate('createUserNutrition', { id: nutrition.id })}
                                            size={ICON_SIZE}
                                            style={styles.iconButton}
                                        />
                                        <FontAwesome5
                                            color={colors.primary}
                                            name="trash"
                                            onPress={() => handleDeleteNutrition(nutrition.id!)}
                                            size={ICON_SIZE}
                                            style={styles.iconButton}
                                        />
                                    </View>
                                </Card.Content>
                            </ThemedCard>
                        )}
                    />
                    <ThemedModal
                        cancelText={!isModalLoading ? t('cancel') : undefined}
                        confirmText={!isModalLoading ? t('import') : undefined}
                        onClose={() => setModalVisible(false)}
                        onConfirm={!isModalLoading ? handleImportNutritionWithAi : undefined}
                        visible={modalVisible}
                    >
                        {isModalLoading ? (
                            <>
                                <ActivityIndicator size="large" style={styles.loadingIndicator} />
                                <Text style={styles.loadingText}>{t('this_might_take_a_minute_or_more')}</Text>
                            </>
                        ) : (
                            <>
                                <Text style={styles.modalTitle}>{t('past_nutrition')}</Text>
                                <CustomTextArea
                                    numberOfLines={4}
                                    onChangeText={setTextInputValue}
                                    placeholder={t('write_down_past_nutrition')}
                                    value={textInputValue}
                                />
                            </>
                        )}
                    </ThemedModal>
                    <ThemedModal
                        cancelText={t('cancel')}
                        confirmText={jsonFilename ? t('import') : undefined}
                        onClose={handleCancelImportJson}
                        onConfirm={jsonFilename ? handleImportJsonFile : undefined}
                        visible={jsonImportModalVisible}
                    >
                        <ScrollView contentContainerStyle={styles.scrollContainer}>
                            <Text style={styles.modalTitle}>
                                {t('import_from_json_file')}
                            </Text>
                            <Text style={styles.modalText}>
                                {t('past_nutrition_json_format_description', {
                                    jsonFormat: JSON.stringify([{
                                        calories: 2500,
                                        carbs: 300,
                                        cholesterol: 200,
                                        date: '2023-06-15',
                                        fat: 80,
                                        fat_saturated: 20,
                                        fat_unsaturated: 60,
                                        fiber: 25,
                                        potassium: 3500,
                                        protein: 150,
                                        sodium: 2300,
                                        sugar: 50,
                                        type: 'full_day || meal',
                                    }], null, 1),
                                })}
                            </Text>
                            <View style={styles.checkboxContainer}>
                                <Checkbox
                                    onPress={() => setImportAsFullDayOfEating(!importAsFullDayOfEating)}
                                    status={importAsFullDayOfEating ? 'checked' : 'unchecked'}
                                />
                                <Pressable
                                    onPress={() => setImportAsFullDayOfEating(!importAsFullDayOfEating)}
                                >
                                    <Text style={styles.checkboxLabel}>
                                        {t('import_as_full_day_of_eating')}
                                    </Text>
                                </Pressable>
                            </View>
                        </ScrollView>
                        {jsonFilename ? (
                            <View style={styles.selectedFileWrapper}>
                                <Text>{t('selected_file')}: {jsonFilename}</Text>
                            </View>
                        ) : (
                            <Button mode="contained" onPress={handleSelectJsonFile} style={styles.selectJsonButton}>
                                {t('select_json_file')}
                            </Button>
                        )}
                    </ThemedModal>
                    <ThemedModal
                        cancelText={t('cancel')}
                        confirmText={csvFilename ? t('import') : undefined}
                        onClose={handleCancelImportCsv}
                        onConfirm={csvFilename ? handleImportCsvFile : undefined}
                        visible={csvImportModalVisible}
                    >
                        <ScrollView contentContainerStyle={styles.scrollContainer}>
                            <Text style={styles.modalTitle}>
                                {t('import_from_csv_file')}
                            </Text>
                            <Text style={styles.modalText}>
                                {t('past_nutrition_csv_format_description', {
                                    csvColumns: ['date', 'name', 'amount_in_grams', 'calories', 'carbs', 'fiber', 'sugar', 'cholesterol', 'fat', 'fat_saturated', 'fat_unsaturated', 'potassium', 'protein', 'sodium'].join(','),
                                })}
                            </Text>
                        </ScrollView>
                        {csvFilename ? (
                            <View style={styles.selectedFileWrapper}>
                                <Text>{t('selected_file')}: {csvFilename}</Text>
                            </View>
                        ) : (
                            <Button mode="contained" onPress={handleSelectCsvFile} style={styles.selectJsonButton}>
                                {t('select_csv_file')}
                            </Button>
                        )}
                    </ThemedModal>
                    <ThemedModal
                        cancelText={t('no')}
                        confirmText={t('yes')}
                        onClose={handleDeleteCancel}
                        onConfirm={handleDeleteConfirmation}
                        title={t('delete_confirmation_generic', {
                            title: userNutritions.find((nutrition) => nutrition.id === nutritionToDelete)?.name,
                        })}
                        visible={isDeleteModalVisible}
                    />
                    <ThemedModal
                        cancelText={t('no')}
                        confirmText={t('yes')}
                        onClose={() => setIsConfirmRemoveAllVisible(false)}
                        onConfirm={handleRemoveAllConfirmation}
                        title={t('delete_all_health_connect_data_confirmation')}
                        visible={isConfirmRemoveAllVisible}
                    >
                        {isLoading && (
                            <ActivityIndicator color={colors.primary} size="large" />
                        )}
                    </ThemedModal>
                </View>
            </FABWrapper>
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
    cardActions: {
        alignItems: 'center',
        flexDirection: 'row',
        marginTop: 8,
    },
    cardContent: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    cardHeader: {
        flex: 1,
        marginRight: 22,
    },
    cardTitle: {
        color: colors.onSurface,
        fontSize: 18,
        fontWeight: 'bold',
    },
    checkboxContainer: {
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: 12,
        marginTop: 12,
    },
    checkboxLabel: {
        color: colors.onBackground,
        fontSize: 16,
        marginLeft: 8,
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    iconButton: {
        marginHorizontal: 8,
    },
    loadingIndicator: {
        marginVertical: 16,
    },
    loadingText: {
        color: colors.onBackground,
        fontSize: 16,
        marginTop: 8,
        textAlign: 'center',
    },
    metricDetail: {
        color: colors.onSurface,
        fontSize: 14,
        marginBottom: 4,
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    modalText: {
        fontSize: 14,
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    scrollContainer: {
        flex: 1,
    },
    scrollViewContent: {
        backgroundColor: colors.background,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    selectedFileWrapper: {
        marginBottom: 24,
    },
    selectJsonButton: {
        marginBottom: 12,
    },
});
