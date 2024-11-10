import CompletionModal from '@/components/CompletionModal';
import CustomTextInput from '@/components/CustomTextInput';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { formatFloatNumericInputText } from '@/utils/string';
import { NavigationProp } from '@react-navigation/native';
import fetch from 'isomorphic-fetch';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { Appbar, Button, Text, useTheme } from 'react-native-paper';

import form from '../data/form.json';

const GOOGLE_FORMS_URL = 'https://docs.google.com/forms/d';

const HIDDEN_FIELDS = ['data_id', 'created_at', 'deleted_at'];

const CreateFood = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Initialize form state based on fields from form.json
    const initialFormState = form.fields.reduce((acc, field) => {
        acc[field.id] = '';
        return acc;
    }, {} as { [key: string]: string });

    const [formData, setFormData] = useState(initialFormState);

    const handleModalClose = useCallback(() => {
        setIsModalVisible(false);
        navigation.navigate('listExercises');
    }, [navigation]);

    // Update the form data on text input change
    const handleInputChange = (id: string, value: string) => {
        setFormData((prevData) => ({
            ...prevData,
            [id]: value,
        }));
    };

    const resetScreenData = useCallback(() => {
        setFormData(initialFormState);
        setIsModalVisible(false);
    }, [initialFormState]);

    const formatQuestionName = (id: string) => `entry.${id}`;

    const submitForm = async () => {
        setIsSaving(true);

        const urlParams = new URLSearchParams();
        Object.keys(formData).forEach((key) => {
            if (formData[key]) {
                urlParams.append(formatQuestionName(key), formData[key]);
            }
        });

        try {
            fetch(
                `${GOOGLE_FORMS_URL}/${form.action}/formResponse?${urlParams.toString()}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    ...Platform.OS === 'web' ? { mode: 'no-cors' } : {},
                }
            ).then(() => {
                console.log('Request done');
            });

            setIsModalVisible(true);
        } catch (error) {
            console.error('Failed to submit to Google Forms', error);
            Alert.alert(t('error'), t('failed_to_submit_form'));
        } finally {
            setIsSaving(false);
        }
    };

    const numericFields = [
        'calories',
        'total_carbohydrate',
        'total_fat',
        'protein',
        'alcohol',
        'fiber',
        'sugar',
    ];

    return (
        <View style={styles.container}>
            <CompletionModal
                buttonText={t('ok')}
                isModalVisible={isModalVisible}
                onClose={handleModalClose}
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
                        navigation.navigate('listExercises');
                    }}
                    textColor={colors.onPrimary}
                >
                    {t('cancel')}
                </Button>
            </Appbar.Header>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {form.fields
                    .filter((field) => !HIDDEN_FIELDS.includes(field.label))
                    .map((field) => {
                        const isNumericField = numericFields.includes(field.label);

                        return (
                            <View key={field.id} style={styles.formGroup}>
                                <Text style={styles.label}>
                                    {t(field.label)} {field.required ? <Text style={styles.required}>*</Text> : null}
                                </Text>
                                <CustomTextInput
                                    keyboardType={isNumericField ? 'numeric' : 'default'}
                                    onChangeText={(text) => {
                                        const formattedText = isNumericField ? formatFloatNumericInputText(text) : text;
                                        if (formattedText) {
                                            handleInputChange(field.id, formattedText);
                                        }
                                    }}
                                    placeholder={t(field.label)}
                                    value={formData[field.id]}
                                />
                            </View>
                        );
                    })}
            </ScrollView>
            <View style={styles.footer}>
                <Button
                    disabled={isSaving}
                    mode="contained"
                    onPress={submitForm}
                    style={styles.button}
                >
                    {t('submit')}
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
