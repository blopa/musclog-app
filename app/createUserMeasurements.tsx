import CompletionModal from '@/components/CompletionModal';
import CustomTextInput from '@/components/CustomTextInput';
import DatePickerModal from '@/components/DatePickerModal';
import { Screen } from '@/components/Screen';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { addUserMeasurements, getUser, getUserMeasurements, updateUserMeasurements } from '@/utils/database';
import { formatDate } from '@/utils/date';
import { formatFloatNumericInputText, generateHash } from '@/utils/string';
import { UserMeasurementsInsertType } from '@/utils/types';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Animated, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, IconButton, Text, useTheme } from 'react-native-paper';

type RouteParams = {
    id?: string;
};

const CreateUserMeasurements = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const route = useRoute();
    const { id } = (route.params as RouteParams) || {};
    const { t } = useTranslation();

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentMeasurement, setCurrentMeasurement] = useState({ index: -1, name: '', value: '' });
    const [measurements, setMeasurements] = useState<{ name: string; value: string }[]>([]);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(300)).current;
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

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

    const loadUserMeasurements = useCallback(async () => {
        if (id) {
            try {
                const measurementsData = await getUserMeasurements(Number(id));

                if (measurementsData) {
                    const measurementsParsed = (JSON.parse(measurementsData.measurements) || {}) as Record<string, number>;
                    setMeasurements(
                        Object.entries(measurementsParsed).map(([name, value]) => ({
                            name,
                            value: value.toString(),
                        }))
                    );
                }
            } catch (error) {
                console.error(t('failed_to_load_user_measurements'), error);
            }
        }
    }, [id, t]);

    useFocusEffect(
        useCallback(() => {
            loadUserMeasurements();
        }, [loadUserMeasurements])
    );

    const handleSaveUserMeasurements = useCallback(async () => {
        if (measurements.length === 0) {
            Alert.alert(t('validation_error'), t('at_least_one_measurement_required'));
            return;
        }

        const user = await getUser();
        const measurementsData: UserMeasurementsInsertType = {
            dataId: generateHash(),
            date: selectedDate.toISOString(),
            measurements: measurements.reduce((acc, measurement) => ({
                ...acc,
                [measurement.name]: measurement.value,
            }), {}),
            source: USER_METRICS_SOURCES.USER_INPUT,
            userId: user?.id!,
        };

        setIsSaving(true);

        try {
            if (id) {
                await updateUserMeasurements(Number(id), measurementsData);
            } else {
                await addUserMeasurements(measurementsData);
            }
            showModal();
        } catch (error) {
            console.error(t('failed_to_save_user_measurements'), error);
        } finally {
            setIsSaving(false);
        }
    }, [measurements, id, selectedDate, showModal, t]);

    const resetScreenData = useCallback(() => {
        setCurrentMeasurement({ index: -1, name: '', value: '' });
        setMeasurements([]);
        setSelectedDate(new Date());
        setIsModalVisible(false);
        setIsSaving(false);
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
            navigation.navigate('listUserMeasurements');
        });
    }, [fadeAnim, navigation, resetScreenData, slideAnim]);

    const handleAddMeasurement = useCallback(() => {
        if (currentMeasurement.name && currentMeasurement.value) {
            if (currentMeasurement.index > -1) {
                setMeasurements((prevMeasurements) =>
                    prevMeasurements.map((measurement, i) =>
                        (i === currentMeasurement.index
                            ? { name: currentMeasurement.name, value: currentMeasurement.value }
                            : measurement)
                    )
                );
            } else {
                setMeasurements((prevMeasurements) => [...prevMeasurements, { name: currentMeasurement.name, value: currentMeasurement.value }]);
            }

            setCurrentMeasurement({ index: -1, name: '', value: '' });
        } else {
            Alert.alert(t('validation_error'), t('measurement_name_and_value_required'));
        }
    }, [currentMeasurement, t]);

    const handleMeasurementChange = useCallback((field: 'name' | 'value', value: string) => {
        setCurrentMeasurement((prev) => ({
            ...prev,
            [field]: field === 'value' ? formatFloatNumericInputText(value) || '' : value,
        }));
    }, []);

    const handleEditMeasurement = useCallback((index: number) => {
        const measurementToEdit = measurements[index];
        setCurrentMeasurement({ ...measurementToEdit, index });
    }, [measurements]);

    const handleDateChange = useCallback((date: Date) => {
        setSelectedDate(date);
        setIsDatePickerVisible(false);
    }, []);

    return (
        <Screen style={styles.container}>
            <CompletionModal
                buttonText={t('ok')}
                isModalVisible={isModalVisible}
                onClose={handleModalClose}
                title={t('generic_created_successfully')}
            />
            <Appbar.Header
                mode="small"
                statusBarHeight={0}
                style={styles.appbarHeader}
            >
                <Appbar.Content
                    title={t(id ? 'edit_user_measurements' : 'create_user_measurements')}
                    titleStyle={styles.appbarTitle}
                />
                <Button
                    mode="outlined"
                    onPress={() => {
                        resetScreenData();
                        navigation.navigate('listUserMeasurements');
                    }}
                    textColor={colors.onPrimary}
                >
                    {t('cancel')}
                </Button>
            </Appbar.Header>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>{t('measurement_date')}</Text>
                <Button
                    mode="outlined"
                    onPress={() => setIsDatePickerVisible(true)}
                    style={styles.datePickerButton}
                >
                    {formatDate(selectedDate.toISOString())}
                </Button>
                {measurements.length > 0 && (
                    <View style={styles.savedMeasurementsContainer}>
                        {measurements.map((measurement, index) => (
                            <View key={index} style={styles.savedMeasurementItem}>
                                <Text style={styles.savedMeasurementText}>
                                    {`${measurement.name}: ${measurement.value}`}
                                </Text>
                                <IconButton
                                    icon="pencil"
                                    onPress={() => handleEditMeasurement(index)}
                                    style={styles.editButton}
                                />
                            </View>
                        ))}
                    </View>
                )}
                <View style={styles.measurementContainer}>
                    <CustomTextInput
                        label={t('measurement_name')}
                        onChangeText={(text) => handleMeasurementChange('name', text)}
                        placeholder={t('enter_measurement_name')}
                        value={currentMeasurement.name}
                    />
                    <CustomTextInput
                        keyboardType="numeric"
                        label={t('measurement_value')}
                        onChangeText={(text) => handleMeasurementChange('value', text)}
                        placeholder={t('enter_measurement_value')}
                        value={currentMeasurement.value}
                    />
                </View>
                <Button
                    mode="contained"
                    onPress={handleAddMeasurement}
                    style={styles.addButton}
                >
                    {currentMeasurement.index > -1 ? t('update_measurement') : t('add_another')}
                </Button>
            </ScrollView>
            <View style={styles.footer}>
                <Button
                    disabled={isSaving}
                    mode="contained"
                    onPress={handleSaveUserMeasurements}
                    style={styles.button}
                >
                    {t('save')}
                </Button>
            </View>
            <DatePickerModal
                onChangeDate={handleDateChange}
                onClose={() => setIsDatePickerVisible(false)}
                selectedDate={selectedDate}
                visible={isDatePickerVisible}
            />
        </Screen>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    addButton: {
        marginVertical: 10,
    },
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
        flex: 1,
    },
    content: {
        padding: 16,
    },
    datePickerButton: {
        backgroundColor: colors.surface,
        borderColor: colors.onSurface,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.onSurface,
        marginBottom: 16,
        marginTop: 8,
        paddingLeft: 10,
        width: '100%',
    },
    editButton: {
        marginLeft: 8,
    },
    footer: {
        alignItems: 'center',
        borderTopColor: colors.shadow,
        borderTopWidth: 1,
        padding: 16,
    },
    label: {
        color: colors.onSurface,
        fontSize: 16,
        marginTop: 8,
    },
    measurementContainer: {
        marginBottom: 16,
    },
    savedMeasurementItem: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        padding: 8,
    },
    savedMeasurementsContainer: {
        marginBottom: 16,
    },
    savedMeasurementText: {
        color: colors.onSurface,
    },
});

export default CreateUserMeasurements;
