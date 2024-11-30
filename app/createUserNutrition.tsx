import CompletionModal from '@/components/CompletionModal';
import CustomTextInput from '@/components/CustomTextInput';
import { Screen } from '@/components/Screen';
import { USER_METRICS_SOURCES } from '@/constants/healthConnect';
import { NUTRITION_TYPES } from '@/constants/nutrition';
import { GRAMS, IMPERIAL_SYSTEM, OUNCES } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { addUserNutrition, getUserNutrition, updateUserNutrition } from '@/utils/database';
import { getCurrentTimestampISOString } from '@/utils/date';
import { formatFloatNumericInputText, generateHash } from '@/utils/string';
import { UserNutritionTypeType } from '@/utils/types';
import { getDisplayFormattedWeight, getSaveFormattedWeight } from '@/utils/unit';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Animated, BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, SegmentedButtons, Text, useTheme } from 'react-native-paper';

type RouteParams = {
    id?: string;
};

const CreateUserNutrition = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const route = useRoute();
    const { id } = (route.params as RouteParams) || {};

    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [calories, setCalories] = useState('');
    const [carbohydrate, setCarbohydrate] = useState('');
    const [fat, setFat] = useState('');
    const [protein, setProtein] = useState('');
    const [fiber, setFiber] = useState('');
    const [sugar, setSugar] = useState('');
    const [saturatedFat, setSaturatedFat] = useState('');
    const [monounsaturatedFat, setMonounsaturatedFat] = useState('');
    const [polyunsaturatedFat, setPolyunsaturatedFat] = useState('');
    const [transFat, setTransFat] = useState('');
    const [unsaturatedFat, setUnsaturatedFat] = useState('');
    const [nutritionType, setNutritionType] = useState<UserNutritionTypeType>(NUTRITION_TYPES.FULL_DAY);
    const [source, setSource] = useState<string>(USER_METRICS_SOURCES.USER_INPUT);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(300)).current;
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { unitSystem } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;

    const loadUserNutrition = useCallback(async () => {
        try {
            const nutrition = await getUserNutrition(Number(id));

            if (nutrition) {
                setName(nutrition.name || '');
                setCalories((nutrition.calories || 0).toString());
                setCarbohydrate(getDisplayFormattedWeight(nutrition.carbohydrate, GRAMS, isImperial).toString());
                setFat(getDisplayFormattedWeight(nutrition.fat, GRAMS, isImperial).toString());
                setProtein(getDisplayFormattedWeight(nutrition.protein, GRAMS, isImperial).toString());
                setFiber(getDisplayFormattedWeight(nutrition.fiber || 0, GRAMS, isImperial).toString());
                setSugar(getDisplayFormattedWeight(nutrition.sugar || 0, GRAMS, isImperial).toString());
                setSaturatedFat(getDisplayFormattedWeight(nutrition.saturatedFat || 0, GRAMS, isImperial).toString());
                setMonounsaturatedFat(getDisplayFormattedWeight(nutrition.monounsaturatedFat || 0, GRAMS, isImperial).toString());
                setPolyunsaturatedFat(getDisplayFormattedWeight(nutrition.polyunsaturatedFat || 0, GRAMS, isImperial).toString());
                setTransFat(getDisplayFormattedWeight(nutrition.transFat || 0, GRAMS, isImperial).toString());
                setUnsaturatedFat(getDisplayFormattedWeight(nutrition.unsaturatedFat || 0, GRAMS, isImperial).toString());
                setNutritionType(nutrition.type || NUTRITION_TYPES.FULL_DAY);
                setSource(nutrition.source || USER_METRICS_SOURCES.USER_INPUT);
            }
        } catch (error) {
            console.error(t('failed_to_load_user_nutrition'), error);
        }
    }, [id, isImperial, t]);

    useFocusEffect(
        useCallback(() => {
            if (id) {
                loadUserNutrition();
            }
        }, [id, loadUserNutrition])
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

    const handleSaveUserNutrition = useCallback(async () => {
        if (!name.trim() || !calories.trim() || !carbohydrate.trim() || !fat.trim() || !protein.trim()) {
            Alert.alert(t('validation_error'), t('all_fields_required'));
            return;
        }

        const nutritionData = {
            calories: parseFloat(calories),
            carbohydrate: getSaveFormattedWeight(parseFloat(carbohydrate), OUNCES, isImperial),
            dataId: generateHash(),
            date: getCurrentTimestampISOString(), // TODO: add a date picker
            fat: getSaveFormattedWeight(parseFloat(fat), OUNCES, isImperial),
            fiber: getSaveFormattedWeight(parseFloat(fiber), OUNCES, isImperial),
            monounsaturatedFat: getSaveFormattedWeight(parseFloat(monounsaturatedFat), OUNCES, isImperial),
            name,
            polyunsaturatedFat: getSaveFormattedWeight(parseFloat(polyunsaturatedFat), OUNCES, isImperial),
            protein: getSaveFormattedWeight(parseFloat(protein), OUNCES, isImperial),
            saturatedFat: getSaveFormattedWeight(parseFloat(saturatedFat), OUNCES, isImperial),
            source: USER_METRICS_SOURCES.USER_INPUT,
            sugar: getSaveFormattedWeight(parseFloat(sugar), OUNCES, isImperial),
            transFat: getSaveFormattedWeight(parseFloat(transFat), OUNCES, isImperial),
            type: nutritionType,
            unitSystem: unitSystem,
            unsaturatedFat: getSaveFormattedWeight(parseFloat(unsaturatedFat), OUNCES, isImperial),
        };

        setIsSaving(true);

        try {
            if (id) {
                await updateUserNutrition(Number(id), { ...nutritionData });
            } else {
                await addUserNutrition(nutritionData);
            }
            showModal();
        } catch (error) {
            console.error(t('failed_to_save_user_nutrition'), error);
        } finally {
            setIsSaving(false);
        }
    }, [
        t,
        id,
        fat,
        name,
        fiber,
        sugar,
        protein,
        calories,
        transFat,
        showModal,
        unitSystem,
        isImperial,
        saturatedFat,
        carbohydrate,
        nutritionType,
        unsaturatedFat,
        monounsaturatedFat,
        polyunsaturatedFat,
    ]);

    const resetScreenData = useCallback(() => {
        setName('');
        setCalories('');
        setCarbohydrate('');
        setFat('');
        setProtein('');
        setFiber('');
        setSugar('');
        setSaturatedFat('');
        setMonounsaturatedFat('');
        setPolyunsaturatedFat('');
        setTransFat('');
        setUnsaturatedFat('');
        setNutritionType(NUTRITION_TYPES.FULL_DAY);
        setSource(USER_METRICS_SOURCES.USER_INPUT);
    }, []);

    useFocusEffect(
        useCallback(() => {
            return () => {
                resetScreenData();
            };
        }, [resetScreenData])
    );

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                navigation.navigate('listUserNutrition');
                return true;
            };

            BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => {
                BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            };
        }, [navigation])
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
            navigation.navigate('listUserNutrition');
        });
    }, [fadeAnim, navigation, resetScreenData, slideAnim]);

    const handleFormatNumericText = useCallback((text: string, key: 'calories' | 'carbohydrate' | 'fat' | 'fiber' | 'monounsaturatedFat' | 'polyunsaturatedFat' | 'protein' | 'saturatedFat' | 'sugar' | 'transFat' | 'unsaturatedFat') => {
        const formattedText = formatFloatNumericInputText(text);

        if (formattedText || !text) {
            switch (key) {
                case 'calories':
                    setCalories(formattedText || '0');
                    break;
                case 'carbohydrate':
                    setCarbohydrate(formattedText || '0');
                    break;
                case 'fat':
                    setFat(formattedText || '0');
                    break;
                case 'fiber':
                    setFiber(formattedText || '0');
                    break;
                case 'monounsaturatedFat':
                    setMonounsaturatedFat(formattedText || '0');
                    break;
                case 'polyunsaturatedFat':
                    setPolyunsaturatedFat(formattedText || '0');
                    break;
                case 'protein':
                    setProtein(formattedText || '0');
                    break;
                case 'saturatedFat':
                    setSaturatedFat(formattedText || '0');
                    break;
                case 'sugar':
                    setSugar(formattedText || '0');
                    break;
                case 'transFat':
                    setTransFat(formattedText || '0');
                    break;
                case 'unsaturatedFat':
                    setUnsaturatedFat(formattedText || '0');
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
                    title={t(id ? 'edit_user_nutrition' : 'create_user_nutrition')}
                    titleStyle={styles.appbarTitle}
                />
                <Button
                    mode="outlined"
                    onPress={() => {
                        resetScreenData();
                        navigation.navigate('listUserNutrition');
                    }}
                    textColor={colors.onPrimary}
                >
                    {t('cancel')}
                </Button>
            </Appbar.Header>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('name')} <Text style={styles.required}>*</Text></Text>
                    <CustomTextInput
                        onChangeText={setName}
                        placeholder={t('name')}
                        value={name}
                    />
                </View>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('calories')} <Text style={styles.required}>*</Text></Text>
                    <CustomTextInput
                        keyboardType="numeric"
                        onChangeText={(text) => handleFormatNumericText(text, 'calories')}
                        placeholder={t('calories')}
                        value={calories}
                    />
                </View>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('carbs')} <Text style={styles.required}>*</Text></Text>
                    <CustomTextInput
                        keyboardType="numeric"
                        onChangeText={(text) => handleFormatNumericText(text, 'carbohydrate')}
                        placeholder={t('carbs')}
                        value={carbohydrate}
                    />
                </View>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('fats')} <Text style={styles.required}>*</Text></Text>
                    <CustomTextInput
                        keyboardType="numeric"
                        onChangeText={(text) => handleFormatNumericText(text, 'fat')}
                        placeholder={t('fats')}
                        value={fat}
                    />
                </View>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('proteins')} <Text style={styles.required}>*</Text></Text>
                    <CustomTextInput
                        keyboardType="numeric"
                        onChangeText={(text) => handleFormatNumericText(text, 'protein')}
                        placeholder={t('proteins')}
                        value={protein}
                    />
                </View>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('fibers')}</Text>
                    <CustomTextInput
                        keyboardType="numeric"
                        onChangeText={(text) => handleFormatNumericText(text, 'fiber')}
                        placeholder={t('fibers')}
                        value={fiber}
                    />
                </View>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('sugar')}</Text>
                    <CustomTextInput
                        keyboardType="numeric"
                        onChangeText={(text) => handleFormatNumericText(text, 'sugar')}
                        placeholder={t('sugar')}
                        value={sugar}
                    />
                </View>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('saturated_fat')}</Text>
                    <CustomTextInput
                        keyboardType="numeric"
                        onChangeText={(text) => handleFormatNumericText(text, 'saturatedFat')}
                        placeholder={t('saturated_fat')}
                        value={saturatedFat}
                    />
                </View>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('monounsaturated_fat')}</Text>
                    <CustomTextInput
                        keyboardType="numeric"
                        onChangeText={(text) => handleFormatNumericText(text, 'monounsaturatedFat')}
                        placeholder={t('monounsaturated_fat')}
                        value={monounsaturatedFat}
                    />
                </View>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('polyunsaturated_fat')}</Text>
                    <CustomTextInput
                        keyboardType="numeric"
                        onChangeText={(text) => handleFormatNumericText(text, 'polyunsaturatedFat')}
                        placeholder={t('polyunsaturated_fat')}
                        value={polyunsaturatedFat}
                    />
                </View>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('trans_fat')}</Text>
                    <CustomTextInput
                        keyboardType="numeric"
                        onChangeText={(text) => handleFormatNumericText(text, 'transFat')}
                        placeholder={t('trans_fat')}
                        value={transFat}
                    />
                </View>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('unsaturated_fat')}</Text>
                    <CustomTextInput
                        keyboardType="numeric"
                        onChangeText={(text) => handleFormatNumericText(text, 'unsaturatedFat')}
                        placeholder={t('unsaturated_fat')}
                        value={unsaturatedFat}
                    />
                </View>
                {id ? (
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>{t('source')}</Text>
                        <Text style={styles.sourceText}>{t(source)}</Text>
                    </View>
                ) : null}
                <View>
                    <Text style={styles.label}>{t('type')} <Text style={styles.required}>*</Text></Text>
                    <SegmentedButtons
                        buttons={[
                            { label: t(NUTRITION_TYPES.FULL_DAY), value: NUTRITION_TYPES.FULL_DAY },
                            { label: t(NUTRITION_TYPES.MEAL), value: NUTRITION_TYPES.MEAL },
                        ]}
                        onValueChange={(value) => setNutritionType(value as UserNutritionTypeType)}
                        style={styles.segmentedButtons}
                        value={nutritionType}
                    />
                </View>
            </ScrollView>
            <View style={styles.footer}>
                <Button
                    disabled={isSaving}
                    mode="contained"
                    onPress={handleSaveUserNutrition}
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
    required: {
        color: colors.error,
    },
    segmentedButtons: {
        width: '100%',
    },
    sourceText: {
        color: colors.onSurface,
        fontSize: 16,
        paddingVertical: 8,
    },
});

export default CreateUserNutrition;
