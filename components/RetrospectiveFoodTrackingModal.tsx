import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput, useTheme } from 'react-native-paper';

import DatePickerModal from '@/components/DatePickerModal';
import ThemedModal from '@/components/ThemedModal';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { formatDate } from '@/utils/date';

export type RetrospectiveNutritionData = {
    calories: number;
    carbs: number;
    date: string;
    fat: number;
    fiber: number;
    mealType: number;
    productTitle: string;
    protein: number;
    sodium: number;
    sugar: number;
};

type RetrospectiveFoodTrackingModalProps = {
    isLoading?: boolean;
    onClose: () => void;
    onConfirm: (nutritionData: RetrospectiveNutritionData[]) => Promise<void>;
    onSubmit: (data: {
        date: string;
        description: string;
    }) => Promise<RetrospectiveNutritionData[]>;
    visible: boolean;
};

const RetrospectiveFoodTrackingModal: React.FC<RetrospectiveFoodTrackingModalProps> = ({
    isLoading = false,
    onClose,
    onConfirm,
    onSubmit,
    visible,
}) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    const [description, setDescription] = useState('');
    const [parsedNutrition, setParsedNutrition] = useState<null | RetrospectiveNutritionData[]>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const handleDateSelect = useCallback((date: Date) => {
        setSelectedDate(date);
        setDatePickerVisible(false);
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!description.trim()) {
            return;
        }

        setIsProcessing(true);
        try {
            const result = await onSubmit({
                date: selectedDate.toISOString(),
                description: description.trim(),
            });
            setParsedNutrition(result);
            setShowPreview(true);
        } catch (error) {
            console.error('Error processing retrospective nutrition:', error);
        } finally {
            setIsProcessing(false);
        }
    }, [description, selectedDate, onSubmit]);

    const handleConfirm = useCallback(async () => {
        if (!parsedNutrition) {return;}

        setIsProcessing(true);
        try {
            await onConfirm(parsedNutrition);
            // Reset state
            setDescription('');
            setParsedNutrition(null);
            setShowPreview(false);
            onClose();
        } catch (error) {
            console.error('Error saving retrospective nutrition:', error);
        } finally {
            setIsProcessing(false);
        }
    }, [parsedNutrition, onConfirm, onClose]);

    const handleBack = useCallback(() => {
        setShowPreview(false);
        setParsedNutrition(null);
    }, []);

    const handleCloseModal = useCallback(() => {
        setDescription('');
        setParsedNutrition(null);
        setShowPreview(false);
        onClose();
    }, [onClose]);

    return (
        <ThemedModal onClose={handleCloseModal} visible={visible}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>
                    {showPreview
                        ? t('confirm_ai_nutrition_tracking')
                        : t('retrospective_food_tracking_title')
                    }
                </Text>

                {!showPreview ? (
                    <>
                        <Text style={styles.description}>
                            {t('retrospective_food_tracking_description')}
                        </Text>

                        <View style={styles.section}>
                            <Text style={styles.label}>{t('date')}</Text>
                            <Button
                                mode="outlined"
                                onPress={() => setDatePickerVisible(true)}
                                style={styles.dateButton}
                            >
                                {formatDate(selectedDate.toISOString(), 'dd/MM/yyyy')}
                            </Button>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.label}>{t('food_description')}</Text>
                            <TextInput
                                mode="outlined"
                                multiline
                                numberOfLines={6}
                                onChangeText={setDescription}
                                placeholder={t('retrospective_food_tracking_placeholder')}
                                style={styles.textArea}
                                value={description}
                            />
                        </View>

                        <View style={styles.buttonContainer}>
                            <Button
                                mode="outlined"
                                onPress={handleCloseModal}
                                style={styles.cancelButton}
                            >
                                {t('cancel')}
                            </Button>
                            <Button
                                disabled={!description.trim() || isProcessing}
                                mode="contained"
                                onPress={handleSubmit}
                                style={styles.submitButton}
                            >
                                {isProcessing ? (
                                    <ActivityIndicator color={colors.onPrimary} size="small" />
                                ) : (
                                    t('analyze_with_ai')
                                )}
                            </Button>
                        </View>
                    </>
                ) : (
                    <>
                        <Text style={styles.previewDescription}>
                            {t('ai_nutrition_preview_description')}
                        </Text>

                        <View style={styles.previewContainer}>
                            {parsedNutrition?.map((item, index) => (
                                <View key={index} style={styles.nutritionItem}>
                                    <Text style={styles.nutritionTitle}>{item.productTitle}</Text>
                                    <Text style={styles.nutritionMealType}>
                                        {t(`meal_type_${item.mealType}`)}
                                    </Text>
                                    <View style={styles.macroContainer}>
                                        <Text style={styles.macroText}>
                                            {t('calories')}: {Math.round(item.calories)}
                                        </Text>
                                        <Text style={styles.macroText}>
                                            {t('protein')}: {Math.round(item.protein)}g
                                        </Text>
                                        <Text style={styles.macroText}>
                                            {t('carbs')}: {Math.round(item.carbs)}g
                                        </Text>
                                        <Text style={styles.macroText}>
                                            {t('fat')}: {Math.round(item.fat)}g
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>

                        <View style={styles.buttonContainer}>
                            <Button
                                mode="outlined"
                                onPress={handleBack}
                                style={styles.cancelButton}
                            >
                                {t('back')}
                            </Button>
                            <Button
                                disabled={isProcessing}
                                mode="contained"
                                onPress={handleConfirm}
                                style={styles.submitButton}
                            >
                                {isProcessing ? (
                                    <ActivityIndicator color={colors.onPrimary} size="small" />
                                ) : (
                                    t('confirm_and_save')
                                )}
                            </Button>
                        </View>
                    </>
                )}

                <DatePickerModal
                    onChangeDate={handleDateSelect}
                    onClose={() => setDatePickerVisible(false)}
                    selectedDate={selectedDate}
                    visible={datePickerVisible}
                />
            </ScrollView>
        </ThemedModal>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) =>
    StyleSheet.create({
        buttonContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 24,
        },
        cancelButton: {
            flex: 1,
            marginRight: 8,
        },
        container: {
            minHeight: 400,
            padding: 20,
        },
        dateButton: {
            marginBottom: 8,
        },
        description: {
            color: colors.onSurfaceVariant,
            fontSize: 16,
            lineHeight: 22,
            marginBottom: 24,
            textAlign: 'center',
        },
        label: {
            color: colors.onSurface,
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 8,
        },
        macroContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
        },
        macroText: {
            color: colors.onSurfaceVariant,
            fontSize: 14,
            marginBottom: 4,
            marginRight: 16,
        },
        nutritionItem: {
            backgroundColor: colors.surfaceVariant,
            borderRadius: 8,
            marginBottom: 12,
            padding: 16,
        },
        nutritionMealType: {
            color: colors.primary,
            fontSize: 14,
            fontWeight: '600',
            marginBottom: 8,
        },
        nutritionTitle: {
            color: colors.onSurface,
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: 4,
        },
        previewContainer: {
            marginBottom: 20,
        },
        previewDescription: {
            color: colors.onSurfaceVariant,
            fontSize: 16,
            marginBottom: 20,
            textAlign: 'center',
        },
        section: {
            marginBottom: 20,
        },
        submitButton: {
            flex: 1,
            marginLeft: 8,
        },
        textArea: {
            minHeight: 120,
            textAlignVertical: 'top',
        },
        title: {
            color: colors.onSurface,
            fontSize: 24,
            fontWeight: 'bold',
            marginBottom: 16,
            textAlign: 'center',
        },
    });

export default RetrospectiveFoodTrackingModal;
