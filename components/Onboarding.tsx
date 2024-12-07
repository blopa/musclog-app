import CustomPicker from '@/components/CustomPicker';
import CustomTextInput from '@/components/CustomTextInput';
import DatePickerModal from '@/components/DatePickerModal';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { ACTIVITY_LEVELS_VALUES, EXPERIENCE_LEVELS_VALUES } from '@/constants/exercises';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { EATING_PHASES, NUTRITION_TYPES } from '@/constants/nutrition';
import {
    FEET,
    HAS_COMPLETED_ONBOARDING,
    IMPERIAL_SYSTEM,
    KILOGRAMS,
    METERS,
    METRIC_SYSTEM,
    POUNDS,
    READ_HEALTH_CONNECT_TYPE,
    UNIT_CHOICE_TYPE,
} from '@/constants/storage';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useHealthConnect } from '@/storage/HealthConnectProvider';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import {
    addOrUpdateSetting,
    addOrUpdateUser,
    addUserMetrics,
    addUserNutrition,
    getLatestUser,
} from '@/utils/database';
import { getCurrentTimestampISOString, getDaysAgoTimestampISOString, isValidDateParam } from '@/utils/date';
import { handleGoogleSignIn } from '@/utils/googleAuth';
import { aggregateUserNutritionMetricsDataByDate } from '@/utils/healthConnect';
import { formatFloatNumericInputText, generateHash } from '@/utils/string';
import { ActivityLevelType, EatingPhaseType, ExperienceLevelType } from '@/utils/types';
import {
    getDisplayFormattedHeight,
    getDisplayFormattedWeight,
    getSaveFormattedHeight,
    getSaveFormattedWeight,
} from '@/utils/unit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, SegmentedButtons, Text, useTheme } from 'react-native-paper';

type OnboardingProps = {
    onFinish: () => void;
};

const Onboarding = ({ onFinish }: OnboardingProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { checkReadIsPermitted, getHealthData, requestPermissions } = useHealthConnect();
    const { authData, isSigningIn, promptAsync } = useGoogleAuth();

    const [currentStep, setCurrentStep] = useState(0);
    const [form, setForm] = useState<{
        activityLevel: '' | ActivityLevelType;
        birthday: Date;
        eatingPhase: '' | EatingPhaseType;
        fitnessGoal: string;
        gender: string;
        height: string;
        liftingExperience: '' | ExperienceLevelType;
        name: string;
        unitSystem: string;
        weight: string;
    }>({
        activityLevel: '',
        birthday: new Date(),
        eatingPhase: '',
        fitnessGoal: '',
        gender: '',
        height: '',
        liftingExperience: '',
        name: '',
        unitSystem: METRIC_SYSTEM,
        weight: '',
    });
    const [isDatePickerVisible, setDatePickerVisible] = useState(false);
    const [showCheckPermissionButton, setShowCheckPermissionButton] = useState(false);
    const [isPermissionGranted, setIsPermissionGranted] = useState(false);
    const [showNoPermittedMessage, setShowNoPermittedMessage] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [hasAllowedGoogle, setHasAllowedGoogle] = useState<boolean>(false);

    const isImperial = form.unitSystem === IMPERIAL_SYSTEM;
    const heightUnit = isImperial ? FEET : METERS;
    const weightUnit = isImperial ? POUNDS : KILOGRAMS;

    const steps = useMemo(() => [{
        description: [
            t('log_workouts_monitor_progress'),
            t('thank_you_for_choosing'),
            t('use_metric_or_imperial'),
            (
                <Text key="terms">
                    {t('terms_and_conditions_notice_prefix')}
                    <Text onPress={() => Linking.openURL('https://werules.com/musclog/terms')} style={styles.link}>
                        {t('terms_and_conditions')}
                    </Text>
                </Text>
            ),
        ],
        form: true,
        title: t('welcome_to_our_app'),
    },
    {
        description: [t('permissions_description')],
        title: t('permissions_request'),
    },
    {
        description: [t('sign_in_with_google_or_skip')],
        title: t('connect_your_account'),
    },
    {
        description: [t('personalize_experience_or_skip')],
        form: true,
        title: t('tell_us_about_yourself'),
    }], [styles.link, t]);

    const loadProfileData = useCallback(async () => {
        const profile = await getLatestUser();
        if (profile) {
            setForm({
                ...form,
                activityLevel: profile.activityLevel || '',
                birthday: isValidDateParam(profile.birthday) ? new Date(profile.birthday) : new Date(),
                eatingPhase: profile.metrics.eatingPhase || '',
                fitnessGoal: profile.fitnessGoals || '',
                gender: profile.gender || '',
                height: (getDisplayFormattedHeight(profile.metrics.height || 0, isImperial)).toString() || '',
                liftingExperience: profile.liftingExperience || '',
                name: profile.name || '',
                unitSystem: form.unitSystem || METRIC_SYSTEM,
                weight: (getDisplayFormattedWeight(profile.metrics.weight || 0, KILOGRAMS, isImperial)).toString() || '',
            });
        }
    }, [form, isImperial]);

    const handleRequestPermission = useCallback(() => {
        requestPermissions();
        setShowCheckPermissionButton(true);
    }, [requestPermissions]);

    const handleNext = useCallback(async () => {
        setIsLoading(false);

        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            await AsyncStorage.setItem(HAS_COMPLETED_ONBOARDING, 'true');
            onFinish();
        }
    }, [currentStep, steps.length, onFinish]);

    const handleCheckPermissions = useCallback(async () => {
        setIsLoading(true);
        const isPermitted = await checkReadIsPermitted(['Height', 'Weight', 'BodyFat', 'Nutrition']);
        if (isPermitted) {
            await addOrUpdateSetting({
                type: READ_HEALTH_CONNECT_TYPE,
                value: 'true',
            });

            const startTime = getDaysAgoTimestampISOString(1);
            const endTime = getCurrentTimestampISOString();
            const userHealthData = await getHealthData(startTime, endTime, 1000, ['Height', 'Weight', 'BodyFat', 'Nutrition']);

            if (userHealthData) {
                await addOrUpdateUser({});
                const latestHeight = userHealthData?.heightRecords?.[0];
                const latestWeight = userHealthData?.weightRecords?.[0];
                const latestBodyFat = userHealthData?.bodyFatRecords?.[0];

                const aggregatedData = aggregateUserNutritionMetricsDataByDate(
                    latestHeight,
                    latestWeight,
                    latestBodyFat
                );

                for (const [date, healthData] of Object.entries(aggregatedData)) {
                    await addUserMetrics({
                        dataId: healthData.bodyFatData?.metadata?.id
                            || healthData.heightData?.metadata?.id
                            || healthData.weightData?.metadata?.id
                            || generateHash(),
                        date,
                        fatPercentage: healthData.bodyFatData?.percentage || 0,
                        height: healthData.heightData?.height?.inMeters || 0,
                        source: USER_METRICS_SOURCES.HEALTH_CONNECT,
                        weight: healthData.weightData?.weight?.inKilograms || 0,
                    });
                }

                if (userHealthData.nutritionRecords) {
                    for (const nutrition of userHealthData.nutritionRecords) {
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

            loadProfileData();
            setIsPermissionGranted(true);
            setCurrentStep(currentStep + 1);
        } else {
            setShowNoPermittedMessage(true);
            setShowCheckPermissionButton(true);
        }

        setIsLoading(false);
    }, [checkReadIsPermitted, currentStep, getHealthData, loadProfileData]);

    const handleFormSubmit = useCallback(async () => {
        setIsLoading(true);

        try {
            await addOrUpdateUser({
                activityLevel: form.activityLevel as ActivityLevelType,
                birthday: form.birthday.toISOString(),
                fitnessGoals: form.fitnessGoal,
                gender: form.gender,
                // id: 1, // TODO user ID is always 1 for now
                liftingExperience: form.liftingExperience as ExperienceLevelType,
                name: form.name,
            });

            await addOrUpdateSetting({
                type: UNIT_CHOICE_TYPE,
                value: form.unitSystem,
            });

            if (form.height || form.weight || form.eatingPhase) {
                const metricHeight = getSaveFormattedHeight(parseFloat(form.height), isImperial);
                const metricWeight = getSaveFormattedWeight(parseFloat(form.weight), POUNDS, isImperial);

                await addUserMetrics({
                    dataId: generateHash(),
                    date: getCurrentTimestampISOString(),
                    eatingPhase: form.eatingPhase as EatingPhaseType,
                    height: metricHeight,
                    source: USER_METRICS_SOURCES.USER_INPUT,
                    weight: metricWeight,
                });
            }
            await AsyncStorage.setItem(HAS_COMPLETED_ONBOARDING, 'true');
        } catch (error) {
            console.error('Failed to save user data:', error);
        } finally {
            onFinish();
        }

        setIsLoading(false);
    }, [form, onFinish, isImperial]);

    const handleFormatNumericText = useCallback((text: string, key: 'height' | 'weight') => {
        if (!text) {
            setForm({ ...form, [key]: '' });
            return;
        }

        const formattedText = formatFloatNumericInputText(text);

        if (formattedText) {
            setForm({ ...form, [key]: formattedText });
        }
    }, [form]);

    const handleSignIn = useCallback(async () => {
        setIsLoading(true);

        await promptAsync();

        setIsLoading(false);
    }, [promptAsync]);

    useEffect(() => {
        const fetchUserInfo = async () => {
            if (authData) {
                setIsLoading(true);

                const isAllowed = await handleGoogleSignIn(authData);
                setHasAllowedGoogle(isAllowed);

                setIsLoading(false);
            }
        };

        fetchUserInfo();
    }, [authData]);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>
                {steps[currentStep].title}
            </Text>
            {steps[currentStep].description.map((description, index) => (
                <Text key={index} style={styles.description}>
                    {description}
                </Text>
            ))}
            {steps[currentStep].form && (currentStep === 3 ? (
                <View style={styles.form}>
                    <CustomTextInput
                        label={t('name')}
                        onChangeText={(text) => setForm({ ...form, name: text })}
                        placeholder={t('name')}
                        value={form.name}
                    />
                    <Text style={styles.label}>
                        {t('birthday')}
                    </Text>
                    <Button
                        mode="outlined"
                        onPress={() => setDatePickerVisible(true)}
                        style={styles.datePickerButton}
                    >
                        {form.birthday.toLocaleDateString()}
                    </Button>
                    <CustomTextInput
                        keyboardType="numeric"
                        label={t('weight', { weightUnit })}
                        onChangeText={(text) => handleFormatNumericText(text, 'weight')}
                        placeholder={t('weight', { weightUnit })}
                        value={form.weight}
                    />
                    <CustomTextInput
                        keyboardType="numeric"
                        label={t('height', { heightUnit })}
                        onChangeText={(text) => handleFormatNumericText(text, 'height')}
                        placeholder={t('height', { heightUnit })}
                        value={form.height}
                    />
                    <CustomTextInput
                        label={t('fitness_goal')}
                        onChangeText={(text) => setForm({ ...form, fitnessGoal: text })}
                        placeholder={t('fitness_goal')}
                        value={form.fitnessGoal}
                    />
                    <CustomTextInput
                        label={t('gender')}
                        onChangeText={(text) => setForm({ ...form, gender: text })}
                        placeholder={t('gender')}
                        value={form.gender}
                    />
                    <CustomPicker
                        items={[
                            { label: t('none'), value: '' },
                            ...Object.values(EATING_PHASES).map((phase) => ({ label: t(phase), value: phase })),
                        ]}
                        label={t('eating_phase')}
                        onValueChange={(itemValue) => setForm({ ...form, eatingPhase: itemValue as EatingPhaseType })}
                        selectedValue={form.eatingPhase}
                    />
                    <CustomPicker
                        items={[
                            { label: t('select_activity_level'), value: '' },
                            ...ACTIVITY_LEVELS_VALUES.map((level) => ({ label: t(level), value: level })),
                        ]}
                        label={t('activity_level')}
                        onValueChange={(itemValue) => setForm({ ...form, activityLevel: itemValue as ActivityLevelType })}
                        selectedValue={form.activityLevel}
                    />
                    <CustomPicker
                        items={[
                            { label: t('select_experience_level'), value: '' },
                            ...EXPERIENCE_LEVELS_VALUES.map((level) => ({ label: t(level), value: level })),
                        ]}
                        label={t('lifting_experience')}
                        onValueChange={(itemValue) => setForm({ ...form, liftingExperience: itemValue as ExperienceLevelType })}
                        selectedValue={form.liftingExperience}
                    />
                </View>
            ) : (
                <View style={styles.form}>
                    <SegmentedButtons
                        buttons={[{
                            icon: 'ruler-square',
                            label: t('metric'),
                            value: METRIC_SYSTEM,
                        },
                        {
                            icon: 'scale',
                            label: t('imperial'),
                            value: IMPERIAL_SYSTEM,
                        }]}
                        onValueChange={(itemValue) => setForm({ ...form, unitSystem: itemValue })}
                        style={styles.segmentedButtons}
                        value={form.unitSystem}
                    />
                </View>
            ))}
            {!steps[currentStep].form && currentStep === 2 && (
                <View style={styles.buttonContainer}>
                    {hasAllowedGoogle ? (
                        <View style={styles.submitButton}>
                            <Text style={styles.submitButtonText}>
                                {t('signed_in')}
                            </Text>
                            <Button mode="elevated" onPress={handleNext} style={styles.buttonSpacing}>
                                {t('continue')}
                            </Button>
                        </View>
                    ) : (
                        <View style={styles.submitButton}>
                            <GoogleSignInButton disabled={isSigningIn} onSignIn={handleSignIn} />
                            <Button
                                mode="outlined"
                                onPress={handleNext}
                                style={styles.buttonSpacing}
                            >
                                {t('skip')}
                            </Button>
                        </View>
                    )}
                </View>
            )}
            <View style={styles.buttonContainer}>
                {(steps[currentStep].form && currentStep === 3) ? (
                    <View style={styles.submitButton}>
                        <Text style={styles.submitButtonText}>
                            {t('your_information_is_stored_locally_only')}
                        </Text>
                        <Button
                            disabled={isLoading}
                            mode="contained"
                            onPress={handleFormSubmit}
                            style={styles.buttonSpacing}
                        >
                            {t('submit')}
                        </Button>
                    </View>
                ) : null}
                {!steps[currentStep].form && currentStep === 1 && !isPermissionGranted && !showCheckPermissionButton && (
                    <>
                        <Button
                            mode="contained"
                            onPress={handleRequestPermission}
                            style={styles.buttonSpacing}
                        >
                            {t('request_permission')}
                        </Button>
                        <Button
                            disabled={isLoading}
                            mode="contained"
                            onPress={handleNext}
                            style={styles.buttonSpacing}
                        >
                            {t('skip')}
                        </Button>
                    </>
                )}
                {!steps[currentStep].form && currentStep === 1 && showCheckPermissionButton && (
                    <>
                        <Button
                            disabled={isLoading}
                            mode="contained"
                            onPress={handleCheckPermissions}
                            style={styles.buttonSpacing}
                        >
                            {t('verify_permission')}
                        </Button>
                        <Button
                            disabled={isLoading}
                            mode="contained"
                            onPress={handleNext}
                            style={styles.buttonSpacing}
                        >
                            {t('skip')}
                        </Button>
                    </>
                )}
                {(currentStep === 0 || (currentStep === 1 && isPermissionGranted)) ? (
                    <Button
                        mode="contained"
                        onPress={handleNext}
                        style={styles.buttonSpacing}
                    >
                        {t('next')}
                    </Button>
                ) : null}
            </View>
            {isLoading ? (
                <ActivityIndicator color="#3b82f6" size="large" style={styles.loadingIndicator} />
            ) : null}
            {(currentStep === 1 && showNoPermittedMessage) ? (
                <Text style={styles.notPermittedText}>{t('health_connect_not_permitted')}</Text>
            ) : null}
            <DatePickerModal
                onChangeDate={(date) => setForm({ ...form, birthday: date })}
                onClose={() => setDatePickerVisible(false)}
                selectedDate={form.birthday}
                visible={isDatePickerVisible}
            />
        </ScrollView>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        width: '100%',
    },
    buttonSpacing: {
        flex: 1,
        marginBottom: 10,
        marginHorizontal: 5,
    },
    container: {
        backgroundColor: colors.background,
        flexGrow: 1,
        justifyContent: 'center',
        padding: 16,
        // paddingBottom: 60, // hack to fix issue with navbar
        paddingTop: StatusBar.currentHeight || 0,
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
    description: {
        color: colors.onSurface,
        fontSize: 16,
        marginBottom: 24,
        textAlign: 'center',
    },
    form: {
        width: '100%',
    },
    label: {
        color: colors.onSurface,
        fontSize: 16,
        marginTop: 8,
    },
    link: {
        color: colors.primary,
        textDecorationLine: 'underline',
    },
    loadingIndicator: {
        color: colors.primary,
        marginVertical: 16,
    },
    notPermittedText: {
        color: colors.error,
        display: 'flex',
        marginHorizontal: 'auto',
        padding: 16,
    },
    segmentedButtons: {
        marginVertical: 10,
    },
    submitButton: {
        marginHorizontal: 'auto',
        textAlign: 'center',
    },
    submitButtonText: {
        marginBottom: 12,
        textAlign: 'center',
    },
    title: {
        color: colors.onSurface,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
});

export default Onboarding;
