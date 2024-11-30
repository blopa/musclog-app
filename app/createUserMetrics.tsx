import CompletionModal from '@/components/CompletionModal';
import CustomPicker from '@/components/CustomPicker';
import CustomTextInput from '@/components/CustomTextInput';
import { Screen } from '@/components/Screen';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { EATING_PHASES } from '@/constants/nutrition';
import { IMPERIAL_SYSTEM, KILOGRAMS, POUNDS } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { addUserMetrics, getUser, getUserMetrics, updateUserMetrics } from '@/utils/database';
import { getCurrentTimestampISOString } from '@/utils/date';
import { formatFloatNumericInputText, generateHash, safeToFixed } from '@/utils/string';
import { EatingPhaseType, UserMetricsInsertType } from '@/utils/types';
import {
    getDisplayFormattedHeight,
    getDisplayFormattedWeight,
    getSaveFormattedHeight,
    getSaveFormattedWeight,
} from '@/utils/unit';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Animated, BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Text, useTheme } from 'react-native-paper';

type RouteParams = {
    id?: string;
};

const CreateUserMetrics = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const route = useRoute();
    const { id } = (route.params as RouteParams) || {};

    const { t } = useTranslation();
    const [height, setHeight] = useState<string>('');
    const [weight, setWeight] = useState<string>('');
    const [fatPercentage, setFatPercentage] = useState<string>('');
    const [eatingPhase, setEatingPhase] = useState<EatingPhaseType>(EATING_PHASES.MAINTENANCE);
    const [source, setSource] = useState<string>(USER_METRICS_SOURCES.USER_INPUT);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(300)).current;
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { heightUnit, unitSystem, weightUnit } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const loadUserMetric = useCallback(async () => {
        try {
            const metrics = await getUserMetrics(Number(id));

            if (metrics) {
                const metricHeight = metrics.height || 0;
                const metricWeight = metrics.weight || 0;

                setWeight(getDisplayFormattedWeight(metricWeight, KILOGRAMS, isImperial).toString());
                setHeight(getDisplayFormattedHeight(metricHeight, isImperial).toString());
                setFatPercentage(safeToFixed(metrics.fatPercentage || 0));
                setEatingPhase(metrics.eatingPhase || EATING_PHASES.MAINTENANCE);
                setSource(metrics.source || USER_METRICS_SOURCES.USER_INPUT);
            }
        } catch (error) {
            console.error(t('failed_to_load_user_metric'), error);
        }
    }, [id, isImperial, t]);

    useFocusEffect(
        useCallback(() => {
            if (id) {
                loadUserMetric();
            }
        }, [id, loadUserMetric])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.navigate('listUserMetrics');
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

    const handleSaveUserMetric = useCallback(async () => {
        if (!height.trim() || !weight.trim() || !fatPercentage.trim() || !eatingPhase.trim()) {
            Alert.alert(t('validation_error'), t('all_fields_required'));
            return;
        }

        const metricHeight = getSaveFormattedHeight(Number(height), isImperial);
        const metricWeight = getSaveFormattedWeight(Number(weight), POUNDS, isImperial);

        const user = await getUser();
        const metricData: UserMetricsInsertType = {
            dataId: generateHash(),
            date: getCurrentTimestampISOString(),
            eatingPhase,
            fatPercentage: fatPercentage ? Number(fatPercentage) : undefined,
            height: metricHeight,
            source: USER_METRICS_SOURCES.USER_INPUT,
            userId: user?.id!,
            weight: metricWeight,
        };

        setIsSaving(true);

        try {
            if (id) {
                await updateUserMetrics(Number(id), { ...metricData });
            } else {
                await addUserMetrics(metricData);
            }
            showModal();
        } catch (error) {
            console.error(t('failed_to_save_user_metric'), error);
        } finally {
            setIsSaving(false);
        }
    }, [height, weight, fatPercentage, eatingPhase, id, showModal, t, isImperial]);

    const resetScreenData = useCallback(() => {
        setHeight('');
        setWeight('');
        setFatPercentage('');
        setEatingPhase(EATING_PHASES.MAINTENANCE);
        setSource(USER_METRICS_SOURCES.USER_INPUT);
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
            navigation.navigate('listUserMetrics');
        });
    }, [fadeAnim, navigation, resetScreenData, slideAnim]);

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
                    title={t(id ? 'edit_user_metrics' : 'create_user_metrics')}
                    titleStyle={styles.appbarTitle}
                />
                <Button
                    mode="outlined"
                    onPress={() => {
                        resetScreenData();
                        navigation.navigate('listUserMetrics');
                    }}
                    textColor={colors.onPrimary}
                >
                    {t('cancel')}
                </Button>
            </Appbar.Header>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <CustomTextInput
                    keyboardType="numeric"
                    label={t('height', { heightUnit })}
                    onChangeText={(text) => handleFormatNumericText(text, 'height')}
                    placeholder={t('enter_height')}
                    value={height}
                />
                <CustomTextInput
                    keyboardType="numeric"
                    label={t('weight', { weightUnit })}
                    onChangeText={(text) => handleFormatNumericText(text, 'weight')}
                    placeholder={t('enter_weight')}
                    value={weight}
                />
                <CustomTextInput
                    keyboardType="numeric"
                    label={t('fat_percentage')}
                    onChangeText={(text) => handleFormatNumericText(text, 'fatPercentage')}
                    placeholder={t('enter_fat_percentage')}
                    value={fatPercentage}
                />
                <CustomPicker
                    items={[
                        { label: t('none'), value: '' },
                        ...Object.values(EATING_PHASES).map((phase) => ({ label: t(phase), value: phase })),
                    ]}
                    label={t('eating_phase')}
                    onValueChange={(itemValue) => setEatingPhase(itemValue as EatingPhaseType)}
                    selectedValue={eatingPhase}
                />
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('source')}</Text>
                    <Text style={styles.sourceText}>{t(source)}</Text>
                </View>
            </ScrollView>
            <View style={styles.footer}>
                <Button
                    disabled={isSaving}
                    mode="contained"
                    onPress={handleSaveUserMetric}
                    style={styles.button}
                >
                    {t('save')}
                </Button>
            </View>
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
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    sourceText: {
        color: colors.onSurface,
        fontSize: 16,
        paddingVertical: 8,
    },
});

export default CreateUserMetrics;
