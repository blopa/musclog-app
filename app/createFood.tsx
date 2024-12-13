import CompletionModal from '@/components/CompletionModal';
import CustomTextInput from '@/components/CustomTextInput';
import { Screen } from '@/components/Screen';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { addFood } from '@/utils/database';
import { getCurrentTimestampISOString } from '@/utils/date';
import { updateRecentFood } from '@/utils/storage';
import { formatFloatNumericInputText, generateHash } from '@/utils/string';
import { GoogleFormFoodFoodLabelType } from '@/utils/types';
import { NavigationProp, useRoute } from '@react-navigation/native';
// import fetch from 'isomorphic-fetch';
import { fetch } from 'expo/fetch';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Checkbox, Text, useTheme } from 'react-native-paper';

import form from '../data/foodForm.json';

const GOOGLE_FORMS_URL = 'https://docs.google.com/forms/d';

const HIDDEN_FIELDS = ['data_id', 'created_at', 'deleted_at'] as GoogleFormFoodFoodLabelType[];

type RouteParams = {
    foodName?: string;
};

const CreateFood = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const route = useRoute();
    const { foodName = '' } = (route.params as RouteParams) || {};
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [foodId, setFoodId] = useState<number | undefined>(undefined);
    const [isFavoriteFood, setIsFavoriteFood] = useState<boolean>(false);

    // Initialize form state based on fields from form.json
    const initialFormState = form.fields.reduce((acc, field) => {
        acc[field.id] = '';
        return acc;
    }, {} as { [key: string]: string });

    const [formData, setFormData] = useState(initialFormState);

    const handleCloseConfirmationModal = useCallback(() => {
        setIsModalVisible(false);
        navigation.navigate('foodSearch', { foodId });
    }, [foodId, navigation]);

    useEffect(() => {
        if (foodName) {
            setFormData((prevData) => ({
                ...prevData,
                [form.fields.find((f) => f.label === 'name')?.id || '']: foodName,
            }));
        }
    }, [foodName]);

    // Update the form data on text input change
    const handleInputChange = useCallback((id: string, value: string) => {
        setFormData((prevData) => ({
            ...prevData,
            [id]: value,
        }));
    }, []);

    const resetScreenData = useCallback(() => {
        setFormData(initialFormState);
        setIsModalVisible(false);
    }, [initialFormState]);

    const formatQuestionName = (id: string) => `entry.${id}`;

    const handleSubmitForm = useCallback(async () => {
        setIsSaving(true);

        const urlParams = new URLSearchParams();
        Object.keys(formData).forEach((key) => {
            if (formData[key]) {
                urlParams.append(formatQuestionName(key), formData[key]);
            }
        });

        HIDDEN_FIELDS.forEach((field: GoogleFormFoodFoodLabelType) => {
            const id = form.fields.find((f) => f.label === field)?.id;

            if (id) {
                if (field === 'data_id') {
                    urlParams.append(formatQuestionName(id), generateHash());
                } else if (field === 'created_at') {
                    urlParams.append(formatQuestionName(id), getCurrentTimestampISOString());
                }
            }
        });

        const food = {
            alcohol: parseInt(urlParams.get('entry.1665963898') || '0', 10),
            biotin: parseFloat(urlParams.get('entry.1257288602') || '0'),
            brand: urlParams.get('entry.825388453') || '',
            caffeine: parseFloat(urlParams.get('entry.1688892088') || '0'),
            calcium: parseFloat(urlParams.get('entry.995973121') || '0'),
            calories: parseInt(urlParams.get('entry.1848808507') || '0', 10),
            chloride: parseFloat(urlParams.get('entry.946753782') || '0'),
            cholesterol: parseFloat(urlParams.get('entry.1733386302') || '0'),
            chromium: parseFloat(urlParams.get('entry.281656146') || '0'),
            copper: parseFloat(urlParams.get('entry.1049396127') || '0'),
            createdAt: urlParams.get('entry.1917240265') || getCurrentTimestampISOString(),
            dataId: urlParams.get('entry.1025747995') || generateHash(),
            fiber: parseInt(urlParams.get('entry.1039537292') || '0', 10),
            folate: parseFloat(urlParams.get('entry.1243452339') || '0'),
            folicAcid: parseFloat(urlParams.get('entry.670035765') || '0'),
            iodine: parseFloat(urlParams.get('entry.1072580240') || '0'),
            iron: parseFloat(urlParams.get('entry.1648646017') || '0'),
            isFavorite: isFavoriteFood,
            magnesium: parseFloat(urlParams.get('entry.1120455816') || '0'),
            manganese: parseFloat(urlParams.get('entry.681293427') || '0'),
            molybdenum: parseFloat(urlParams.get('entry.1402996') || '0'),
            monounsaturatedFat: parseFloat(urlParams.get('entry.2003052366') || '0'),
            name: urlParams.get('entry.1515281433') || t('unnamed'),
            niacin: parseFloat(urlParams.get('entry.396501138') || '0'),
            pantothenicAcid: parseFloat(urlParams.get('entry.1055614332') || '0'),
            phosphorus: parseFloat(urlParams.get('entry.555762242') || '0'),
            polyunsaturatedFat: parseFloat(urlParams.get('entry.1663928689') || '0'),
            potassium: parseFloat(urlParams.get('entry.22311928') || '0'),
            productCode: urlParams.get('entry.589875398') || '',
            protein: parseInt(urlParams.get('entry.1811363356') || '0', 10),
            riboflavin: parseFloat(urlParams.get('entry.281566105') || '0'),
            saturatedFat: parseFloat(urlParams.get('entry.1321812725') || '0'),
            selenium: parseFloat(urlParams.get('entry.630251394') || '0'),
            servingSize: parseFloat(urlParams.get('entry.422897572') || '0'),
            sodium: parseFloat(urlParams.get('entry.1491871504') || '0'),
            sugar: parseInt(urlParams.get('entry.231759517') || '0', 10),
            thiamin: parseFloat(urlParams.get('entry.1862464253') || '0'),
            totalCarbohydrate: parseInt(urlParams.get('entry.919411420') || '0', 10),
            totalFat: parseInt(urlParams.get('entry.2114676271') || '0', 10),
            transFat: parseFloat(urlParams.get('entry.648448017') || '0'),
            unsaturatedFat: parseFloat(urlParams.get('entry.538006077') || '0'),
            vitaminA: parseFloat(urlParams.get('entry.1285896543') || '0'),
            vitaminB6: parseFloat(urlParams.get('entry.1650599429') || '0'),
            vitaminB12: parseFloat(urlParams.get('entry.994462403') || '0'),
            vitaminC: parseFloat(urlParams.get('entry.636273284') || '0'),
            vitaminD: parseFloat(urlParams.get('entry.1168816410') || '0'),
            vitaminE: parseFloat(urlParams.get('entry.1412584634') || '0'),
            vitaminK: parseFloat(urlParams.get('entry.446901229') || '0'),
            zinc: parseFloat(urlParams.get('entry.19181913') || '0'),
        };

        const foodId = await addFood(food);
        await updateRecentFood(foodId);

        // only set the food id if the user came
        // from the food search screen
        if (foodName) {
            setFoodId(foodId);
        }

        try {
            fetch(
                `${GOOGLE_FORMS_URL}/${form.action}/formResponse?${urlParams.toString()}`,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    method: 'GET',
                    ...Platform.OS === 'web' ? { mode: 'no-cors' } : {},
                }
            ).finally(() => {
                console.log('Request done');
            }).catch((error) => {
                console.error('Failed to submit to Google Forms', error);
                Alert.alert(t('error'), t('failed_to_submit_form'));
            });

            setIsModalVisible(true);
        } catch (error) {
            console.error('Failed to submit to Google Forms', error);
            Alert.alert(t('error'), t('failed_to_submit_form'));
        } finally {
            setIsSaving(false);
        }
    }, [foodName, formData, isFavoriteFood, t]);

    const textFields = [
        'name',
        'product_code',
        'brand',
    ] as GoogleFormFoodFoodLabelType[];

    return (
        <Screen style={styles.container}>
            <CompletionModal
                buttonText={t('ok')}
                isModalVisible={isModalVisible}
                onClose={handleCloseConfirmationModal}
                title={t('form_submitted_successfully')}
            />
            <Appbar.Header
                mode="small"
                statusBarHeight={0}
                style={styles.appbarHeader}
            >
                <Appbar.Content
                    title={t('create_food')}
                    titleStyle={styles.appbarTitle}
                />
                <Button
                    mode="outlined"
                    onPress={() => {
                        resetScreenData();
                        navigation.navigate('foodSearch');
                    }}
                    textColor={colors.onPrimary}
                >
                    {t('cancel')}
                </Button>
            </Appbar.Header>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {form.fields
                    .filter((field) => !HIDDEN_FIELDS.includes(field.label as GoogleFormFoodFoodLabelType))
                    .map((field) => {
                        const isNumericField = !textFields.includes(field.label as GoogleFormFoodFoodLabelType);

                        return (
                            <View key={field.id} style={styles.formGroup}>
                                <Text style={styles.label}>
                                    {t(`google_form.${field.label}`)} {field.required ? <Text style={styles.required}>*</Text> : null}
                                </Text>
                                <CustomTextInput
                                    keyboardType={isNumericField ? 'numeric' : 'default'}
                                    onChangeText={(text) => {
                                        const formattedText = isNumericField ? formatFloatNumericInputText(text) : text;
                                        if (formattedText) {
                                            handleInputChange(field.id, formattedText);
                                        }
                                    }}
                                    placeholder={t(`google_form.${field.label}`)}
                                    value={formData[field.id]}
                                />
                            </View>
                        );
                    })}
                <View style={styles.checkboxContainer}>
                    <Checkbox
                        onPress={() => setIsFavoriteFood(!isFavoriteFood)}
                        status={isFavoriteFood ? 'checked' : 'unchecked'}
                    />
                    <Pressable
                        onPress={() => setIsFavoriteFood(!isFavoriteFood)}
                    >
                        <Text style={styles.checkboxLabel}>
                            {t('favorite')}
                        </Text>
                    </Pressable>
                </View>
            </ScrollView>
            <View style={styles.footer}>
                <Button
                    disabled={isSaving}
                    mode="contained"
                    onPress={handleSubmitForm}
                    style={styles.button}
                >
                    {t('submit')}
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
    checkboxContainer: {
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: 12,
        marginTop: 12,
    },
    checkboxLabel: {
        color: colors.onBackground,
        fontSize: 16,
        marginLeft: 8,
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
});

export default CreateFood;
