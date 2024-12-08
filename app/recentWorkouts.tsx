import AnimatedSearchBar from '@/components/AnimatedSearchBar';
import CustomTextArea from '@/components/CustomTextArea';
import FABWrapper from '@/components/FABWrapper';
import { Screen } from '@/components/Screen';
import StatusBadge from '@/components/StatusBadge';
import ThemedCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import { AI_SETTINGS_TYPE, JSON_IMPORT_TYPE } from '@/constants/storage';
import { FAB_ICON_SIZE, ICON_SIZE } from '@/constants/ui';
import { useSettings } from '@/storage/SettingsContext';
import { useSnackbar } from '@/storage/SnackbarProvider';
import { getAiApiVendor, parsePastWorkouts } from '@/utils/ai';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { isEmptyObject } from '@/utils/data';
import { getRecentWorkoutsPaginated, getTotalRecentWorkoutsCount, processRecentWorkouts } from '@/utils/database';
import { formatDate } from '@/utils/date';
import { importJson } from '@/utils/file';
import { ParsedRecentWorkout, WorkoutEventReturnType } from '@/utils/types';
import { validateParsedRecentWorkouts } from '@/utils/validation';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Button, Card, Text, useTheme } from 'react-native-paper';

export default function RecentWorkouts() {
    const { t } = useTranslation();
    const [recentWorkouts, setRecentWorkouts] = useState<WorkoutEventReturnType[]>([]);
    const [isAiEnabled, setIsAiEnabled] = useState<boolean>(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [jsonImportModalVisible, setJsonImportModalVisible] = useState(false);
    const [textInputValue, setTextInputValue] = useState('');
    const [isModalLoading, setIsModalLoading] = useState(false);
    const [jsonImportEnabled, setJsonImportEnabled] = useState(false);
    const [jsonData, setJsonData] = useState([]);
    const [jsonFilename, setJsonFilename] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [totalWorkoutsCount, setTotalWorkoutsCount] = useState(0);

    const { colors, dark } = useTheme<CustomThemeType>();
    const { getSettingByType } = useSettings();
    const styles = makeStyles(colors, dark);
    const navigation = useNavigation<NavigationProp<any>>();
    const { showSnackbar } = useSnackbar();

    const loadWorkouts = useCallback(async (offset = 0, limit = 20) => {
        try {
            const loadedWorkouts = await getRecentWorkoutsPaginated(offset, limit);

            setRecentWorkouts((prevState) => {
                return [
                    ...prevState,
                    ...loadedWorkouts.filter(
                        (data) => !prevState.some((prevData) => prevData.id === data.id)
                    ),
                ];
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
        } catch (error) {
            console.error('Failed to load recent workouts:', error);
        }
    }, [getSettingByType]);

    const loadMoreWorkouts = useCallback(() => {
        if (recentWorkouts.length >= totalWorkoutsCount) {
            return;
        }

        loadWorkouts(recentWorkouts.length);
    }, [recentWorkouts.length, totalWorkoutsCount, loadWorkouts]);

    const fetchTotalWorkoutsCount = useCallback(async () => {
        const totalCount = await getTotalRecentWorkoutsCount();
        setTotalWorkoutsCount(totalCount);
    }, []);

    const resetScreenData = useCallback(() => {
        setRecentWorkouts([]);
        setModalVisible(false);
        setJsonImportModalVisible(false);
        setSearchQuery('');
        setIsAiEnabled(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchTotalWorkoutsCount();
            loadWorkouts();

            return () => {
                resetScreenData();
            };
        }, [fetchTotalWorkoutsCount, loadWorkouts, resetScreenData])
    );

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

    const handleViewAllRecentWorkouts = useCallback(
        (recentWorkoutId: number) => navigation.navigate('recentWorkoutDetails', { id: recentWorkoutId }),
        [navigation]
    );

    const handleEditWorkout = useCallback(
        (workoutId: number) => navigation.navigate('createRecentWorkout', { id: workoutId }),
        [navigation]
    );

    const handleImportPastWorkoutsWithAi = useCallback(async () => {
        setIsModalLoading(true);

        try {
            const response = await parsePastWorkouts(textInputValue);

            if (response) {
                const pastWorkouts = response?.pastWorkouts as ParsedRecentWorkout[];
                await processRecentWorkouts(pastWorkouts);
                showSnackbar(t('workouts_imported'), t('ok'), () => {});
            }
        } catch (error) {
            console.error('Failed to parse past workouts:', error);
            showSnackbar(t('failed_to_parse_data'), t('ok'), () => {});
        }

        setModalVisible(false);
        setIsModalLoading(false);
        loadWorkouts();
    }, [loadWorkouts, textInputValue, t, showSnackbar]);

    const handleImportJsonFile = useCallback(async () => {
        if (!isEmptyObject(jsonData) && validateParsedRecentWorkouts(jsonData)) {
            await processRecentWorkouts(jsonData as ParsedRecentWorkout[]);
            showSnackbar(t('workouts_imported'), t('ok'), () => {});
            setJsonData([]);
            setJsonFilename('');
        } else {
            showSnackbar(t('failed_to_parse_data'), t('ok'), () => {});
        }

        setJsonImportModalVisible(false);
        loadWorkouts();
    }, [jsonData, showSnackbar, t, loadWorkouts]);

    const handleSelectJsonFile = useCallback(async () => {
        try {
            const { data, fileName } = await importJson();

            if (data && fileName) {
                setJsonData(data);
                setJsonFilename(fileName);
            }
        } catch (error) {
            console.error('Failed to import JSON file:', error);
            showSnackbar(t('failed_to_parse_data'), t('ok'), () => {});
        }
    }, [showSnackbar, t]);

    const filteredWorkouts = useMemo(() => recentWorkouts.filter((workout) =>
        workout.title.toLowerCase().includes(searchQuery.toLowerCase())
    ), [recentWorkouts, searchQuery]);

    const handleCancelImportJson = useCallback(() => {
        setJsonImportModalVisible(false);
        setJsonData([]);
        setJsonFilename('');
    }, []);

    const fabActions = useMemo(() => {
        const actions = [{
            icon: () => <FontAwesome5 color={colors.primary} name="plus" size={FAB_ICON_SIZE} />,
            label: t('create_recent_workout'),
            onPress: () => navigation.navigate('createRecentWorkout'),
            style: { backgroundColor: colors.surface },
        }];

        if (isAiEnabled) {
            actions.unshift({
                icon: () => <FontAwesome5 color={colors.primary} name="brain" size={FAB_ICON_SIZE} />,
                label: t('import_with_ai'),
                onPress: () => setModalVisible(true),
                style: { backgroundColor: colors.surface },
            });
        }

        if (jsonImportEnabled) {
            actions.unshift({
                icon: () => <FontAwesome5 color={colors.primary} name="file-import" size={FAB_ICON_SIZE} />,
                label: t('import_from_json_file'),
                onPress: () => setJsonImportModalVisible(true),
                style: { backgroundColor: colors.surface },
            });
        }

        return actions;
    }, [colors.primary, colors.surface, isAiEnabled, jsonImportEnabled, navigation, t]);

    return (
        <Screen style={styles.container}>
            <FABWrapper actions={fabActions} icon="cog" visible>
                <View style={styles.container}>
                    <Appbar.Header
                        mode="small"
                        statusBarHeight={0}
                        style={styles.appbarHeader}
                    >
                        <Appbar.Content title={t('recent_workouts')} titleStyle={styles.appbarTitle} />
                        <AnimatedSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
                    </Appbar.Header>
                    {filteredWorkouts.length > 0 ? (
                        <FlashList
                            contentContainerStyle={styles.scrollViewContent}
                            data={filteredWorkouts}
                            estimatedItemSize={100}
                            keyExtractor={(item) => (item?.id ? item.id.toString() : 'default')}
                            ListFooterComponent={
                                recentWorkouts.length < totalWorkoutsCount ? (
                                    <ActivityIndicator />
                                ) : null}
                            onEndReached={loadMoreWorkouts}
                            onEndReachedThreshold={0.5}
                            renderItem={({ item: workout }) => (
                                <ThemedCard key={workout.id}>
                                    <Card.Content style={styles.cardContent}>
                                        <View style={styles.cardHeader}>
                                            <Text style={styles.cardTitle}>{workout.title}</Text>
                                            <Text style={styles.cardDate}>{formatDate(workout.date)}</Text>
                                            <StatusBadge status={workout.status} />
                                            {workout?.duration ? (
                                                <Text style={styles.cardDuration}>
                                                    {workout.duration} {t(workout.duration > 1 ? 'minutes' : 'minute')}
                                                </Text>
                                            ) : null}
                                        </View>
                                        <View style={styles.cardActions}>
                                            <FontAwesome5
                                                color={colors.primary}
                                                name="eye"
                                                onPress={() => handleViewAllRecentWorkouts(workout.id!)}
                                                size={ICON_SIZE}
                                                style={styles.iconButton}
                                            />
                                            <FontAwesome5
                                                color={colors.primary}
                                                name="edit"
                                                onPress={() => handleEditWorkout(workout.id!)}
                                                size={ICON_SIZE}
                                                style={styles.iconButton}
                                            />
                                        </View>
                                    </Card.Content>
                                </ThemedCard>
                            )}
                        />
                    ) : (
                        <Text style={styles.noDataText}>{t('no_workouts')}</Text>
                    )}
                    <ThemedModal
                        cancelText={!isModalLoading ? t('cancel') : undefined}
                        confirmText={!isModalLoading ? t('import') : undefined}
                        onClose={() => setModalVisible(false)}
                        onConfirm={!isModalLoading ? handleImportPastWorkoutsWithAi : undefined}
                        visible={modalVisible}
                    >
                        {isModalLoading ? (
                            <>
                                <ActivityIndicator size="large" style={styles.loadingIndicator} />
                                <Text style={styles.loadingText}>{t('this_might_take_a_minute_or_more')}</Text>
                            </>
                        ) : (
                            <>
                                <Text style={styles.modalTitle}>{t('recent_workouts')}</Text>
                                <CustomTextArea
                                    numberOfLines={4}
                                    onChangeText={setTextInputValue}
                                    placeholder={t('write_down_recent_workouts')}
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
                            <Text style={styles.modalTitle}>{t('import_from_json_file')}</Text>
                            <Text style={styles.modalText}>
                                {t('recent_workouts_json_format_description', {
                                    jsonFormat: JSON.stringify([{
                                        date: '2023-06-15T06:35:00Z',
                                        description: 'description',
                                        duration: 300,
                                        exercises: [{
                                            muscleGroup: 'chest',
                                            name: 'Bench Press',
                                            sets: [{
                                                createdAt: '2023-06-15T06:35:00Z',
                                                isDropSet: false,
                                                reps: 8,
                                                restTime: 90,
                                                targetReps: 8,
                                                targetWeight: 110,
                                                weight: 110,
                                            }],
                                            type: 'compound',
                                        }],
                                        title: 'Chest and Back Day',
                                    }], null, 1),
                                })}
                            </Text>
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
    },
    cardContent: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    cardDate: {
        color: colors.onBackground,
        fontSize: 14,
    },
    cardDuration: {
        color: colors.onBackground,
        marginTop: 4,
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
    loadingIndicator: {
        marginVertical: 16,
    },
    loadingText: {
        color: colors.onBackground,
        fontSize: 16,
        marginTop: 8,
        textAlign: 'center',
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
    noDataText: {
        color: colors.onBackground,
        fontSize: 16,
        marginTop: 16,
        textAlign: 'center',
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
