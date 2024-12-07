import AnimatedSearchBar from '@/components/AnimatedSearchBar';
import FABWrapper from '@/components/FABWrapper';
import { Screen } from '@/components/Screen';
import ThemedCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import { CSV_IMPORT_TYPE, IMPERIAL_SYSTEM, JSON_IMPORT_TYPE, KILOGRAMS } from '@/constants/storage';
import { FAB_ICON_SIZE, ICON_SIZE } from '@/constants/ui';
import useUnit from '@/hooks/useUnit';
import { useSettings } from '@/storage/SettingsContext';
import { useSnackbar } from '@/storage/SnackbarProvider';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import {
    deleteAllUserMetricsFromHealthConnect,
    deleteUserMetrics,
    getTotalUserMetricsCount,
    getUserMetricsPaginated,
    processUserMetrics,
} from '@/utils/database';
import { formatDate } from '@/utils/date';
import { importCsv, importJson } from '@/utils/file';
import { safeToFixed } from '@/utils/string';
import { ParsedUserMetrics, UserMetricsDecryptedReturnType } from '@/utils/types';
import { getDisplayFormattedHeight, getDisplayFormattedWeight } from '@/utils/unit';
import { validateParsedUserMetricsArray } from '@/utils/validation';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, Card, Text, useTheme } from 'react-native-paper';

export default function ListUserMetrics({ navigation }: { navigation: NavigationProp<any> }) {
    const { t } = useTranslation();
    const [userMetrics, setUserMetrics] = useState<UserMetricsDecryptedReturnType[]>([]);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [isConfirmRemoveAllVisible, setIsConfirmRemoveAllVisible] = useState(false);
    const [metricToDelete, setMetricToDelete] = useState<null | number>(null);
    const [totalUserMetricsCount, setTotalUserMetricsCount] = useState(0);
    const [jsonImportEnabled, setJsonImportEnabled] = useState(false);
    const [csvImportEnabled, setCsvImportEnabled] = useState(false);
    const [jsonImportModalVisible, setJsonImportModalVisible] = useState(false);
    const [csvImportModalVisible, setCsvImportModalVisible] = useState(false);
    const [jsonData, setJsonData] = useState([]);
    const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
    const [jsonFilename, setJsonFilename] = useState('');
    const [csvFilename, setCsvFilename] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { showSnackbar } = useSnackbar();
    const { getSettingByType } = useSettings();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { heightUnit, unitSystem, weightUnit } = useUnit();
    const [searchQuery, setSearchQuery] = useState('');
    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const loadUserMetrics = useCallback(async (offset = 0, limit = 20) => {
        try {
            const loadedUserMetrics = await getUserMetricsPaginated(offset, limit);

            setUserMetrics((prevState) => {
                const combinedData = [
                    ...prevState,
                    ...loadedUserMetrics.filter(
                        (data) => !prevState.some((prevData) => prevData.id === data.id)
                    ),
                ];

                combinedData.sort((a, b) => {
                    if (a.date < b.date) {
                        return 1;
                    }

                    if (a.date > b.date) {
                        return -1;
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
            console.error('Failed to load user metrics:', error);
        }
    }, [getSettingByType]);

    const loadMoreUserMetrics = useCallback(() => {
        if (userMetrics.length >= totalUserMetricsCount) {
            return;
        }

        loadUserMetrics(userMetrics.length);
    }, [userMetrics.length, totalUserMetricsCount, loadUserMetrics]);

    const fetchTotalUserMetricsCount = useCallback(async () => {
        const totalCount = await getTotalUserMetricsCount();
        setTotalUserMetricsCount(totalCount);
    }, []);

    const resetScreenData = useCallback(() => {
        setSearchQuery('');
        setUserMetrics([]);
        setIsDeleteModalVisible(false);
        setMetricToDelete(null);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchTotalUserMetricsCount();
            loadUserMetrics();

            return () => {
                resetScreenData();
            };
        }, [fetchTotalUserMetricsCount, loadUserMetrics, resetScreenData])
    );

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

    const handleDeleteMetric = useCallback(async (id: number) => {
        setMetricToDelete(id);
        setIsDeleteModalVisible(true);
    }, []);

    const handleDeleteConfirmation = useCallback(async () => {
        if (metricToDelete) {
            try {
                await deleteUserMetrics(metricToDelete);
                const updatedUserMetrics = userMetrics.filter((metric) => metric.id !== metricToDelete);
                setUserMetrics(updatedUserMetrics);
                setIsDeleteModalVisible(false);
                setMetricToDelete(null);
                setTotalUserMetricsCount((prevState) => prevState - 1);
            } catch (error) {
                console.error('Failed to delete user metric:', error);
            }
        }
    }, [metricToDelete, userMetrics]);

    const handleDeleteCancel = useCallback(() => {
        setIsDeleteModalVisible(false);
        setMetricToDelete(null);
    }, []);

    const filteredUserMetrics = useMemo(() => userMetrics.filter((metric) => {
        const searchLower = searchQuery.toLowerCase();
        return (
            metric.eatingPhase?.toLowerCase().includes(searchLower)
            || metric.height?.toString().toLowerCase()
                .includes(searchLower)
            || metric.weight?.toString().toLowerCase()
                .includes(searchLower)
            || metric.fatPercentage?.toString().toLowerCase()
                .includes(searchLower)
            || metric.date?.toLowerCase().includes(searchLower)
            || metric.dataId?.toLowerCase().includes(searchLower)
            || metric.deletedAt?.toLowerCase().includes(searchLower)
            || metric.userId?.toString().toLowerCase()
                .includes(searchLower)
        );
    }), [userMetrics, searchQuery]);

    const handleRemoveAllHealthConnectData = useCallback(async () => {
        setIsConfirmRemoveAllVisible(true);
    }, []);

    const handleRemoveAllConfirmation = useCallback(async () => {
        try {
            setIsLoading(true);
            await deleteAllUserMetricsFromHealthConnect();
            setUserMetrics([]);
            setTotalUserMetricsCount(0);
            await fetchTotalUserMetricsCount();
            await loadUserMetrics();
            setIsLoading(false);
            setIsConfirmRemoveAllVisible(false);
        } catch (error) {
            console.error('Failed to delete all health connect data:', error);
        }
    }, [fetchTotalUserMetricsCount, loadUserMetrics]);

    const handleRemoveAllCancel = useCallback(() => {
        setIsConfirmRemoveAllVisible(false);
    }, []);

    const handleImportJsonFile = useCallback(async () => {
        try {
            const { data, fileName } = await importJson();

            if (fileName && data) {
                setJsonData(data);
                setJsonFilename(fileName);
                setJsonImportModalVisible(true);
            }
        } catch (error) {
            console.error('Failed to import JSON file:', error);
            alert(t('failed_to_parse_data'));
        }
    }, [t]);

    const handleImportCsvFile = useCallback(async () => {
        try {
            const { data, fileName } = await importCsv();

            if (fileName && data) {
                setCsvData(data);
                setCsvFilename(fileName);
                setCsvImportModalVisible(true);
            }
        } catch (error) {
            console.error('Failed to import CSV file:', error);
            alert(t('failed_to_parse_data'));
        }
    }, [t]);

    const handleConfirmJsonImport = useCallback(async () => {
        if (jsonData.length) {
            await processUserMetrics(jsonData as ParsedUserMetrics[]);
            showSnackbar(t('user_metrics_imported'), t('ok'), () => {});
            setJsonData([]);
            setJsonFilename('');
        } else {
            showSnackbar(t('failed_to_parse_data'), t('ok'), () => {});
        }

        setJsonImportModalVisible(false);
        loadUserMetrics();
    }, [jsonData, loadUserMetrics, showSnackbar, t]);

    const handleConfirmCsvImport = useCallback(async () => {
        if (validateParsedUserMetricsArray(csvData)) {
            await processUserMetrics(csvData);
            showSnackbar(t('user_metrics_imported'), t('ok'), () => {});
            setCsvData([]);
            setCsvFilename('');
        } else {
            showSnackbar(t('failed_to_parse_data'), t('ok'), () => {});
        }

        setCsvImportModalVisible(false);
        loadUserMetrics();
    }, [csvData, loadUserMetrics, showSnackbar, t]);

    const fabActions = useMemo(() => {
        const actions = [{
            icon: () => <FontAwesome5 color={colors.primary} name="plus" size={FAB_ICON_SIZE} />,
            label: t('create_user_nutrition'),
            onPress: () => navigation.navigate('createUserMetrics'),
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
                onPress: handleImportJsonFile,
                style: { backgroundColor: colors.surface },
            });
        }

        // TODO: Implement this MAYBE
        // if (isAiEnabled) {
        //     actions.unshift({
        //         icon: () => <FontAwesome5 color={colors.primary} name="brain" size={ICON_SIZE} />,
        //         label: t('import_nutrition_data'),
        //         onPress: () => setModalVisible(true),
        //         style: { backgroundColor: colors.surface },
        //     });
        // }

        if (csvImportEnabled) {
            actions.unshift({
                icon: () => <FontAwesome5 color={colors.primary} name="file-csv" size={FAB_ICON_SIZE} />,
                label: t('import_from_csv_file'),
                onPress: handleImportCsvFile,
                style: { backgroundColor: colors.surface },
            });
        }

        return actions;
    }, [t, colors.surface, colors.primary, handleRemoveAllHealthConnectData, jsonImportEnabled, csvImportEnabled, navigation, handleImportJsonFile, handleImportCsvFile]);

    return (
        <Screen style={styles.container}>
            <FABWrapper actions={fabActions} icon="cog" visible>
                <View style={styles.container}>
                    <Appbar.Header
                        mode="small"
                        statusBarHeight={0}
                        style={styles.appbarHeader}
                    >
                        <Appbar.Content title={t('user_metrics')} titleStyle={styles.appbarTitle} />
                        <AnimatedSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
                    </Appbar.Header>
                    <FlashList
                        contentContainerStyle={styles.scrollViewContent}
                        data={filteredUserMetrics}
                        estimatedItemSize={95}
                        keyExtractor={(item) => (item?.id ? item.id.toString() : 'default')}
                        ListFooterComponent={userMetrics.length < totalUserMetricsCount ? <ActivityIndicator /> : null}
                        onEndReached={loadMoreUserMetrics}
                        onEndReachedThreshold={0.5}
                        renderItem={({ item: metric }) => (
                            <ThemedCard key={metric.id}>
                                <Card.Content style={styles.cardContent}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardTitle}>{formatDate(metric.date || metric.createdAt || '')}</Text>
                                        <View style={styles.metricRow}>
                                            {metric.height ? (
                                                <Text style={styles.metricDetailText}>{t('height', { heightUnit })}: {getDisplayFormattedHeight(metric.height, isImperial)}</Text>
                                            ) : null}
                                            {metric.weight ? (
                                                <Text style={styles.metricDetailText}>{t('weight', { weightUnit })}: {getDisplayFormattedWeight(metric.weight, KILOGRAMS, isImperial)}</Text>
                                            ) : null}
                                        </View>
                                        <View>
                                            {metric.fatPercentage ? (
                                                <View style={styles.metricDetail}>
                                                    <Text style={styles.metricDetailText}>{t('fat_percentage')}: {safeToFixed(metric.fatPercentage)}</Text>
                                                </View>
                                            ) : null}
                                            {metric.eatingPhase ? (
                                                <View style={styles.metricDetail}>
                                                    <Text style={styles.metricDetailText}>{t('eating_phase')}: {t(metric.eatingPhase)}</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    </View>
                                    <View style={styles.cardActions}>
                                        <FontAwesome5
                                            color={colors.primary}
                                            name="edit"
                                            onPress={() => navigation.navigate('createUserMetrics', { id: metric.id })}
                                            size={ICON_SIZE}
                                            style={styles.iconButton}
                                        />
                                        <FontAwesome5
                                            color={colors.primary}
                                            name="trash"
                                            onPress={() => handleDeleteMetric(metric.id!)}
                                            size={ICON_SIZE}
                                            style={styles.iconButton}
                                        />
                                    </View>
                                </Card.Content>
                            </ThemedCard>
                        )}
                    />
                    <ThemedModal
                        cancelText={t('cancel')}
                        confirmText={t('import')}
                        onClose={() => setJsonImportModalVisible(false)}
                        onConfirm={handleConfirmJsonImport}
                        visible={jsonImportModalVisible}
                    >
                        <ScrollView contentContainerStyle={styles.scrollContainer}>
                            <Text style={styles.modalTitle}>
                                {t('import_from_json_file')}
                            </Text>
                            <Text style={styles.modalText}>
                                {t('past_metrics_json_format_description', {
                                    jsonFormat: JSON.stringify([{
                                        date: '2023-06-15',
                                        fatPercentage: 15,
                                        height: 1.80,
                                        weight: 75,
                                    }], null, 1),
                                })}
                            </Text>
                        </ScrollView>
                        {jsonFilename ? (
                            <View style={styles.selectedFileWrapper}>
                                <Text>{t('selected_file')}: {jsonFilename}</Text>
                            </View>
                        ) : (
                            <Button mode="contained" onPress={handleImportJsonFile} style={styles.selectJsonButton}>
                                {t('select_json_file')}
                            </Button>
                        )}
                    </ThemedModal>
                    <ThemedModal
                        cancelText={t('cancel')}
                        confirmText={t('import')}
                        onClose={() => setCsvImportModalVisible(false)}
                        onConfirm={handleConfirmCsvImport}
                        visible={csvImportModalVisible}
                    >
                        <ScrollView contentContainerStyle={styles.scrollContainer}>
                            <Text style={styles.modalTitle}>
                                {t('import_from_csv_file')}
                            </Text>
                            <Text style={styles.modalText}>
                                {t('past_metrics_csv_format_description', {
                                    csvColumns: ['date', 'fatPercentage', 'height', 'weight'].join(', '),
                                })}
                            </Text>
                        </ScrollView>
                        {csvFilename ? (
                            <View style={styles.selectedFileWrapper}>
                                <Text>{t('selected_file')}: {csvFilename}</Text>
                            </View>
                        ) : (
                            <Button mode="contained" onPress={handleImportCsvFile} style={styles.selectJsonButton}>
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
                            title: userMetrics.find((metric) => metric.id === metricToDelete)?.userId,
                        })}
                        visible={isDeleteModalVisible}
                    />
                    <ThemedModal
                        cancelText={t('no')}
                        confirmText={t('yes')}
                        onClose={handleRemoveAllCancel}
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
    },
    cardTitle: {
        color: colors.onSurface,
        fontSize: 18,
        fontWeight: 'bold',
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    iconButton: {
        marginHorizontal: 8,
    },
    metricDetail: {
        display: 'flex',
    },
    metricDetailText: {
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
