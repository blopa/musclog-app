import AnimatedSearchBar from '@/components/AnimatedSearchBar';
import FABWrapper from '@/components/FABWrapper';
import { Screen } from '@/components/Screen';
import ThemedCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import { FAB_ICON_SIZE, ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { deleteExercise, getExercisesPaginated, getTotalExercisesCount } from '@/utils/database';
import { ExerciseReturnType } from '@/utils/types';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, Text, useTheme } from 'react-native-paper';

export default function ListExercises({ navigation }: { navigation: NavigationProp<any> }) {
    const { t } = useTranslation();
    const [exercises, setExercises] = useState<ExerciseReturnType[]>([]);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [exerciseToDelete, setExerciseToDelete] = useState<null | number>(null);
    const [totalExercisesCount, setTotalExercisesCount] = useState(0);

    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const [searchQuery, setSearchQuery] = useState('');

    const loadExercises = useCallback(async (offset = 0, limit = 20) => {
        try {
            const loadedExercises = await getExercisesPaginated(offset, limit);
            const sortedExercises = loadedExercises.sort((a, b) => b.id! - a.id!);

            setExercises((prevState) => {
                const uniqueMetrics = sortedExercises.filter(
                    (exercise) => !prevState.some((prevExercise) => prevExercise.id === exercise.id)
                );

                return [...prevState, ...uniqueMetrics];
            });
        } catch (error) {
            console.error('Failed to load exercises:', error);
        }
    }, []);

    const loadMoreExercises = useCallback(() => {
        if (exercises.length >= totalExercisesCount) {
            return;
        }

        loadExercises(exercises.length);
    }, [exercises.length, totalExercisesCount, loadExercises]);

    const fetchTotalExercisesCount = useCallback(async () => {
        const totalCount = await getTotalExercisesCount();
        setTotalExercisesCount(totalCount);
    }, []);

    const resetScreenData = useCallback(() => {
        setSearchQuery('');
        setExercises([]);
        setIsDeleteModalVisible(false);
        setExerciseToDelete(null);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadExercises();

            return () => {
                resetScreenData();
            };
        }, [loadExercises, resetScreenData])
    );

    useFocusEffect(
        useCallback(() => {
            fetchTotalExercisesCount();
            loadExercises();

            return () => {
                resetScreenData();
            };
        }, [fetchTotalExercisesCount, loadExercises, resetScreenData])
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

    const handleDeleteExercise = useCallback(async (id: number) => {
        setExerciseToDelete(id);
        setIsDeleteModalVisible(true);
    }, []);

    const handleDeleteConfirmation = useCallback(async () => {
        if (exerciseToDelete) {
            try {
                await deleteExercise(exerciseToDelete);
                const updatedExercises = exercises.filter((exercise) => exercise.id !== exerciseToDelete);
                setExercises(updatedExercises);
                setIsDeleteModalVisible(false);
                setExerciseToDelete(null);
            } catch (error) {
                console.error('Failed to delete exercise:', error);
            }
        }
    }, [exerciseToDelete, exercises]);

    const handleDeleteCancel = useCallback(() => {
        setIsDeleteModalVisible(false);
        setExerciseToDelete(null);
    }, []);

    const filteredExercises = useMemo(() => exercises.reverse().filter((exercise) =>
        exercise.name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [exercises, searchQuery]);

    const fabActions = useMemo(() => [{
        icon: () => <FontAwesome5 color={colors.primary} name="plus" size={FAB_ICON_SIZE} />,
        label: t('create_exercise'),
        onPress: () => navigation.navigate('createExercise'),
        style: { backgroundColor: colors.surface },
    }], [colors.primary, colors.surface, navigation, t]);

    return (
        <Screen style={styles.container}>
            <FABWrapper actions={fabActions} visible>
                <View style={styles.container}>
                    <Appbar.Header
                        mode="small"
                        statusBarHeight={0}
                        style={styles.appbarHeader}
                    >
                        <Appbar.Content title={t('exercises')} titleStyle={styles.appbarTitle} />
                        <AnimatedSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
                    </Appbar.Header>
                    <FlashList
                        contentContainerStyle={styles.scrollViewContent}
                        data={filteredExercises}
                        estimatedItemSize={95}
                        keyExtractor={(item) => (item?.id ? item.id.toString() : 'default')}
                        ListFooterComponent={exercises.length < totalExercisesCount ? <ActivityIndicator /> : null}
                        onEndReached={loadMoreExercises}
                        onEndReachedThreshold={0.5}
                        renderItem={({ item: exercise }) => (
                            <ThemedCard key={exercise.id}>
                                <Card.Content style={styles.cardContent}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardTitle}>{exercise.name}</Text>
                                        <Text style={styles.exerciseDetail}>{t('muscle_group')}: {t(`muscle_groups.${exercise?.muscleGroup || ''}`)}</Text>
                                        <Text style={styles.exerciseDetail}>{t('type')}: {t(exercise?.type || 'unset')}</Text>
                                    </View>
                                    <View style={styles.cardActions}>
                                        <FontAwesome5
                                            color={colors.primary}
                                            name="edit"
                                            onPress={() => navigation.navigate('createExercise', { id: exercise.id })}
                                            size={ICON_SIZE}
                                            style={styles.iconButton}
                                        />
                                        <FontAwesome5
                                            color={colors.primary}
                                            name="trash"
                                            onPress={() => handleDeleteExercise(exercise.id!)}
                                            size={ICON_SIZE}
                                            style={styles.iconButton}
                                        />
                                    </View>
                                </Card.Content>
                            </ThemedCard>
                        )}
                    />
                    <ThemedModal
                        cancelText={t('no')}
                        confirmText={t('yes')}
                        onClose={handleDeleteCancel}
                        onConfirm={handleDeleteConfirmation}
                        title={t('delete_exercise_confirmation', {
                            title: exercises.find((exercise) => exercise.id === exerciseToDelete)?.name,
                        })}
                        visible={isDeleteModalVisible}
                    />
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
    exerciseDetail: {
        color: colors.onSurface,
        fontSize: 14,
        marginBottom: 4,
    },
    iconButton: {
        marginHorizontal: 8,
    },
    scrollViewContent: {
        backgroundColor: colors.background,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
});
