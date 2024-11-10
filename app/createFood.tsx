import type { GoogleForm, UseGoogleFormReturn } from 'react-google-forms-hooks';

import CompletionModal from '@/components/CompletionModal';
import CustomTextInput from '@/components/CustomTextInput';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { formatFloatNumericInputText } from '@/utils/string';
import { NavigationProp } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { useShortAnswerInput , useGoogleForm, GoogleFormProvider } from 'react-google-forms-hooks';
import { useTranslation } from 'react-i18next';
import { View, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { Appbar, Button, Text, useTheme } from 'react-native-paper';

import form from '../data/form.json';

type CreateFoodProps = {
    navigation: NavigationProp<any>;
};

const CreateFood: React.FC<CreateFoodProps> = ({ navigation }) => {
    const methods = useGoogleForm({ form: form as unknown as GoogleForm });
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleModalClose = useCallback(() => {
        setIsModalVisible(false);
        navigation.goBack();
    }, [navigation]);

    const onSubmit = async (data: any) => {
        setIsSaving(true);
        try {
            await methods.submitToGoogleForms(data);
            setIsModalVisible(true);
        } catch (error) {
            console.error('Failed to submit to Google Forms', error);
            Alert.alert(t('error'), t('failed_to_submit_form'));
        } finally {
            setIsSaving(false);
        }
    };

    const fields = (form as unknown as GoogleForm).fields.sort(
        (a, b) => (form as unknown as GoogleForm).fieldsOrder[a.id.toString()] - (form as unknown as GoogleForm).fieldsOrder[b.id.toString()]
    );

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
        <GoogleFormProvider {...methods}>
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
                        onPress={() => navigation.goBack()}
                        textColor={colors.onPrimary}
                    >
                        {t('cancel')}
                    </Button>
                </Appbar.Header>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    {fields.map((field) => (
                        <FormField
                            key={field.id}
                            field={field}
                            isNumeric={numericFields.includes(field.label)}
                            methods={methods}
                        />
                    ))}
                </ScrollView>
                <View style={styles.footer}>
                    <Button
                        disabled={isSaving}
                        mode="contained"
                        onPress={methods.handleSubmit(onSubmit)}
                        style={styles.button}
                    >
                        {t('submit')}
                    </Button>
                </View>
            </View>
        </GoogleFormProvider>
    );
};

const FormField = ({
    field,
    isNumeric,
    methods,
}: {
    field: GoogleForm['fields'][number];
    isNumeric: boolean;
    methods: UseGoogleFormReturn;
}) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { register, label } = useShortAnswerInput(field.id);

    const value = methods.watch(register().name);

    return (
        <View style={styles.formGroup}>
            <Text style={styles.label}>
                {t(field.label)} {field.required ? <Text style={styles.required}>*</Text> : null}
            </Text>
            <CustomTextInput
                keyboardType={isNumeric ? 'numeric' : 'default'}
                onChangeText={(text) => {
                    const formattedText = isNumeric ? formatFloatNumericInputText(text) : text;
                    methods.setValue(register().name, formattedText);
                }}
                placeholder={t(field.label)}
                value={value}
            />
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
