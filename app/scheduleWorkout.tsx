import CustomPicker from '@/components/CustomPicker';
import DatePickerModal from '@/components/DatePickerModal';
import { Screen } from '@/components/Screen';
import { SCHEDULED_STATUS } from '@/constants/storage';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { addWorkoutEvent, getAllWorkouts } from '@/utils/database';
import { WorkoutEventInsertType, WorkoutReturnType } from '@/utils/types';
import { NavigationProp } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Text, useTheme } from 'react-native-paper';

function ScheduleWorkout({ navigation }: { navigation: NavigationProp<any> }) {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const [workouts, setWorkouts] = useState<WorkoutReturnType[]>([]);
    const [selectedWorkoutId, setSelectedWorkoutId] = useState<null | number>(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [isDatePickerVisible, setDatePickerVisible] = useState(false);
    const styles = makeStyles(colors, dark);

    const loadWorkouts = useCallback(async () => {
        try {
            const loadedWorkouts = await getAllWorkouts();
            setWorkouts(loadedWorkouts);
        } catch (error) {
            console.error(t('failed_to_load_workouts'), error);
        }
    }, [t]);

    const resetScreenData = useCallback(() => {
        setWorkouts([]);
        setSelectedWorkoutId(null);
        setSelectedDate(new Date());
        setDatePickerVisible(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadWorkouts();

            return () => {
                resetScreenData();
            };
        }, [loadWorkouts, resetScreenData])
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

    const handleSaveSchedule = useCallback(async () => {
        if (!selectedWorkoutId) {
            Alert.alert(t('validation_error'), t('workout_must_be_selected'));
            return;
        }

        const newUpcomingWorkout: WorkoutEventInsertType = {
            date: selectedDate.toISOString(),
            duration: 0,
            exerciseData: '[]',
            status: SCHEDULED_STATUS,
            title: workouts.find((w) => w.id === selectedWorkoutId)?.title || t('scheduled_workout'),
            workoutId: selectedWorkoutId,
        };

        try {
            await addWorkoutEvent(newUpcomingWorkout);
            Alert.alert(t('success'), t('workout_scheduled_successfully'));
            navigation.goBack();
        } catch (error) {
            console.error(t('failed_to_schedule_workout'), error);
        }
    }, [navigation, selectedDate, selectedWorkoutId, t, workouts]);

    return (
        <Screen style={styles.container}>
            <Appbar.Header
                mode="small"
                statusBarHeight={0}
                style={styles.appbarHeader}
            >
                <Appbar.Content
                    title={t('schedule_workout')}
                    titleStyle={styles.appbarTitle}
                />
                <Button
                    mode="outlined"
                    onPress={() => {
                        resetScreenData();
                        navigation.navigate('upcomingWorkouts');
                    }}
                    textColor={colors.onPrimary}
                >
                    {t('cancel')}
                </Button>
            </Appbar.Header>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <CustomPicker
                    items={[
                        { label: t('select_a_workout'), value: '' },
                        ...workouts.map((workout) => ({
                            label: workout.title,
                            value: workout.id!.toString(),
                        })),
                    ]}
                    label={t('select_workout')}
                    onValueChange={(itemValue) => setSelectedWorkoutId(Number(itemValue))}
                    selectedValue={selectedWorkoutId?.toString() || ''}
                />
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('select_date')}</Text>
                    <Button
                        mode="outlined"
                        onPress={() => setDatePickerVisible(true)}
                        style={styles.inputButton}
                    >
                        {selectedDate.toLocaleDateString()}
                    </Button>
                </View>
                <DatePickerModal
                    onChangeDate={setSelectedDate}
                    onClose={() => setDatePickerVisible(false)}
                    selectedDate={selectedDate}
                    visible={isDatePickerVisible}
                />
                <Button mode="contained" onPress={handleSaveSchedule} style={styles.saveButton}>
                    {t('save_schedule')}
                </Button>
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
    container: {
        backgroundColor: colors.background,
        flexGrow: 1,
    },
    content: {
        padding: 16,
    },
    formGroup: {
        marginBottom: 16,
    },
    inputButton: {
        backgroundColor: colors.surface,
        borderColor: colors.onSurface,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.onSurface,
        paddingLeft: 10,
        width: '100%',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    saveButton: {
        marginTop: 16,
    },
});

export default ScheduleWorkout;
