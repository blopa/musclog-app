import CompletionModal from '@/components/CompletionModal';
import CustomPicker from '@/components/CustomPicker';
import CustomTextArea from '@/components/CustomTextArea';
import CustomTextInput from '@/components/CustomTextInput';
import { Screen } from '@/components/Screen';
import { EXERCISE_TYPES, MUSCLE_GROUPS } from '@/constants/exercises';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { addExercise, getExerciseById, updateExercise } from '@/utils/database';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Animated, BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { ActivityIndicator, Appbar, Button, useTheme } from 'react-native-paper';

type RouteParams = {
    id?: string;
};

const CreateExercise = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const route = useRoute();
    const { id } = (route.params as RouteParams) || {};

    const { t } = useTranslation();
    const [exerciseName, setExerciseName] = useState('');
    const [muscleGroup, setMuscleGroup] = useState('');
    const [exerciseType, setExerciseType] = useState('');
    const [exerciseDescription, setExerciseDescription] = useState('');
    const [exerciseImage, setExerciseImage] = useState<string | undefined>();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(300)).current;
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const loadExercise = useCallback(async () => {
        try {
            const exercise = await getExerciseById(Number(id));

            if (exercise) {
                setExerciseName(exercise.name);
                setMuscleGroup(exercise.muscleGroup || '');
                setExerciseType(exercise.type || '');
                setExerciseDescription(exercise.description || '');
                setExerciseImage(exercise.image);
            }
        } catch (error) {
            console.error(t('failed_to_load_exercise'), error);
        }
    }, [id, t]);

    useFocusEffect(
        useCallback(() => {
            if (id) {
                loadExercise()
                    .finally(() => setIsLoading(false))
                    .catch(() => setIsLoading(false));
            } else {
                setIsLoading(false);
            }
        }, [id, loadExercise])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.navigate('listExercises');
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [navigation])
    );

    const showModal = useCallback(() => {
        setIsModalVisible(true);
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
    }, [fadeAnim, slideAnim]);

    const handleSaveExercise = useCallback(async () => {
        if (!exerciseName.trim()) {
            Alert.alert(t('validation_error'), t('exercise_name_required'));
            return;
        }

        if (!muscleGroup.trim()) {
            Alert.alert(t('validation_error'), t('muscle_group_required'));
            return;
        }

        if (!exerciseType.trim()) {
            Alert.alert(t('validation_error'), t('exercise_type_required'));
            return;
        }

        const exerciseInfo = {
            description: exerciseDescription,
            image: exerciseImage,
            muscleGroup,
            name: exerciseName,
            type: exerciseType,
        };

        setIsSaving(true);

        try {
            if (id) {
                await updateExercise(Number(id), exerciseInfo);
            } else {
                await addExercise(exerciseInfo);
            }
            showModal();
        } catch (error) {
            console.error(t('failed_to_save_exercise'), error);
        } finally {
            setIsSaving(false);
        }
    }, [
        exerciseDescription,
        exerciseImage,
        exerciseName,
        exerciseType,
        id,
        muscleGroup,
        showModal,
        t,
    ]);

    const resetScreenData = useCallback(() => {
        setExerciseName('');
        setMuscleGroup('');
        setExerciseType('');
        setExerciseDescription('');
        setExerciseImage(undefined);
        setIsLoading(true);
    }, []);

    useFocusEffect(
        useCallback(() => {
            return () => {
                resetScreenData();
            };
        }, [resetScreenData])
    );

    const handleModalClose = useCallback(() => {
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
        ]).start(() => {
            setIsModalVisible(false);
            resetScreenData();
            navigation.navigate('listExercises');
        });
    }, [fadeAnim, navigation, resetScreenData, slideAnim]);

    const selectImage = useCallback(() => {
        launchImageLibrary(
            {
                mediaType: 'photo',
            },
            (response) => {
                if (response.didCancel) {
                    console.log(t('image_picker_cancelled'));
                } else if (response.errorCode) {
                    console.log(t('image_picker_error'), response.errorMessage);
                } else {
                    const uri = response?.assets?.[0].uri;
                    setExerciseImage(uri);
                }
            }
        );
    }, [t]);

    return (
        <Screen style={styles.container}>
            <CompletionModal
                buttonText={t('ok')}
                isModalVisible={isModalVisible}
                onClose={handleModalClose}
                title={t(`exercise_${id ? 'updated' : 'created'}_successfully`)}
            />
            <Appbar.Header
                mode="small"
                statusBarHeight={0}
                style={styles.appbarHeader}
            >
                <Appbar.Content
                    title={t(id ? 'edit_exercise' : 'create_exercise')}
                    titleStyle={styles.appbarTitle}
                />
                <Button
                    mode="outlined"
                    onPress={() => {
                        resetScreenData();
                        navigation.navigate('listExercises');
                    }}
                    textColor={colors.onPrimary}
                >
                    {t('cancel')}
                </Button>
            </Appbar.Header>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <CustomTextInput
                    label={t('exercise_name')}
                    onChangeText={setExerciseName}
                    placeholder={t('enter_exercise_name')}
                    value={exerciseName}
                />
                <CustomPicker
                    items={[
                        { label: t('select_muscle_group'), value: '' },
                        ...Object.values(MUSCLE_GROUPS).map((type) => ({
                            label: t(`muscle_groups.${type}`),
                            value: type,
                        })),
                    ]}
                    label={t('muscle_group')}
                    onValueChange={setMuscleGroup}
                    selectedValue={muscleGroup}
                />
                {/*TODO: Add image picker*/}
                {/*<View style={styles.formGroup}>*/}
                {/*    <Text style={styles.label}>{t('exercise_image')}</Text>*/}
                {/*    <Button mode="outlined" onPress={selectImage} style={styles.imagePicker}>*/}
                {/*        {t('select_image')}*/}
                {/*    </Button>*/}
                {/*    {exerciseImage && <Image source={{ uri: exerciseImage }} style={styles.imagePreview} />}*/}
                {/*</View>*/}
                <CustomPicker
                    items={[
                        { label: t('select_exercise_type'), value: '' },
                        ...Object.values(EXERCISE_TYPES).map((type) => ({
                            label: t(type),
                            value: type,
                        })),
                    ]}
                    label={t('exercise_type')}
                    onValueChange={setExerciseType}
                    selectedValue={exerciseType}
                />
                <CustomTextArea
                    label={t('exercise_description')}
                    onChangeText={setExerciseDescription}
                    placeholder={t('enter_exercise_description')}
                    value={exerciseDescription}
                />
            </ScrollView>
            <View style={styles.footer}>
                <Button
                    disabled={isSaving}
                    mode="contained"
                    onPress={handleSaveExercise}
                    style={styles.button}
                >
                    {t('save_exercise')}
                </Button>
            </View>
            {(isSaving || isLoading) && (
                <View style={styles.overlay}>
                    <ActivityIndicator color={colors.primary} size="large" />
                </View>
            )}
        </Screen>
    );
};

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
        marginVertical: 10,
    },
    container: {
        backgroundColor: colors.background,
        // flexGrow: 1,
        flex: 1,
    },
    content: {
        padding: 16,
    },
    footer: {
        alignItems: 'center',
        borderTopColor: colors.shadow,
        borderTopWidth: 1,
        padding: 16,
    },
    formGroup: {
        marginBottom: 16,
    },
    imagePicker: {
        marginTop: 10,
    },
    imagePreview: {
        borderRadius: 5,
        height: 200,
        marginTop: 10,
        width: '100%',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        flex: 1,
        justifyContent: 'center',
    },
});

export default CreateExercise;
