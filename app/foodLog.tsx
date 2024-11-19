import type { BarcodeScanningResult } from 'expo-camera';

import FoodTrackingModal, { FoodTrackingType } from '@/components/FoodTrackingModal';
import ThemedCard from '@/components/ThemedCard';
import { MEAL_TYPE } from '@/constants/nutrition';
import { AI_SETTINGS_TYPE } from '@/constants/storage';
import { useSettings } from '@/storage/SettingsContext';
import { estimateNutritionFromPhoto, extractMacrosFromLabelPhoto, getAiApiVendor } from '@/utils/ai';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { normalizeMacrosByGrams } from '@/utils/data';
import { getLatestFitnessGoals, getUserNutritionBetweenDates } from '@/utils/database';
import { fetchProductByEAN } from '@/utils/fetchFoodData';
import { safeToFixed } from '@/utils/string';
import { FitnessGoalsReturnType, UserNutritionDecryptedReturnType } from '@/utils/types';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Platform, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import { Appbar, TextInput, Button, Text, useTheme, Card, SegmentedButtons } from 'react-native-paper';
import { TabView, TabBar } from 'react-native-tab-view';

const FoodLog = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [isLoading, setIsLoading] = useState(false);
    const [index, setIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [consumed, setConsumed] = useState({
        calories: 0,
        protein: 0,
        carbohydrate: 0,
        fat: 0,
    });
    const [consumedFoods, setConsumedFoods] = useState<UserNutritionDecryptedReturnType[]>([]);

    const [routes] = useState([
        { key: 'overview', title: t('overview') },
        { key: 'meals', title: t('tracked') },
    ]);

    // New state variables for camera permission and barcode scanning
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [showBarcodeCamera, setShowBarcodeCamera] = useState(false);
    const [showPhotoCamera, setShowPhotoCamera] = useState(false);
    const [isAiEnabled, setIsAiEnabled] = useState<boolean>(false);

    // Reference to the photo camera
    const photoCameraRef = useRef(null);

    const [selectedFood, setSelectedFood] = useState<FoodTrackingType | null>(null);
    const [userNutritionId, setUserNutritionId] = useState<number | null>(null);
    const [isNutritionModalVisible, setIsNutritionModalVisible] = useState<boolean>(false);
    const [photoMode, setPhotoMode] = useState<string>('meal');
    const [dailyGoals, setDailyGoals] = useState<Omit<FitnessGoalsReturnType, 'id'>>({
        calories: 2500,
        totalCarbohydrate: 300,
        totalFat: 80,
        protein: 150,
    });

    const { getSettingByType } = useSettings();
    const checkApiKey = useCallback(async () => {
        const vendor = await getAiApiVendor();
        const isAiSettingsEnabled = await getSettingByType(AI_SETTINGS_TYPE);

        const hasAiEnabled = Boolean(vendor) && isAiSettingsEnabled?.value === 'true';
        setIsAiEnabled(hasAiEnabled);
    }, [getSettingByType]);

    const loadLatestFitnessGoal = useCallback(async () => {
        try {
            const latestGoal = await getLatestFitnessGoals();
            if (latestGoal) {
                setDailyGoals(latestGoal);
            }
        } catch (error) {
            console.error('Failed to load latest fitness goal:', error);
        }
    }, []);

    const mealCategories = [
        { name: t('breakfast'), icon: '🍳' },
        { name: t('lunch'), icon: '🥪' },
        { name: t('dinner'), icon: '🍽️' },
        { name: t('snacks'), icon: '🍎' },
    ];

    const calculatePercentage = (consumedAmount: number, goalAmount: number) => {
        return Math.min(Math.round((consumedAmount / goalAmount) * 100), 100);
    };

    const loadConsumed = useCallback(async () => {
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        try {
            const consumedData = await getUserNutritionBetweenDates(
                startDate.toISOString(),
                endDate.toISOString()
            );

            const consumed = consumedData.reduce(
                (acc, item) => {
                    acc.calories += item.calories || 0;
                    acc.protein += item.protein || 0;
                    acc.carbohydrate += item.carbohydrate || 0;
                    acc.fat += item.fat || 0;
                    return acc;
                },
                { calories: 0, protein: 0, carbohydrate: 0, fat: 0 }
            );

            setConsumed(consumed);
            setConsumedFoods(consumedData);
        } catch (error) {
            console.error('Error loading consumed data:', error);
        }
    }, []);

    const resetScreenData = useCallback(() => {
        setSearchQuery('');
        setIndex(0);
        setConsumed({
            calories: 0,
            protein: 0,
            carbohydrate: 0,
            fat: 0,
        });
        setConsumedFoods([]);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadConsumed();
            loadLatestFitnessGoal();
            checkApiKey();

            return () => {
                resetScreenData();
            };
        }, [checkApiKey, loadConsumed, loadLatestFitnessGoal, resetScreenData])
    );

    const OverviewRoute = () => {
        const macros = [
            { name: t('calories'), consumed: safeToFixed(consumed.calories), goal: dailyGoals.calories, unit: 'kcal' },
            { name: t('proteins'), consumed: safeToFixed(consumed.protein), goal: dailyGoals.protein, unit: 'g' },
            { name: t('carbs'), consumed: safeToFixed(consumed.carbohydrate), goal: dailyGoals.totalCarbohydrate, unit: 'g' },
            { name: t('fats'), consumed: safeToFixed(consumed.fat), goal: dailyGoals.totalFat, unit: 'g' },
        ];

        return (
            <ThemedCard>
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{t('todays_progress')}</Text>
                    {macros.map((macro) => (
                        <View key={macro.name} style={styles.macroContainer}>
                            <Text style={styles.metricDetail}>
                                {macro.name}: {macro.consumed} / {macro.goal} {macro.unit}
                            </Text>
                            <View style={styles.progressBarContainer}>
                                <View
                                    style={[
                                        styles.progressBar,
                                        {
                                            width: `${calculatePercentage(parseFloat(macro.consumed), macro.goal)}%`,
                                        },
                                    ]}
                                />
                            </View>
                        </View>
                    ))}
                </View>
            </ThemedCard>
        );
    };

    const handleEditNutrition = (userNutrition: UserNutritionDecryptedReturnType) => {
        setSelectedFood({
            productTitle: userNutrition.name,
            kcal: userNutrition.calories,
            protein: userNutrition.protein,
            carbs: userNutrition.carbohydrate,
            fat: userNutrition.fat,
            grams: userNutrition.grams,
        });

        setUserNutritionId(userNutrition.id);
        setIsNutritionModalVisible(true);
    };

    const handleDeleteNutrition = (userNutrition: UserNutritionDecryptedReturnType) => {
        // TODO
    };

    const MealsRoute = () => {
        const mealGroups = consumedFoods.reduce((groups, food) => {
            const mealType = food.mealType || 'snacks';
            if (!groups[mealType]) {
                groups[mealType] = [];
            }

            groups[mealType].push(food);
            return groups;
        }, {} as { [key: string]: UserNutritionDecryptedReturnType[] });

        return (
            <ScrollView contentContainerStyle={styles.mealsContent}>
                {Object.entries(MEAL_TYPE).map(([mealTypeName, mealType]) => {
                    const userNutritions = mealGroups[mealType];
                    if (userNutritions && userNutritions.length > 0) {
                        return (
                            <View key={mealTypeName} style={styles.mealContainer}>
                                <View style={styles.mealHeader}>
                                    <Text style={styles.mealTitle}>
                                        {mealCategories.find((m) => m.name === mealTypeName)?.icon} {t(mealTypeName)}
                                    </Text>
                                </View>
                                {userNutritions.map((userNutrition, index) => (
                                    <ThemedCard key={index} style={styles.foodItem}>
                                        <Card.Content style={styles.cardContent}>
                                            <View style={styles.cardHeader}>
                                                <Text style={styles.cardTitle}>
                                                    {userNutrition.name || t('unknown_food')}
                                                </Text>
                                                <View style={styles.iconContainer}>
                                                    <TouchableOpacity onPress={() => handleEditNutrition(userNutrition)}>
                                                        <FontAwesome5 name="edit" size={20} color={colors.primary} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => handleDeleteNutrition(userNutrition)}>
                                                        <FontAwesome5 name="trash" size={20} color={colors.primary} />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                            <View style={styles.metricRow}>
                                                <Text style={styles.metricDetail}>{t('calories')}: {safeToFixed(userNutrition.calories)}kcal</Text>
                                                <Text style={styles.metricDetail}>{t('carbs')}: {safeToFixed(userNutrition.carbohydrate)}g</Text>
                                            </View>
                                            <View style={styles.metricRow}>
                                                <Text style={styles.metricDetail}>{t('fats')}: {safeToFixed(userNutrition.fat)}g</Text>
                                                <Text style={styles.metricDetail}>{t('proteins')}: {safeToFixed(userNutrition.protein)}g</Text>
                                            </View>
                                        </Card.Content>
                                    </ThemedCard>
                                ))}
                            </View>
                        );
                    } else {
                        return null;
                    }
                })}
            </ScrollView>
        );
    };

    const renderScene = ({ route }: { route: { key: string } }) => {
        switch (route.key) {
            case 'overview':
                return <OverviewRoute />;
            case 'meals':
                return <MealsRoute />;
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

    const handleBarCodeScanned = async ({ type, data }: BarcodeScanningResult) => {
        setScanned(true);
        setShowBarcodeCamera(false);

        const foodInfo = await fetchProductByEAN(data);

        if (foodInfo) {
            setSelectedFood(foodInfo);
            setIsNutritionModalVisible(true);
        }

        setScanned(false);
    };

    // Function to request camera permissions and show the barcode scanner
    const openBarcodeCamera = async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                alert(t('camera_permission_denied'));
                return;
            }
        }
        setShowBarcodeCamera(true);
    };

    // Function to request camera permissions and show the photo camera
    const openPhotoCamera = async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                alert(t('camera_permission_denied'));
                return;
            }
        }
        setShowPhotoCamera(true);
    };

    // Handler for taking a photo
    const handleTakePhoto = useCallback(async () => {
        if (photoCameraRef.current) {
            try {
                // @ts-ignore
                const photo = await (photoCameraRef.current as typeof CameraView).takePictureAsync();
                setIsLoading(true);
                setShowPhotoCamera(false);

                if (photoMode === 'meal') {
                    const macros = await estimateNutritionFromPhoto(photo.uri);
                    if (macros) {
                        setSelectedFood(normalizeMacrosByGrams({
                            productTitle: macros.name,
                            kcal: macros.calories,
                            protein: macros.protein,
                            carbs: macros.carbs,
                            fat: macros.fat,
                            grams: macros.grams,
                        }));

                        setIsNutritionModalVisible(true);
                    }
                } else {
                    const macros = await extractMacrosFromLabelPhoto(photo.uri);
                    if (macros) {
                        setSelectedFood(normalizeMacrosByGrams({
                            productTitle: macros.name,
                            kcal: macros.calories,
                            protein: macros.protein,
                            carbs: macros.carbs,
                            fat: macros.fat,
                            grams: macros.grams,
                        }));

                        setIsNutritionModalVisible(true);
                    }
                }

                setIsLoading(false);
            } catch (error) {
                console.error('Error taking photo:', error);
            }
        }
    }, [photoMode]);

    const handleFoodSearch = useCallback(() => {
        navigation.navigate('foodSearch', { initialSearchQuery: searchQuery });
    }, [navigation, searchQuery]);

    const renderScannerOverlay = useCallback(() => (
        <View style={styles.scannerOverlayContainer}>
            <View style={styles.scannerOverlayTop} />
            <View style={styles.scannerOverlayMiddle}>
                <View style={styles.scannerFocusArea}>
                    <View style={styles.focusBorder} />
                </View>
            </View>
            <View style={styles.scannerOverlayBottom} />
        </View>
    ), [styles.focusBorder, styles.scannerFocusArea, styles.scannerOverlayBottom, styles.scannerOverlayContainer, styles.scannerOverlayMiddle, styles.scannerOverlayTop]);

    const renderPhotoCameraOverlay = () => (
        <View style={styles.photoCameraOverlay}>
            <SegmentedButtons
                value={photoMode}
                onValueChange={setPhotoMode}
                buttons={[{
                    value: 'meal',
                    label: t('meal'),
                    style: { backgroundColor: photoMode === 'meal' ? colors.secondaryContainer : colors.surface },
                },
                {
                    value: 'label',
                    label: t('food_label'),
                    style: { backgroundColor: photoMode === 'label' ? colors.secondaryContainer : colors.surface },
                }]}
                style={styles.segmentedButtons}
            />
            <View style={styles.bottomControls}>
                <TouchableOpacity onPress={() => setShowPhotoCamera(false)} style={styles.photoCloseButton}>
                    <Text style={styles.photoCloseText}>{t('close')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleTakePhoto} style={styles.captureButton}>
                    <FontAwesome5 name="camera" size={30} color={colors.primary} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Appbar.Header mode="small" statusBarHeight={0} style={styles.appbarHeader}>
                <Appbar.Content title={t('macro_tracker')} titleStyle={styles.appbarTitle} />
            </Appbar.Header>
            <View style={styles.content}>
                <View style={styles.searchContainer}>
                    <TextInput
                        placeholder={t('search_food')}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={styles.searchInput}
                        mode="outlined"
                    />
                    {searchQuery ? (
                        <Button
                            mode="outlined"
                            onPress={handleFoodSearch}
                            style={styles.iconButton}
                        >
                            <FontAwesome5 name="search" size={20} color={colors.primary} />
                        </Button>
                    ) : (
                        <>
                            <Button
                                mode="outlined"
                                onPress={openBarcodeCamera}
                                style={styles.iconButton}
                            >
                                <FontAwesome5 name="barcode" size={20} color={colors.primary} />
                            </Button>
                            {isAiEnabled ? (
                                <Button
                                    mode="outlined"
                                    onPress={openPhotoCamera}
                                    style={styles.iconButton}
                                >
                                    <FontAwesome5 name="camera" size={20} color={colors.primary} />
                                </Button>
                            ) : null}
                        </>
                    )}
                </View>
                <TabView
                    navigationState={{ index, routes }}
                    renderScene={renderScene}
                    renderTabBar={renderTabBar}
                    onIndexChange={setIndex}
                    initialLayout={{ width: Dimensions.get('window').width }}
                />
            </View>
            {showBarcodeCamera && (
                <View style={styles.cameraContainer}>
                    <CameraView
                        style={styles.camera}
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        ratio="16:9"
                    >
                        {renderScannerOverlay()}
                        <View style={styles.cameraOverlay}>
                            <Button
                                mode="contained"
                                onPress={() => setShowBarcodeCamera(false)}
                                style={styles.closeButton}
                            >
                                {t('close')}
                            </Button>
                        </View>
                    </CameraView>
                </View>
            )}
            {showPhotoCamera && (
                <View style={styles.cameraContainer}>
                    <CameraView
                        style={styles.camera}
                        ref={photoCameraRef}
                    >
                        {renderPhotoCameraOverlay()}
                    </CameraView>
                </View>
            )}
            <FoodTrackingModal
                visible={isNutritionModalVisible}
                onClose={() => {
                    setIsNutritionModalVisible(false);
                    setSelectedFood(null);
                    loadConsumed();
                }}
                food={selectedFood}
                userNutritionId={userNutritionId}
                isLoading={isLoading}
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
    bottomControls: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    camera: {
        flex: 1,
    },
    cameraContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'black',
        justifyContent: 'center',
    },
    cameraOverlay: {
        alignItems: 'flex-end',
        backgroundColor: 'transparent',
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        paddingBottom: 40,
    },
    captureButton: {
        backgroundColor: 'transparent',
    },
    cardContent: {
        padding: 16,
    },
    cardHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    cardTitle: {
        color: colors.onSurface,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    closeButton: {
        backgroundColor: colors.primary,
        padding: 8,
    },
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    focusBorder: {
        borderColor: colors.primary,
        borderRadius: 8,
        borderWidth: 2,
        height: '100%',
        width: '100%',
    },
    foodDetails: {
        color: colors.onSurfaceVariant,
        fontSize: 12,
    },
    foodItem: {
        backgroundColor: colors.surface,
        borderColor: colors.primary,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
        padding: 8,
    },
    foodName: {
        color: colors.onSurface,
        fontSize: 14,
        fontWeight: 'bold',
    },
    iconButton: {
        marginLeft: 4,
    },
    iconContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    macroContainer: {
        marginBottom: 12,
    },
    mealContainer: {
        borderColor: colors.primary,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 16,
        padding: 8,
    },
    mealHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    mealTitle: {
        color: colors.onSurface,
        fontSize: 16,
        fontWeight: '600',
    },
    mealsContent: {
        padding: 16,
    },
    metricDetail: {
        color: colors.onSurface,
        fontSize: 14,
        marginBottom: 4,
    },
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    photoCameraOverlay: {
        flex: 1,
        justifyContent: 'space-between',
    },
    photoCloseButton: {
        backgroundColor: colors.primary,
        borderRadius: 5,
        padding: 10,
    },
    photoCloseText: {
        color: colors.onPrimary,
        fontSize: 16,
    },
    progressBar: {
        backgroundColor: colors.primary,
        height: '100%',
    },
    progressBarContainer: {
        backgroundColor: colors.surfaceVariant,
        borderRadius: 4,
        height: 10,
        overflow: 'hidden',
    },
    scannerFocusArea: {
        backgroundColor: 'transparent',
        borderRadius: 8,
        height: '50%',
        overflow: 'hidden',
        width: Dimensions.get('window').width - 20,
    },
    scannerOverlayBottom: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        bottom: 0,
        // height: (Dimensions.get('window').height / 2) - 135,
        height: '35%',
        position: 'absolute',
        width: '100%',
    },
    scannerOverlayContainer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scannerOverlayMiddle: {
        alignItems: 'center',
        flexDirection: 'row',
    },
    scannerOverlayTop: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        // height: (Dimensions.get('window').height / 2) - 135,
        height: '35%',
        position: 'absolute',
        top: 0,
        width: '100%',
    },
    searchContainer: {
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: 16,
    },
    searchInput: {
        backgroundColor: colors.surface,
        flex: 1,
        marginRight: 8,
    },
    segmentedButtons: {
        alignSelf: 'center',
        backgroundColor: 'transparent',
        borderRadius: 8,
        marginTop: 16,
        paddingVertical: 8,
        width: '90%',
    },
});

export default FoodLog;
