import AnimatedSearchBar from '@/components/AnimatedSearchBar';
import CustomTextInput from '@/components/CustomTextInput';
import { Screen } from '@/components/Screen';
import ThemedCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import { IMPERIAL_SYSTEM, KILOGRAMS, POUNDS } from '@/constants/storage';
import { ICON_SIZE } from '@/constants/ui';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { addOneRepMax, getAllExercises, getOneRepMax, updateOneRepMax } from '@/utils/database';
import { ExerciseReturnType } from '@/utils/types';
import { getDisplayFormattedWeight, getSaveFormattedWeight } from '@/utils/unit';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Animated, BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Text, useTheme } from 'react-native-paper';

export default function OneRepMaxes({ navigation }: { navigation: NavigationProp<any> }) {
    const { t } = useTranslation();
    const { unitSystem, weightUnit } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const [exercises, setExercises] = useState<ExerciseReturnType[]>([]);
    const [oneRepMaxes, setOneRepMaxes] = useState<{ [key: number]: number }>({});
    const [showModal, setShowModal] = useState(false);
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState<null | number>(null);
    const [inputValue, setInputValue] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(300)).current;

    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const loadExercises = useCallback(async () => {
        try {
            const loadedExercises = await getAllExercises();
            const oneRepMaxValues: { [key: number]: number } = {};

            for (const exercise of loadedExercises) {
                const oneRepMax = await getOneRepMax(exercise.id!);
                if (oneRepMax) {
                    oneRepMaxValues[exercise.id!] = getDisplayFormattedWeight(oneRepMax.weight, KILOGRAMS, isImperial);
                }
            }

            setExercises(loadedExercises);
            setOneRepMaxes(oneRepMaxValues);
        } catch (error) {
            console.error(t('failed_to_load_exercises'), error);
        }
    }, [t, isImperial]);

    const resetScreenData = useCallback(() => {
        setExercises([]);
        setOneRepMaxes({});
        setShowModal(false);
        setCurrentExerciseIndex(null);
        setInputValue('');
        setSearchQuery('');
    }, []);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.navigate('profile');
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [navigation])
    );

    useFocusEffect(
        useCallback(() => {
            loadExercises();

            return () => {
                resetScreenData();
            };
        }, [loadExercises, resetScreenData])
    );

    useEffect(() => {
        if (showModal) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    duration: 300,
                    toValue: 1,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    duration: 300,
                    toValue: 0,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    duration: 300,
                    toValue: 0,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    duration: 300,
                    toValue: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [showModal, fadeAnim, slideAnim]);

    const handleSave = useCallback(async () => {
        if (!inputValue) {
            Alert.alert(t('please_enter_value_for_1rm'));
            return;
        }

        if (currentExerciseIndex !== null) {
            const exercise = exercises[currentExerciseIndex];
            if (exercise.id !== undefined) {
                const weight = parseFloat(inputValue);
                const weightInKg = getSaveFormattedWeight(weight, POUNDS, isImperial);

                if (oneRepMaxes[exercise.id]) {
                    await updateOneRepMax(exercise.id, weightInKg);
                } else {
                    await addOneRepMax(exercise.id, weightInKg);
                }
                setOneRepMaxes({
                    ...oneRepMaxes,
                    [exercise.id]: weight,
                });
            }

            if (currentExerciseIndex + 1 < exercises.length) {
                setCurrentExerciseIndex(currentExerciseIndex + 1);
                setInputValue('');
            } else {
                setShowModal(false);
            }
        } else {
            setShowModal(false);
        }
    }, [currentExerciseIndex, exercises, inputValue, oneRepMaxes, t, isImperial]);

    const handleSkip = useCallback(() => {
        if (currentExerciseIndex !== null) {
            if (currentExerciseIndex + 1 < exercises.length) {
                setCurrentExerciseIndex(currentExerciseIndex + 1);
                setInputValue('');
            } else {
                setShowModal(false);
            }
        } else {
            setShowModal(false);
        }
    }, [currentExerciseIndex, exercises.length]);

    const handleInputChange = useCallback((value: string) => {
        setInputValue(value);
    }, []);

    const openSetAllModal = useCallback(() => {
        setCurrentExerciseIndex(0);
        setInputValue('');
        setShowModal(true);
    }, []);

    const openEditModal = useCallback((index: number) => {
        setCurrentExerciseIndex(index);
        const exercise = exercises[index];
        setInputValue(oneRepMaxes[exercise.id!] ? oneRepMaxes[exercise.id!].toString() : '');
        setShowModal(true);
    }, [exercises, oneRepMaxes]);

    const closeModal = useCallback(() => {
        setShowModal(false);
        setInputValue('');
    }, []);

    const renderModalContent = useCallback(() => {
        if (currentExerciseIndex === null || currentExerciseIndex >= exercises.length) {
            return (
                <View style={styles.modalContent}>
                    <Text style={styles.message}>
                        {t('all_exercises_completed')}
                    </Text>
                    <Button mode="contained" onPress={closeModal} >
                        {t('close')}
                    </Button>
                </View>
            );
        }

        const currentExercise = exercises[currentExerciseIndex];

        if (oneRepMaxes[currentExercise.id!] && !inputValue) {
            setCurrentExerciseIndex(currentExerciseIndex + 1);
            return null;
        }

        return (
            <View style={styles.modalContent}>
                <Text style={styles.title}>
                    {currentExercise.name}
                </Text>
                <CustomTextInput
                    keyboardType="numeric"
                    label={t('enter_one_rep_max')}
                    onChangeText={(text) => handleInputChange(Number(text).toString())}
                    placeholder={t('enter_one_rep_max')}
                    value={inputValue}
                />
                <View style={styles.buttonContainer}>
                    <Button mode="contained" onPress={handleSave} style={styles.button}>
                        {t('save')}
                    </Button>
                    {oneRepMaxes[currentExercise.id!] === undefined ? (
                        <Button mode="contained" onPress={handleSkip} style={styles.button}>
                            {t('skip')}
                        </Button>
                    ) : (
                        <Button mode="contained" onPress={closeModal} style={styles.button} >
                            {t('cancel')}
                        </Button>
                    )}
                </View>
                {oneRepMaxes[currentExercise.id!] === undefined && (
                    <Button mode="contained" onPress={closeModal} style={[styles.button, styles.cancelButton]} >
                        {t('cancel')}
                    </Button>
                )}
            </View>
        );
    }, [
        closeModal,
        currentExerciseIndex,
        exercises,
        handleInputChange,
        handleSave,
        handleSkip,
        inputValue,
        oneRepMaxes,
        styles.button,
        styles.buttonContainer,
        styles.cancelButton,
        styles.message,
        styles.modalContent,
        styles.title,
        t,
    ]);

    const filteredExercises = exercises.filter((exercise) =>
        exercise.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Screen style={styles.container}>
            <Appbar.Header
                mode="small"
                statusBarHeight={0}
                style={styles.appbarHeader}
            >
                <Appbar.Content title={t('one_rep_maxes')} titleStyle={styles.appbarTitle} />
                <AnimatedSearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
            </Appbar.Header>
            <Button mode="contained" onPress={openSetAllModal} style={styles.setAllButton}>
                {t('set_all_one_rep_maxes')}
            </Button>
            <ScrollView contentContainerStyle={styles.scrollViewContent} keyboardShouldPersistTaps="handled">
                {filteredExercises.map((exercise, index) => (
                    <ThemedCard key={exercise.id}>
                        <Card.Content style={styles.cardContent}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>
                                    {exercise.name}
                                </Text>
                                <Text style={styles.exerciseDetail}>
                                    {t('one_rep_max_weight', {
                                        weight: oneRepMaxes[exercise.id!] || t('not_set'),
                                        weightUnit: oneRepMaxes[exercise.id!] ? `(${weightUnit})` : '',
                                    })}
                                </Text>
                            </View>
                            <FontAwesome5
                                color={colors.primary}
                                name="edit"
                                onPress={() => openEditModal(index)}
                                size={ICON_SIZE}
                                style={styles.iconButton}
                            />
                        </Card.Content>
                    </ThemedCard>
                ))}
                <ThemedModal
                    onClose={closeModal}
                    title={t('one_rep_max')}
                    visible={showModal}
                >
                    {renderModalContent()}
                </ThemedModal>
            </ScrollView>
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
    button: {
        margin: 5,
    },
    buttonContainer: {
        flexDirection: 'row',
        marginTop: 16,
        paddingHorizontal: 30,
    },
    cancelButton: {
        width: '80%',
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
        marginBottom: 8,
    },
    iconButton: {
        marginHorizontal: 8,
    },
    message: {
        color: colors.onSurface,
        fontSize: 18,
        marginBottom: 16,
        textAlign: 'center',
    },
    modalContent: {
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    scrollViewContent: {
        backgroundColor: colors.background,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    setAllButton: {
        marginHorizontal: 32,
        marginVertical: 16,
    },
    title: {
        color: colors.onSurface,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
});
