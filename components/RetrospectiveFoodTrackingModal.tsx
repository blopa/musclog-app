import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
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

const { height: screenHeight } = Dimensions.get('window');

type NutritionItemProps = {
    colors: any;
    item: RetrospectiveNutritionData;
    t: (key: string) => string;
};

const NutritionItem: React.FC<NutritionItemProps> = ({ colors, item, t }) => (
    <View
        style={{
            backgroundColor: colors.surfaceVariant,
            borderRadius: 8,
            marginBottom: 12,
            marginHorizontal: 16,
            padding: 16,
        }}>
        <Text
            style={{
                color: colors.onSurface,
                fontSize: 18,
                fontWeight: 'bold',
                marginBottom: 4,
            }}>
            {item.productTitle}
        </Text>
        <Text
            style={{
                color: colors.primary,
                fontSize: 14,
                fontWeight: '600',
                marginBottom: 8,
            }}>
            {t(`meal_type_${item.mealType}`)}
        </Text>
        <View
            style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
            }}>
            <Text
                style={{
                    color: colors.onSurfaceVariant,
                    fontSize: 14,
                    marginBottom: 4,
                    marginRight: 16,
                }}>
                {t('calories')}: {Math.round(item.calories)}
            </Text>
            <Text
                style={{
                    color: colors.onSurfaceVariant,
                    fontSize: 14,
                    marginBottom: 4,
                    marginRight: 16,
                }}>
                {t('protein')}: {Math.round(item.protein)}g
            </Text>
            <Text
                style={{
                    color: colors.onSurfaceVariant,
                    fontSize: 14,
                    marginBottom: 4,
                    marginRight: 16,
                }}>
                {t('carbs')}: {Math.round(item.carbs)}g
            </Text>
            <Text
                style={{
                    color: colors.onSurfaceVariant,
                    fontSize: 14,
                    marginBottom: 4,
                    marginRight: 16,
                }}>
                {t('fat')}: {Math.round(item.fat)}g
            </Text>
        </View>
    </View>
);

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
            <View style={[styles.container, { maxHeight: screenHeight * 0.9 }]}>
                <Text style={styles.title}>
                    {showPreview
                        ? t('confirm')
                        : t('track_with_ai')
                    }
                </Text>

                {!showPreview ? (
                    <ScrollView contentContainerStyle={styles.scrollContent}>
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
                                    t('analyze')
                                )}
                            </Button>
                        </View>
                    </ScrollView>
                ) : (
                    <View style={styles.previewSection}>
                        <Text style={styles.previewDescription}>
                            {t('ai_nutrition_preview_description')}
                        </Text>

                        <View style={styles.flashListContainer}>
                            <FlashList
                                data={parsedNutrition || []}
                                estimatedItemSize={160}
                                keyExtractor={(item, index) => `nutrition-${index}`}
                                renderItem={({ item }) => (
                                    <NutritionItem
                                        colors={colors}
                                        item={item}
                                        t={t}
                                    />
                                )}
                                showsVerticalScrollIndicator={true}
                            />
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
                                    t('confirm')
                                )}
                            </Button>
                        </View>
                    </View>
                )}

                <DatePickerModal
                    onChangeDate={handleDateSelect}
                    onClose={() => setDatePickerVisible(false)}
                    selectedDate={selectedDate}
                    visible={datePickerVisible}
                />
            </View>
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
            flex: 1,
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
        flashListContainer: {
            flex: 1,
            minHeight: 200,
        },
        label: {
            color: colors.onSurface,
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 8,
        },

        previewDescription: {
            color: colors.onSurfaceVariant,
            fontSize: 16,
            marginBottom: 20,
            textAlign: 'center',
        },
        previewSection: {
            flex: 1,
        },
        scrollContent: {
            flexGrow: 1,
            paddingBottom: 20,
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
