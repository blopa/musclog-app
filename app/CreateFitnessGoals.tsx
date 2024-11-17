import CompletionModal from '@/components/CompletionModal';
import CustomTextInput from '@/components/CustomTextInput';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { addFitnessGoals, getFitnessGoals, updateFitnessGoals } from '@/utils/database';
import { getCurrentTimestamp } from '@/utils/date';
import { formatFloatNumericInputText } from '@/utils/string';
import { FitnessGoalsInsertType } from '@/utils/types';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Animated, BackHandler, Dimensions, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, useTheme } from 'react-native-paper';
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
    const [calories, setCalories] = useState<string>('');
    const [protein, setProtein] = useState<string>('');
    const [totalCarbohydrate, setTotalCarbohydrate] = useState<string>('');
    const [totalFat, setTotalFat] = useState<string>('');
    const [alcohol, setAlcohol] = useState<string>('');
    const [fiber, setFiber] = useState<string>('');
    const [sugar, setSugar] = useState<string>('');

    // Long-Term Goals
    const [weight, setWeight] = useState<string>('');
    const [bodyFat, setBodyFat] = useState<string>('');
    const [bmi, setBmi] = useState<string>('');
    const [ffmi, setFfmi] = useState<string>('');

    const { weightUnit } = useUnit();

    const loadFitnessGoal = useCallback(async () => {
        try {
            const goal = await getFitnessGoals(Number(id));

            if (goal) {
                setCalories(goal.calories?.toString() || '');
                setProtein(goal.protein?.toString() || '');
                setTotalCarbohydrate(goal.totalCarbohydrate?.toString() || '');
                setTotalFat(goal.totalFat?.toString() || '');
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
        if (!calories.trim() || !protein.trim() || !totalCarbohydrate.trim() || !totalFat.trim()) {
            Alert.alert(t('validation_error'), t('mandatory_fields_required'));
            return;
        }

        const goalData: FitnessGoalsInsertType = {
            calories: Number(calories),
            protein: Number(protein),
            totalCarbohydrate: Number(totalCarbohydrate),
            totalFat: Number(totalFat),
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
        setCalories('');
        setProtein('');
        setTotalCarbohydrate('');
        setTotalFat('');
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

    const handleFormatNumericText = useCallback((text: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
        const formattedText = formatFloatNumericInputText(text);
        if (formattedText || !text) {
            setter(formattedText || '');
        }
    }, []);

    // Render functions for each tab
    const renderDailyIntakeTab = () => (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <CustomTextInput
                keyboardType="numeric"
                label={t('calories')}
                onChangeText={(text) => handleFormatNumericText(text, setCalories)}
                placeholder={t('enter_calories')}
                value={calories}
            />
            <CustomTextInput
                keyboardType="numeric"
                label={t('protein')}
                onChangeText={(text) => handleFormatNumericText(text, setProtein)}
                placeholder={t('enter_protein')}
                value={protein}
            />
            <CustomTextInput
                keyboardType="numeric"
                label={t('carbohydrates')}
                onChangeText={(text) => handleFormatNumericText(text, setTotalCarbohydrate)}
                placeholder={t('enter_carbohydrates')}
                value={totalCarbohydrate}
            />
            <CustomTextInput
                keyboardType="numeric"
                label={t('fat')}
                onChangeText={(text) => handleFormatNumericText(text, setTotalFat)}
                placeholder={t('enter_fat')}
                value={totalFat}
            />
            {/* Optional Fields */}
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
        </ScrollView>
    );

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
    footer: {
        alignItems: 'center',
        borderTopColor: colors.shadow,
        borderTopWidth: 1,
        padding: 16,
    },
});

export default CreateFitnessGoals;
