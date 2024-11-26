import AppHeader from '@/components/AppHeader';
import CustomPicker from '@/components/CustomPicker';
import CustomTextInput from '@/components/CustomTextInput';
import DatePickerModal from '@/components/DatePickerModal';
import FABWrapper from '@/components/FABWrapper';
import { Screen } from '@/components/Screen';
import { ACTIVITY_LEVELS_VALUES, EXPERIENCE_LEVELS_VALUES } from '@/constants/exercises';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { EATING_PHASES } from '@/constants/nutrition';
import { IMPERIAL_SYSTEM, KILOGRAMS, POUNDS } from '@/constants/storage';
import { FAB_ICON_SIZE, ICON_SIZE } from '@/constants/ui';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import {
    addOrUpdateUser,
    addUserMetrics,
    getLatestUser,
    getLatestUserMetrics,
    updateUserMetrics,
} from '@/utils/database';
import { getCurrentTimestampISOString, isValidDateParam } from '@/utils/date';
import { formatFloatNumericInputText, generateHash, safeToFixed } from '@/utils/string';
import { ActivityLevelType, EatingPhaseType, ExperienceLevelType } from '@/utils/types';
import {
    getDisplayFormattedHeight,
    getDisplayFormattedWeight,
    getSaveFormattedHeight,
    getSaveFormattedWeight,
} from '@/utils/unit';
import { FontAwesome, FontAwesome5, FontAwesome6, MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Text, useTheme } from 'react-native-paper';

const Profile = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const { t } = useTranslation();

    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const [birthday, setBirthday] = useState(new Date());
    const [weight, setWeight] = useState('');
    const [height, setHeight] = useState('');
    const [fatPercentage, setFatPercentage] = useState('');
    const [eatingPhase, setEatingPhase] = useState<EatingPhaseType>(EATING_PHASES.MAINTENANCE);
    const [fitnessGoal, setFitnessGoal] = useState('');
    const [gender, setGender] = useState('');
    const [activityLevel, setActivityLevel] = useState<ActivityLevelType | undefined>(undefined);
    const [liftingExperience, setLiftingExperience] = useState<ExperienceLevelType | undefined>(undefined);
    const [isDatePickerVisible, setDatePickerVisible] = useState(false);
    const [userId, setUserId] = useState<null | number>(null);
    const [showUserMetrics, setShowUserMetrics] = useState(false);
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { heightUnit, unitSystem, weightUnit } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const loadProfileData = useCallback(async () => {
        try {
            const profile = await getLatestUser();

            if (profile) {
                setUserId(profile.id || null);
                setName(profile.name || '');

                if (isValidDateParam(profile.birthday)) {
                    setBirthday(new Date(profile.birthday));
                }

                const weightValue = getDisplayFormattedWeight(profile.metrics.weight || 0, KILOGRAMS, isImperial);
                const heightValue = getDisplayFormattedHeight(profile.metrics.height || 0, isImperial);

                setWeight(weightValue.toString());
                setHeight(heightValue.toString());
                setFatPercentage(safeToFixed(profile.metrics.fatPercentage || 0));
                setEatingPhase(profile.metrics.eatingPhase || EATING_PHASES.MAINTENANCE);
                setFitnessGoal(profile.fitnessGoals || '');
                setGender(profile.gender || '');
                setActivityLevel(profile.activityLevel);
                setLiftingExperience(profile.liftingExperience);

                if (profile.metrics.weight || profile.metrics.fatPercentage) {
                    setShowUserMetrics(true);
                }
            }
        } catch (error) {
            console.error('Failed to load profile data:', error);
        }
    }, [isImperial]);

    useFocusEffect(
        useCallback(() => {
            loadProfileData();
        }, [loadProfileData])
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

    const handleSave = useCallback(async () => {
        if (userId === null) {
            return;
        }

        const profile = {
            activityLevel,
            birthday: birthday.toISOString(),
            fitnessGoals: fitnessGoal,
            gender,
            id: userId,
            liftingExperience,
            name,
        };

        const weightValue = getSaveFormattedWeight(parseFloat(weight), POUNDS, isImperial);
        const heightValue = getSaveFormattedHeight(parseFloat(height), isImperial);

        const userMetric = {
            date: getCurrentTimestampISOString(),
            eatingPhase,
            fatPercentage: parseFloat(fatPercentage),
            height: heightValue,
            unitSystem,
            userId,
            weight: weightValue,
        };

        try {
            const latestUserMetrics = await getLatestUserMetrics();

            if (latestUserMetrics?.id) {
                // TODO mark old one as deleted and create new one
                if (
                    latestUserMetrics?.eatingPhase !== userMetric.eatingPhase
                    || latestUserMetrics?.fatPercentage !== userMetric.fatPercentage
                    || latestUserMetrics?.height !== userMetric.height
                    || latestUserMetrics?.weight !== userMetric.weight
                ) {
                    await updateUserMetrics(latestUserMetrics.id, {
                        ...latestUserMetrics,
                        ...userMetric,
                    });
                }
            } else {
                await addUserMetrics({
                    ...userMetric,
                    dataId: generateHash(),
                    source: USER_METRICS_SOURCES.USER_INPUT,
                });
            }

            await addOrUpdateUser(profile);
            setIsEditing(false);
            loadProfileData();
        } catch (error) {
            console.error('Failed to save profile data:', error);
        }
    }, [
        userId,
        activityLevel,
        birthday,
        fitnessGoal,
        gender,
        liftingExperience,
        name,
        eatingPhase,
        fatPercentage,
        height,
        unitSystem,
        weight,
        loadProfileData,
        isImperial,
    ]);

    const handleCancel = useCallback(() => {
        setIsEditing(false);
    }, []);

    const resetScreenData = useCallback(() => {
        setIsEditing(false);
        setDatePickerVisible(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            return () => {
                resetScreenData();
            };
        }, [resetScreenData])
    );

    const fabActions = useMemo(() => {
        const actions = [{
            icon: () => <FontAwesome5 color={colors.primary} name="heartbeat" size={FAB_ICON_SIZE} />,
            label: t('fitness_goals'),
            onPress: () => navigation.navigate('listFitnessGoals'),
            style: { backgroundColor: colors.surface },
        }, {
            icon: () => <FontAwesome5 color={colors.primary} name="dumbbell" size={18} />,
            label: t('set_1rms'),
            onPress: () => navigation.navigate('oneRepMaxes'),
            style: { backgroundColor: colors.surface },
        }];

        if (showUserMetrics) {
            actions.unshift({
                icon: () => <FontAwesome5 color={colors.primary} name="chart-bar" size={FAB_ICON_SIZE} />,
                label: t('user_metrics'),
                onPress: () => navigation.navigate('userMetricsCharts'),
                style: { backgroundColor: colors.surface },
            });
        }

        return actions;
    }, [colors.primary, colors.surface, navigation, showUserMetrics, t]);

    const handleFormatNumericText = useCallback((text: string, key: 'fatPercentage' | 'height' | 'weight') => {
        const formattedText = formatFloatNumericInputText(text);

        if (formattedText || !text) {
            switch (key) {
                case 'fatPercentage':
                    setFatPercentage(formattedText || '');
                    break;
                case 'height':
                    setHeight(formattedText || '');
                    break;
                case 'weight':
                    setWeight(formattedText || '');
                    break;
                default: {
                    break;
                }
            }
        }
    }, []);

    const age = Math.floor((new Date().getTime() - new Date(birthday).getTime()) / 3.15576e+10);

    return (
        <Screen style={styles.container}>
            <FABWrapper actions={fabActions} icon="cog" visible>
                <View style={styles.container}>
                    <AppHeader title={t('profile')} />
                    <ScrollView contentContainerStyle={styles.scrollViewContent} keyboardShouldPersistTaps="handled">
                        {isEditing ? (
                            <View style={styles.formContainer}>
                                <Text style={styles.title}>{t('edit_profile')}</Text>
                                <CustomTextInput
                                    label={t('name')}
                                    onChangeText={setName}
                                    placeholder={t('name')}
                                    value={name}
                                />
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>{t('birthday')}</Text>
                                    <Button
                                        mode="outlined"
                                        onPress={() => setDatePickerVisible(true)}
                                        style={styles.datePickerButton}
                                    >
                                        {birthday.toLocaleDateString()}
                                    </Button>
                                </View>
                                <CustomTextInput
                                    keyboardType="numeric"
                                    label={t('weight', { weightUnit })}
                                    onChangeText={(text) => handleFormatNumericText(text, 'weight')}
                                    placeholder={t('weight', { weightUnit })}
                                    value={weight}
                                />
                                <CustomTextInput
                                    keyboardType="numeric"
                                    label={t('height', { heightUnit })}
                                    onChangeText={(text) => handleFormatNumericText(text, 'height')}
                                    placeholder={t('height', { heightUnit })}
                                    value={height}
                                />
                                <CustomTextInput
                                    keyboardType="numeric"
                                    label={t('fat_percentage')}
                                    onChangeText={(text) => handleFormatNumericText(text, 'fatPercentage')}
                                    placeholder={t('fat_percentage')}
                                    value={fatPercentage}
                                />
                                <CustomPicker
                                    items={[
                                        { label: t('none'), value: '' },
                                        ...Object.values(EATING_PHASES).map((phase) => ({ label: t(phase), value: phase })),
                                    ]}
                                    label={t('eating_phase')}
                                    onValueChange={(value) => setEatingPhase(value as EatingPhaseType)}
                                    selectedValue={eatingPhase}
                                />
                                <CustomTextInput
                                    label={t('fitness_goal')}
                                    onChangeText={setFitnessGoal}
                                    placeholder={t('fitness_goal')}
                                    value={fitnessGoal}
                                />
                                <CustomTextInput
                                    label={t('gender')}
                                    onChangeText={setGender}
                                    placeholder={t('gender')}
                                    value={gender}
                                />
                                <CustomPicker
                                    items={[
                                        { label: t('select_activity_level'), value: '' },
                                        ...ACTIVITY_LEVELS_VALUES.map((level) => ({ label: t(level), value: level })),
                                    ]}
                                    label={t('activity_level')}
                                    onValueChange={(value) => setActivityLevel(value as ActivityLevelType)}
                                    selectedValue={activityLevel || ''}
                                />
                                <CustomPicker
                                    items={[
                                        { label: t('select_experience_level'), value: '' },
                                        ...EXPERIENCE_LEVELS_VALUES.map((level) => ({ label: t(level), value: level })),
                                    ]}
                                    label={t('lifting_experience')}
                                    onValueChange={(value) => setLiftingExperience(value as ExperienceLevelType)}
                                    selectedValue={liftingExperience || ''}
                                />
                                <View style={styles.buttonContainer}>
                                    <Button mode="outlined" onPress={handleCancel} style={styles.button}>
                                        {t('cancel')}
                                    </Button>
                                    <Button mode="contained" onPress={handleSave} style={styles.button}>
                                        {t('save')}
                                    </Button>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.profileContainer}>
                                <Avatar.Icon icon="account" size={120} style={styles.avatar} />
                                <Text style={styles.profileName}>{name}</Text>
                                <Text style={styles.subtitle}>
                                    {age > 0 ? `${age} ${t('years_old')}${gender ? `, ${gender}` : ''}` : gender ? gender : ''}
                                </Text>
                                <Card style={styles.profileCard}>
                                    <Card.Content>
                                        <View style={styles.profileHeader}>
                                            <Text style={styles.sectionTitle}>{t('about')}</Text>
                                            <FontAwesome5
                                                color={colors.primary}
                                                name="edit"
                                                onPress={() => setIsEditing(true)}
                                                size={24}
                                                style={styles.editIcon}
                                            />
                                        </View>
                                        <View style={styles.profileSection}>
                                            <View style={styles.profileGrid}>
                                                <View style={styles.profileItem}>
                                                    <FontAwesome color={colors.primary} name="calendar" size={20} />
                                                    <Text style={styles.profileLabel}>{t('birthday')}</Text>
                                                    <Text style={styles.profileValue}>{birthday.toLocaleDateString()}</Text>
                                                </View>
                                                <View style={styles.profileItem}>
                                                    <FontAwesome6 color={colors.primary} name="weight-scale" size={20} />
                                                    <Text style={styles.profileLabel}>{t('weight', { weightUnit })}</Text>
                                                    <Text style={styles.profileValue}>{weight && `${weight} ${weightUnit}`}</Text>
                                                </View>
                                                <View style={styles.profileItem}>
                                                    <MaterialCommunityIcons color={colors.primary} name="human-male-height" size={24} />
                                                    <Text style={styles.profileLabel}>{t('height', { heightUnit })}</Text>
                                                    <Text style={styles.profileValue}>{height && `${height} ${heightUnit}`}</Text>
                                                </View>
                                                <View style={styles.profileItem}>
                                                    <FontAwesome5 color={colors.primary} name="percentage" size={20} />
                                                    <Text style={styles.profileLabel}>{t('fat_percentage')}</Text>
                                                    <Text style={styles.profileValue}>{fatPercentage && `${fatPercentage} %`}</Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View style={styles.profileSection}>
                                            <Text style={styles.sectionTitle}>{t('fitness_goals')}</Text>
                                            <View style={styles.profileGrid}>
                                                <View style={styles.profileItem}>
                                                    <FontAwesome5 color={colors.primary} name="heartbeat" size={ICON_SIZE} />
                                                    <Text style={styles.profileValue}>{t(fitnessGoal || 'not_set')}</Text>
                                                </View>
                                                <View style={styles.profileItem}>
                                                    <FontAwesome5 color={colors.primary} name="utensils" size={20} />
                                                    <Text style={styles.profileValue}>{t(eatingPhase || 'not_set')}</Text>
                                                </View>
                                                <View style={styles.profileItem}>
                                                    <FontAwesome5 color={colors.primary} name="running" size={20} />
                                                    <Text style={styles.profileValue}>{t(activityLevel || 'not_set')}</Text>
                                                </View>
                                                <View style={styles.profileItem}>
                                                    <MaterialCommunityIcons color={colors.primary} name="weight-lifter" size={24} />
                                                    <Text style={styles.profileValue}>{t(liftingExperience || 'not_set')}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </Card.Content>
                                </Card>
                                <View style={styles.bottomButtonContainer}>
                                    <Button
                                        icon={() => <FontAwesome5 color={colors.surface} name="heartbeat" size={20} />}
                                        mode="contained"
                                        onPress={() => navigation.navigate('listFitnessGoals')}
                                    >
                                        {t('fitness_goals')}
                                    </Button>
                                </View>
                                {showUserMetrics ? (
                                    <View style={styles.bottomButtonContainer}>
                                        <Button
                                            icon={() => <FontAwesome5 color={colors.surface} name="chart-bar" size={20} />}
                                            mode="contained"
                                            onPress={() => navigation.navigate('userMetricsCharts')}
                                        >
                                            {t('user_metrics')}
                                        </Button>
                                    </View>
                                ) : null}
                            </View>
                        )}
                        <DatePickerModal
                            onChangeDate={setBirthday}
                            onClose={() => setDatePickerVisible(false)}
                            selectedDate={birthday}
                            visible={isDatePickerVisible}
                        />
                    </ScrollView>
                </View>
            </FABWrapper>
        </Screen>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    avatar: {
        alignSelf: 'center',
        marginBottom: -16,
    },
    bottomButtonContainer: {
        alignItems: 'center',
        backgroundColor: colors.background,
        padding: 16,
    },
    button: {
        borderRadius: 25,
        marginVertical: 10,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    datePickerButton: {
        backgroundColor: colors.surface,
        borderColor: colors.onSurface,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.onSurface,
        height: 55,
        paddingLeft: 10,
        paddingTop: 8,
        width: '100%',
    },
    editIcon: {
        borderRadius: 16,
        padding: 8,
    },
    formContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
        width: '100%',
    },
    formGroup: {
        marginBottom: 16,
        width: '100%',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    profileCard: {
        borderRadius: 15,
        marginBottom: 16,
        shadowColor: colors.shadow,
        shadowOpacity: 0.2,
        shadowRadius: 5,
        width: '100%',
    },
    profileContainer: {
        alignItems: 'center',
        padding: 16,
        width: '100%',
    },
    profileGrid: {
        alignItems: 'center',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        justifyContent: 'space-between',
        marginBottom: 16,
        width: '100%',
    },
    profileHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    profileItem: {
        alignItems: 'center',
        marginBottom: 16,
        width: '22%',
    },
    profileLabel: {
        color: colors.onSurface,
        fontSize: 14,
        marginBottom: 4,
        textAlign: 'center',
    },
    profileName: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 22,
        textAlign: 'center',
    },
    profileSection: {
        marginBottom: 20,
    },
    profileValue: {
        fontSize: 16,
        textAlign: 'center',
    },
    scrollViewContent: {
        padding: 16,
        width: '100%',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        color: colors.onSurface,
        fontSize: 16,
        marginBottom: 16,
        textAlign: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
});

export default Profile;
