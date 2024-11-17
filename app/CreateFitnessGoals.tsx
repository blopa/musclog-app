import PieChart from '@/components/Charts/PieChart';
import CompletionModal from '@/components/CompletionModal';
import CustomTextInput from '@/components/CustomTextInput';
import SliderWithButtons from '@/components/SliderWithButtons';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { addFitnessGoals, getFitnessGoals, updateFitnessGoals } from '@/utils/database';
import { getCurrentTimestamp } from '@/utils/date';
import { formatFloatNumericInputText } from '@/utils/string';
import { FitnessGoalsInsertType } from '@/utils/types';
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
import { Appbar, Button, useTheme, Text } from 'react-native-paper';
import { TabView, TabBar } from 'react-native-tab-view';

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

    // State variables for tabs and input fields
    const [index, setIndex] = useState(0);
    const [routes] = useState([
        { key: 'dailyIntake', title: t('daily_intake') },
        { key: 'longTerm', title: t('long_term') },
    ]);

    // Daily Intake Goals
    const [calories, setCalories] = useState<number>(2000);
    const [protein, setProtein] = useState<number>(25);
    const [totalCarbohydrate, setTotalCarbohydrate] = useState<number>(50);
    const [totalFat, setTotalFat] = useState<number>(25);
    const [alcohol, setAlcohol] = useState<string>('');
    const [fiber, setFiber] = useState<string>('');
    const [sugar, setSugar] = useState<string>('');

    // Long-Term Goals
    const [weight, setWeight] = useState<string>('');
    const [bodyFat, setBodyFat] = useState<string>('');
    const [bmi, setBmi] = useState<string>('');
    const [ffmi, setFfmi] = useState<string>('');

    const { weightUnit } = useUnit();

    // New state variables for the dynamic daily goals tab
    const [activeMacro, setActiveMacro] = useState<'protein' | 'carbs' | 'fats' | 'calories'>(
        'protein'
    );

    const macroOrder: ('protein' | 'carbs' | 'fats' | 'calories')[] = [
        'protein',
        'carbs',
        'fats',
        'calories',
    ];

    const handleSliderChange = useCallback(
        (value: number) => {
            switch (activeMacro) {
                case 'protein':
                    setProtein(value);
                    break;
                case 'carbs':
                    setTotalCarbohydrate(value);
                    break;
                case 'fats':
                    setTotalFat(value);
                    break;
                case 'calories':
                    setCalories(value);
                    break;
            }
        },
        [activeMacro]
    );

    const nextMacro = () => {
        const currentIndex = macroOrder.indexOf(activeMacro);
        setActiveMacro(macroOrder[(currentIndex + 1) % macroOrder.length]);
    };

    const prevMacro = () => {
        const currentIndex = macroOrder.indexOf(activeMacro);
        setActiveMacro(
            macroOrder[(currentIndex - 1 + macroOrder.length) % macroOrder.length]
        );
    };

    const getSliderMax = () => {
        if (activeMacro === 'calories') return 5000;
        return 100; // for protein, carbs, fats
    };

    const getSliderMin = () => {
        return 0;
    };

    const getSliderStep = () => {
        if (activeMacro === 'calories') return 50;
        return 1;
    };

    const loadFitnessGoal = useCallback(async () => {
        try {
            const goal = await getFitnessGoals(Number(id));

            if (goal) {
                setCalories(goal.calories ?? 2000);
                setProtein(goal.protein ?? 25);
                setTotalCarbohydrate(goal.totalCarbohydrate ?? 50);
                setTotalFat(goal.totalFat ?? 25);
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
    }, [id, t]);

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
            calories === undefined ||
            protein === undefined ||
            totalCarbohydrate === undefined ||
            totalFat === undefined
        ) {
            Alert.alert(t('validation_error'), t('mandatory_fields_required'));
            return;
        }

        const goalData: FitnessGoalsInsertType = {
            calories,
            protein,
            totalCarbohydrate,
            totalFat,
            alcohol: alcohol ? Number(alcohol) : undefined,
            fiber: fiber ? Number(fiber) : undefined,
            sugar: sugar ? Number(sugar) : undefined,
            weight: weight ? Number(weight) : undefined,
            bodyFat: bodyFat ? Number(bodyFat) : undefined,
            bmi: bmi ? Number(bmi) : undefined,
            ffmi: ffmi ? Number(ffmi) : undefined,
            createdAt: getCurrentTimestamp(),
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
        calories,
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
    ]);

    const resetScreenData = useCallback(() => {
        setCalories(2000);
        setProtein(25);
        setTotalCarbohydrate(50);
        setTotalFat(25);
        setAlcohol('');
        setFiber('');
        setSugar('');
        setWeight('');
        setBodyFat('');
        setBmi('');
        setFfmi('');
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
    const renderDailyIntakeTab = () => {
        const pieData = [
            { label: t('protein'), value: protein || 0, color: '#FF6384' },
            { label: t('carbohydrates'), value: totalCarbohydrate || 0, color: '#36A2EB' },
            { label: t('fat'), value: totalFat || 0, color: '#FFCE56' },
        ];

        const activeMacroValue =
            activeMacro === 'calories'
                ? calories
                : activeMacro === 'protein'
                    ? protein
                    : activeMacro === 'carbs'
                        ? totalCarbohydrate
                        : totalFat;

        return (
            <ScrollView contentContainerStyle={styles.flexContainer}>
                <Text style={styles.title}>{t('adjust_your_macros')}</Text>
                <View style={styles.macroAdjusterContainer}>
                    <Button mode="outlined" onPress={prevMacro} style={styles.arrowButton}>
                        <FontAwesome5 name="arrow-left" size={20} color={colors.primary} />
                    </Button>
                    <View style={styles.activeMacroContainer}>
                        <Text style={styles.activeMacroTitle}>{t(activeMacro)}</Text>
                        <Text style={styles.activeMacroValue}>
                            {activeMacroValue}{' '}
                            {activeMacro === 'calories' ? 'kcal' : 'g'}
                        </Text>
                    </View>
                    <Button mode="outlined" onPress={nextMacro} style={styles.arrowButton}>
                        <FontAwesome5 name="arrow-right" size={20} color={colors.primary} />
                    </Button>
                </View>
                <SliderWithButtons
                    label=""
                    value={activeMacroValue}
                    onValueChange={handleSliderChange}
                    minimumValue={getSliderMin()}
                    maximumValue={getSliderMax()}
                />
                <View style={styles.macrosSummary}>
                    <View style={styles.macroSummaryItem}>
                        <Text style={styles.macroSummaryTitle}>{t('protein')}</Text>
                        <Text style={styles.macroSummaryValue}>{protein || 0}g</Text>
                    </View>
                    <View style={styles.macroSummaryItem}>
                        <Text style={styles.macroSummaryTitle}>{t('carbohydrates')}</Text>
                        <Text style={styles.macroSummaryValue}>{totalCarbohydrate || 0}g</Text>
                    </View>
                    <View style={styles.macroSummaryItem}>
                        <Text style={styles.macroSummaryTitle}>{t('fat')}</Text>
                        <Text style={styles.macroSummaryValue}>{totalFat || 0}g</Text>
                    </View>
                    <View style={styles.macroSummaryItem}>
                        <Text style={styles.macroSummaryTitle}>{t('calories')}</Text>
                        <Text style={styles.macroSummaryValue}>{calories || 0} kcal</Text>
                    </View>
                </View>
                <PieChart
                    data={pieData}
                    title={t('macros_distribution')}
                    showShareImageButton={false}
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
        );
    };

    const renderLongTermTab = () => (
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
    );

    const renderScene = ({ route }: { route: { key: string } }) => {
        switch (route.key) {
            case 'dailyIntake':
                return renderDailyIntakeTab();
            case 'longTerm':
                return renderLongTermTab();
            default:
                return null;
        }
    };

    const renderTabBar = (props: any) => (
        <TabBar
            {...props}
            indicatorStyle={{ backgroundColor: colors.primary }}
            style={{ backgroundColor: colors.surface }}
            labelStyle={{ color: colors.onSurface }}
        />
    );

    return (
        <View style={styles.container}>
            <CompletionModal
                buttonText={t('ok')}
                isModalVisible={isModalVisible}
                onClose={handleModalClose}
                title={t(id ? 'fitness_goal_updated_successfully' : 'fitness_goal_created_successfully')}
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
                navigationState={{ index, routes }}
                renderScene={renderScene}
                renderTabBar={renderTabBar}
                onIndexChange={setIndex}
                initialLayout={{ width: Dimensions.get('window').width }}
            />
            <View style={styles.footer}>
                <Button disabled={isSaving} mode="contained" onPress={handleSaveFitnessGoal} style={styles.button}>
                    {t('save')}
                </Button>
            </View>
        </View>
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
    macrosSummary: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
        marginTop: 16,
        width: '100%',
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
