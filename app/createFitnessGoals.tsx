import PieChart from '@/components/Charts/PieChart';
import CompletionModal from '@/components/CompletionModal';
import CustomTextInput from '@/components/CustomTextInput';
import { Screen } from '@/components/Screen';
import SliderWithButtons from '@/components/SliderWithButtons';
import { ACTIVITY_LEVELS, ACTIVITY_LEVELS_MULTIPLIER } from '@/constants/exercises';
import { CALORIES_IN_CARBS, CALORIES_IN_FAT, CALORIES_IN_PROTEIN } from '@/constants/healthConnect';
import { GRAMS, IMPERIAL_SYSTEM } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { calculateBMR } from '@/utils/data';
import {
    addFitnessGoals,
    getFitnessGoals,
    getLatestFitnessGoals,
    getLatestUser,
    updateFitnessGoals,
} from '@/utils/database';
import { getCurrentTimestampISOString, isValidDateParam } from '@/utils/date';
import { formatFloatNumericInputText } from '@/utils/string';
import { FitnessGoalsInsertType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Animated,
    BackHandler,
    Dimensions,
    Platform,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { Appbar, Button, Text, useTheme } from 'react-native-paper';
import { TabBar, TabView } from 'react-native-tab-view';

type RouteParams = {
    id?: string;
};

const CreateFitnessGoals = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const route = useRoute();
    const { id } = (route.params as RouteParams) || {};

    const { t } = useTranslation();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(300)).current;
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const { unitSystem, weightUnit } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const [maxMacros, setMaxMacros] = useState(600);
    const [defaultMacros, setDefaultMacros] = useState({
        carbohydrate: 250,
        fat: 70,
        protein: 150,
    });

    const calculateTdee = useCallback(async () => {
        const user = await getLatestUser();

        if (user) {
            const { activityLevel, birthday, gender, metrics } = user;
            const { height, weight } = metrics;

            if (gender && weight && height && isValidDateParam(birthday)) {
                const age = Math.floor((new Date().getTime() - new Date(birthday).getTime()) / 3.15576e+10);
                const bmr = calculateBMR(weight, height * 100, age, gender.toLowerCase());
                const tdee = bmr * ACTIVITY_LEVELS_MULTIPLIER[activityLevel || ACTIVITY_LEVELS.LIGHTLY_ACTIVE];

                setDefaultMacros({
                    carbohydrate: Math.round(tdee * 0.5 / CALORIES_IN_CARBS),
                    fat: Math.round(tdee * 0.2 / CALORIES_IN_FAT),
                    protein: Math.round(tdee * 0.3 / CALORIES_IN_PROTEIN),
                });

                setMaxMacros(Math.round(tdee / 4));
            }
        }
    }, []);

    // State variables for tabs and input fields
    const [index, setIndex] = useState(0);
    const [routes] = useState([
        { key: 'dailyIntake', title: t('daily_intake') },
        { key: 'longTerm', title: t('long_term') },
    ]);

    // Daily Intake Goals
    const [protein, setProtein] = useState<number>(defaultMacros.protein);
    const [totalCarbohydrate, setTotalCarbohydrate] = useState<number>(defaultMacros.carbohydrate);
    const [totalFat, setTotalFat] = useState<number>(defaultMacros.fat);
    const [alcohol, setAlcohol] = useState<string>('');
    const [fiber, setFiber] = useState<string>('');
    const [sugar, setSugar] = useState<string>('');

    // Long-Term Goals
    const [weight, setWeight] = useState<string>('');
    const [bodyFat, setBodyFat] = useState<string>('');
    const [bmi, setBmi] = useState<string>('');
    const [ffmi, setFfmi] = useState<string>('');

    // New state variables for the dynamic daily goals tab
    const [activeMacro, setActiveMacro] = useState<'carbs' | 'fats' | 'protein'>('protein');

    const macroOrder: ('carbs' | 'fats' | 'protein')[] = ['protein', 'carbs', 'fats'];

    const calculateCalories = useCallback(() => {
        return Math.round(protein * CALORIES_IN_PROTEIN + totalCarbohydrate * CALORIES_IN_CARBS + totalFat * CALORIES_IN_FAT);
    }, [protein, totalCarbohydrate, totalFat]);

    const handleSliderChange = useCallback(
        (value: number) => {
            switch (activeMacro) {
                case 'carbs':
                    setTotalCarbohydrate(value);
                    break;
                case 'fats':
                    setTotalFat(value);
                    break;
                case 'protein':
                    setProtein(value);
                    break;
            }
        },
        [activeMacro]
    );

    const nextMacro = useCallback(() => {
        const currentIndex = macroOrder.indexOf(activeMacro);
        setActiveMacro(macroOrder[(currentIndex + 1) % macroOrder.length]);
    }, [activeMacro, macroOrder]);

    const prevMacro = useCallback(() => {
        const currentIndex = macroOrder.indexOf(activeMacro);
        setActiveMacro(macroOrder[(currentIndex - 1 + macroOrder.length) % macroOrder.length]);
    }, [activeMacro, macroOrder]);

    const loadFitnessGoal = useCallback(async () => {
        try {
            const goal = await getFitnessGoals(Number(id));

            if (goal) {
                setProtein(goal.protein ?? defaultMacros.protein);
                setTotalCarbohydrate(goal.totalCarbohydrate ?? defaultMacros.carbohydrate);
                setTotalFat(goal.totalFat ?? defaultMacros.fat);
                setAlcohol(goal.alcohol?.toString() || '');
                setFiber(goal.fiber?.toString() || '');
                setSugar(goal.sugar?.toString() || '');
                setWeight(goal.weight?.toString() || '');
                setBodyFat(goal.bodyFat?.toString() || '');
                setBmi(goal.bmi?.toString() || '');
                setFfmi(goal.ffmi?.toString() || '');
            }
        } catch (error) {
            console.error(t('failed_to_load_fitness_goal'), error);
        }
    }, [defaultMacros.carbohydrate, defaultMacros.fat, defaultMacros.protein, id, t]);

    useFocusEffect(
        useCallback(() => {
            const loadLatest = async () => {
                const fitnessGoals = await getLatestFitnessGoals();
                setProtein(fitnessGoals?.protein ?? defaultMacros.protein);
                setTotalCarbohydrate(fitnessGoals?.totalCarbohydrate ?? defaultMacros.carbohydrate);
                setTotalFat(fitnessGoals?.totalFat ?? defaultMacros.fat);
                setAlcohol(fitnessGoals?.alcohol?.toString() || '');
                setFiber(fitnessGoals?.fiber?.toString() || '');
                setSugar(fitnessGoals?.sugar?.toString() || '');
                setWeight(fitnessGoals?.weight?.toString() || '');
                setBodyFat(fitnessGoals?.bodyFat?.toString() || '');
                setBmi(fitnessGoals?.bmi?.toString() || '');
                setFfmi(fitnessGoals?.ffmi?.toString() || '');
            };

            if (!id) {
                loadLatest();
            }
        }, [defaultMacros.carbohydrate, defaultMacros.fat, defaultMacros.protein, id])
    );

    useFocusEffect(
        useCallback(() => {
            if (id) {
                loadFitnessGoal();
            }
        }, [id, loadFitnessGoal])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.navigate('listFitnessGoals');
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

    const handleSaveFitnessGoal = useCallback(async () => {
        if (
            protein === undefined
            || totalCarbohydrate === undefined
            || totalFat === undefined
        ) {
            Alert.alert(t('validation_error'), t('mandatory_fields_required'));
            return;
        }

        const calories = calculateCalories();

        const goalData: FitnessGoalsInsertType = {
            alcohol: alcohol ? Number(alcohol) : undefined,
            bmi: bmi ? Number(bmi) : undefined,
            bodyFat: bodyFat ? Number(bodyFat) : undefined,
            calories,
            createdAt: getCurrentTimestampISOString(),
            ffmi: ffmi ? Number(ffmi) : undefined,
            fiber: fiber ? Number(fiber) : undefined,
            protein,
            sugar: sugar ? Number(sugar) : undefined,
            totalCarbohydrate,
            totalFat,
            weight: weight ? Number(weight) : undefined,
        };

        setIsSaving(true);

        try {
            if (id) {
                await updateFitnessGoals(Number(id), { ...goalData });
            } else {
                await addFitnessGoals(goalData);
            }
            showModal();
        } catch (error) {
            console.error(t('failed_to_save_fitness_goal'), error);
        } finally {
            setIsSaving(false);
        }
    }, [
        protein,
        totalCarbohydrate,
        totalFat,
        alcohol,
        fiber,
        sugar,
        weight,
        bodyFat,
        bmi,
        ffmi,
        id,
        showModal,
        t,
        calculateCalories,
    ]);

    const resetScreenData = useCallback(() => {
        setProtein(defaultMacros.protein);
        setTotalCarbohydrate(defaultMacros.carbohydrate);
        setTotalFat(defaultMacros.fat);
        setAlcohol('');
        setFiber('');
        setSugar('');
        setWeight('');
        setBodyFat('');
        setBmi('');
        setFfmi('');
    }, [defaultMacros.carbohydrate, defaultMacros.fat, defaultMacros.protein]);

    useFocusEffect(
        useCallback(() => {
            calculateTdee();
        }, [calculateTdee])
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
            navigation.navigate('listFitnessGoals');
        });
    }, [fadeAnim, navigation, resetScreenData, slideAnim]);

    const handleFormatNumericText = useCallback(
        (text: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
            const formattedText = formatFloatNumericInputText(text);
            if (formattedText || !text) {
                setter(formattedText || '');
            }
        },
        []
    );

    // Render functions for each tab
    const renderDailyIntakeTab = useCallback(() => {
        const calories = calculateCalories();

        const pieData = [
            { color: '#FF6384', label: t('protein'), value: protein * CALORIES_IN_PROTEIN },
            { color: '#36A2EB', label: t('carbohydrates'), value: totalCarbohydrate * CALORIES_IN_CARBS },
            { color: '#FFCE56', label: t('fat'), value: totalFat * CALORIES_IN_FAT },
        ];

        const activeMacroValue = activeMacro === 'protein'
            ? protein
            : activeMacro === 'carbs'
                ? totalCarbohydrate
                : totalFat;

        return (
            <Screen style={styles.container}>
                <ScrollView contentContainerStyle={styles.flexContainer}>
                    <Text style={styles.title}>{t('adjust_your_macros')}</Text>
                    <View style={styles.macroAdjusterContainer}>
                        <Button mode="outlined" onPress={prevMacro} style={styles.arrowButton}>
                            <FontAwesome5 color={colors.primary} name="arrow-left" size={20} />
                        </Button>
                        <View style={styles.activeMacroContainer}>
                            <Text style={styles.activeMacroTitle}>{t(activeMacro)}</Text>
                            <Text style={styles.activeMacroValue}>
                                {getDisplayFormattedWeight(activeMacroValue || 0, GRAMS, isImperial).toString()}
                            </Text>
                        </View>
                        <Button mode="outlined" onPress={nextMacro} style={styles.arrowButton}>
                            <FontAwesome5 color={colors.primary} name="arrow-right" size={20} />
                        </Button>
                    </View>
                    <SliderWithButtons
                        label=""
                        maximumValue={maxMacros}
                        minimumValue={0}
                        onValueChange={handleSliderChange}
                        value={activeMacroValue}
                    />
                    <View style={styles.macrosSummary}>
                        <View style={styles.macroSummaryItem}>
                            <Text style={styles.macroSummaryTitle}>{t('protein')}</Text>
                            <Text style={styles.macroSummaryValue}>
                                {getDisplayFormattedWeight(protein || 0, GRAMS, isImperial).toString()}
                            </Text>
                        </View>
                        <View style={styles.macroSummaryItem}>
                            <Text style={styles.macroSummaryTitle}>{t('carbohydrates')}</Text>
                            <Text style={styles.macroSummaryValue}>
                                {getDisplayFormattedWeight(totalCarbohydrate || 0, GRAMS, isImperial).toString()}
                            </Text>
                        </View>
                        <View style={styles.macroSummaryItem}>
                            <Text style={styles.macroSummaryTitle}>{t('fat')}</Text>
                            <Text style={styles.macroSummaryValue}>
                                {getDisplayFormattedWeight(totalFat || 0, GRAMS, isImperial).toString()}
                            </Text>
                        </View>
                        <View style={styles.macroSummaryItem}>
                            <Text style={styles.macroSummaryTitle}>{t('calories')}</Text>
                            <Text style={styles.macroSummaryValue}>
                                {t('value_kcal', { value: calories })}
                            </Text>
                        </View>
                    </View>
                    <PieChart
                        data={pieData}
                        showShareImageButton={false}
                        title={t('macros_distribution')}
                    />
                    <View style={styles.optionalFields}>
                        <CustomTextInput
                            keyboardType="numeric"
                            label={t('alcohol')}
                            onChangeText={(text) => handleFormatNumericText(text, setAlcohol)}
                            placeholder={t('enter_alcohol')}
                            value={alcohol}
                        />
                        <CustomTextInput
                            keyboardType="numeric"
                            label={t('fiber')}
                            onChangeText={(text) => handleFormatNumericText(text, setFiber)}
                            placeholder={t('enter_fiber')}
                            value={fiber}
                        />
                        <CustomTextInput
                            keyboardType="numeric"
                            label={t('sugar')}
                            onChangeText={(text) => handleFormatNumericText(text, setSugar)}
                            placeholder={t('enter_sugar')}
                            value={sugar}
                        />
                    </View>
                </ScrollView>
            </Screen>
        );
    }, [activeMacro, alcohol, calculateCalories, colors.primary, fiber, handleFormatNumericText, handleSliderChange, isImperial, maxMacros, nextMacro, prevMacro, protein, styles.activeMacroContainer, styles.activeMacroTitle, styles.activeMacroValue, styles.arrowButton, styles.container, styles.flexContainer, styles.macroAdjusterContainer, styles.macroSummaryItem, styles.macroSummaryTitle, styles.macroSummaryValue, styles.macrosSummary, styles.optionalFields, styles.title, sugar, t, totalCarbohydrate, totalFat]);

    const renderLongTermTab = useCallback(() => (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <CustomTextInput
                keyboardType="numeric"
                label={t('weight', { weightUnit })}
                onChangeText={(text) => handleFormatNumericText(text, setWeight)}
                placeholder={t('enter_weight')}
                value={weight}
            />
            <CustomTextInput
                keyboardType="numeric"
                label={t('body_fat')}
                onChangeText={(text) => handleFormatNumericText(text, setBodyFat)}
                placeholder={t('enter_body_fat')}
                value={bodyFat}
            />
            <CustomTextInput
                keyboardType="numeric"
                label={t('bmi')}
                onChangeText={(text) => handleFormatNumericText(text, setBmi)}
                placeholder={t('enter_bmi')}
                value={bmi}
            />
            <CustomTextInput
                keyboardType="numeric"
                label={t('ffmi')}
                onChangeText={(text) => handleFormatNumericText(text, setFfmi)}
                placeholder={t('enter_ffmi')}
                value={ffmi}
            />
        </ScrollView>
    ), [bmi, bodyFat, ffmi, handleFormatNumericText, styles.content, t, weight, weightUnit]);

    const renderScene = useCallback(({ route }: { route: { key: string } }) => {
        switch (route.key) {
            case 'dailyIntake':
                return renderDailyIntakeTab();
            case 'longTerm':
                return renderLongTermTab();
            default:
                return null;
        }
    }, [renderDailyIntakeTab, renderLongTermTab]);

    const renderTabBar = useCallback((props: any) => (
        <TabBar
            {...props}
            indicatorStyle={{ backgroundColor: colors.primary }}
            labelStyle={{ color: colors.onSurface }}
            style={{ backgroundColor: colors.surface }}
        />
    ), [colors.onSurface, colors.primary, colors.surface]);

    return (
        <Screen style={styles.container}>
            <CompletionModal
                buttonText={t('ok')}
                isModalVisible={isModalVisible}
                onClose={handleModalClose}
                title={t(id ? 'generic_updated_successfully' : 'generic_created_successfully')}
            />
            <Appbar.Header mode="small" statusBarHeight={0} style={styles.appbarHeader}>
                <Appbar.Content
                    title={t(id ? 'edit_fitness_goals' : 'create_fitness_goals')}
                    titleStyle={styles.appbarTitle}
                />
                <Button
                    mode="outlined"
                    onPress={() => {
                        resetScreenData();
                        navigation.navigate('listFitnessGoals');
                    }}
                    textColor={colors.onPrimary}
                >
                    {t('cancel')}
                </Button>
            </Appbar.Header>
            <TabView
                initialLayout={{ width: Dimensions.get('window').width }}
                navigationState={{ index, routes }}
                onIndexChange={setIndex}
                renderScene={renderScene}
                renderTabBar={renderTabBar}
            />
            <View style={styles.footer}>
                <Button disabled={isSaving} mode="contained" onPress={handleSaveFitnessGoal} style={styles.button}>
                    {t('save')}
                </Button>
            </View>
        </Screen>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    activeMacroContainer: {
        alignItems: 'center',
    },
    activeMacroTitle: {
        color: colors.onSurface,
        fontSize: 20,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    activeMacroValue: {
        color: colors.primary,
        fontSize: 32,
        fontWeight: 'bold',
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
    arrowButton: {
        marginHorizontal: 8,
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
    flexContainer: {
        alignItems: 'center',
        padding: 16,
    },
    footer: {
        alignItems: 'center',
        borderTopColor: colors.shadow,
        borderTopWidth: 1,
        padding: 16,
    },
    macroAdjusterContainer: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 16,
    },
    macrosSummary: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
        marginTop: 16,
        width: '100%',
    },
    macroSummaryItem: {
        alignItems: 'center',
        marginVertical: 8,
        width: '45%',
    },
    macroSummaryTitle: {
        color: colors.onSurface,
        fontSize: 16,
        fontWeight: '600',
    },
    macroSummaryValue: {
        color: colors.primary,
        fontSize: 18,
        fontWeight: 'bold',
    },
    optionalFields: {
        paddingVertical: 16,
        width: '100%',
    },
    title: {
        color: colors.onSurface,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
});

export default CreateFitnessGoals;
