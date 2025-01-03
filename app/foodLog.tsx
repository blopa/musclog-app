import type { BarcodeScanningResult } from 'expo-camera';

import ArrowedDatePicker from '@/components/ArrowedDatePicker';
import FABWrapper from '@/components/FABWrapper';
import FoodItem from '@/components/FoodItem';
import FoodTrackingModal, { FoodTrackingType } from '@/components/FoodTrackingModal';
import NutritionProgressBanner from '@/components/NutritionProgressBanner';
import { Screen } from '@/components/Screen';
import SearchFoodModal from '@/components/SearchFoodModal';
import ThemedCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import { MEAL_TYPE } from '@/constants/nutrition';
import { AI_SETTINGS_TYPE, GRAMS, IMPERIAL_SYSTEM, OUNCES } from '@/constants/storage';
import { FAB_ICON_SIZE } from '@/constants/ui';
import useUnit from '@/hooks/useUnit';
import { useHealthConnect } from '@/storage/HealthConnectProvider';
import { useSettings } from '@/storage/SettingsContext';
import { estimateNutritionFromPhoto, extractMacrosFromLabelPhoto, getAiApiVendor } from '@/utils/ai';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { normalizeMacrosByGrams } from '@/utils/data';
import {
    deleteUserNutrition,
    getAllFavoriteFoods,
    getAllFoodsByIds,
    getUserNutritionBetweenDates,
} from '@/utils/database';
import {
    formatDate,
    getCurrentTimestampISOString,
    getDaysAgoTimestampISOString,
    getEndOfDayTimestampISOString,
    getStartOfDayTimestampISOString,
} from '@/utils/date';
import { fetchProductByEAN } from '@/utils/fetchFoodData';
import { syncHealthConnectData } from '@/utils/healthConnect';
import { getRecentFood } from '@/utils/storage';
import { safeToFixed } from '@/utils/string';
import { MusclogApiFoodInfoType, UserNutritionDecryptedReturnType } from '@/utils/types';
import { getDisplayFormattedWeight } from '@/utils/unit';
import Quagga from '@ericblade/quagga2';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dimensions,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { BarcodeFormat, detectBarcodes } from 'react-native-barcodes-detector';
import { Appbar, Button, Card, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { TabBar, TabView } from 'react-native-tab-view';

const FoodLog = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [isLoading, setIsLoading] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [selectedNutrition, setSelectedNutrition] = useState<null | UserNutritionDecryptedReturnType>(null);
    const { checkReadIsPermitted, checkWriteIsPermitted, insertHealthData } = useHealthConnect();

    const [tabIndex, setTabIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [consumedFoods, setConsumedFoods] = useState<UserNutritionDecryptedReturnType[]>([]);
    const [preSelectedMealType, setPreSelectedMealType] = useState('0');
    const [foodSearchModalVisible, setFoodSearchModalVisible] = useState(false);

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
    const [allowEditName, setAllowEditName] = useState<boolean>(false);

    // Reference to the photo camera
    const photoCameraRef = useRef(null);

    const [selectedFood, setSelectedFood] = useState<FoodTrackingType | null>(null);
    const [userNutritionId, setUserNutritionId] = useState<null | number>(null);
    const [isNutritionModalVisible, setIsNutritionModalVisible] = useState<boolean>(false);
    const [photoMode, setPhotoMode] = useState<string>('meal');

    const [recentTrackedFoods, setRecentTrackedFoods] = useState<(MusclogApiFoodInfoType & {id: number})[]>([]);
    const [favoriteFoods, setFavoriteFoods] = useState<(MusclogApiFoodInfoType & {id: number})[]>([]);
    const [foodHistoryType, setFoodHistoryType] = useState('recent');
    const foodHistory = foodHistoryType === 'recent' ? recentTrackedFoods : favoriteFoods;

    const [selectedDate, setSelectedDate] = useState(new Date());

    const [consumed, setConsumed] = useState({
        calories: 0,
        carbohydrate: 0,
        fat: 0,
        protein: 0,
    });

    const { unitSystem } = useUnit();
    const isImperial = unitSystem === IMPERIAL_SYSTEM;
    const macroUnit = isImperial ? OUNCES : GRAMS;

    const { getSettingByType } = useSettings();
    const checkApiKey = useCallback(async () => {
        const vendor = await getAiApiVendor();
        const isAiSettingsEnabled = await getSettingByType(AI_SETTINGS_TYPE);

        const hasAiEnabled = Boolean(vendor) && isAiSettingsEnabled?.value === 'true';
        setIsAiEnabled(hasAiEnabled);
    }, [getSettingByType]);

    const handleOnFoodSelected = useCallback((food: FoodTrackingType) => {
        setSelectedFood(food);
        setIsNutritionModalVisible(true);
    }, []);

    const mealCategories = useMemo(() => [
        { icon: '🍳', name: t('breakfast') },
        { icon: '🥪', name: t('lunch') },
        { icon: '🍽️', name: t('dinner') },
        { icon: '🍎', name: t('snacks') },
    ], [t]);

    const loadConsumed = useCallback(async (date?: Date) => {
        const currentDate = date || selectedDate;
        const startDate = new Date(currentDate);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(currentDate);
        endDate.setHours(23, 59, 59, 999);

        try {
            const consumedData = await getUserNutritionBetweenDates(
                startDate.toISOString(),
                endDate.toISOString()
            );

            setConsumedFoods(consumedData);

            const consumedTotals = consumedData.reduce(
                (acc, item) => {
                    acc.calories += item.calories || 0;
                    acc.protein += item.protein || 0;
                    acc.carbohydrate += item.carbohydrate || 0;
                    acc.fat += item.fat || 0;
                    return acc;
                },
                { calories: 0, carbohydrate: 0, fat: 0, protein: 0 }
            );

            setConsumed(consumedTotals);
        } catch (error) {
            console.error('Error loading consumed data:', error);
        }
    }, [selectedDate]);

    const handleCloseFoodSearchModal = useCallback(() => {
        setFoodSearchModalVisible(false);
        loadConsumed();
    }, [loadConsumed]);

    const handleSyncHealthConnect = useCallback(async () => {
        setIsLoading(true);

        await syncHealthConnectData(
            checkReadIsPermitted,
            checkWriteIsPermitted,
            insertHealthData,
            getStartOfDayTimestampISOString(getDaysAgoTimestampISOString(1)),
            getEndOfDayTimestampISOString(getCurrentTimestampISOString()),
            1000
        );

        await loadConsumed();
        setIsLoading(false);
    }, [checkReadIsPermitted, checkWriteIsPermitted, insertHealthData, loadConsumed]);

    const loadRecentFood = useCallback(async () => {
        const recentFoodIds = await getRecentFood();

        const foods = await getAllFoodsByIds(recentFoodIds);

        if (foods) {
            setRecentTrackedFoods(foods.map((food) => ({
                carbs: food.totalCarbohydrate,
                ean: food.productCode,
                fat: food.totalFat,
                id: food.id,
                kcal: food.calories,
                productTitle: food.name,
                protein: food.protein,
            })));
        }
    }, []);

    const loadFavoriteFood = useCallback(async () => {
        const favFoodsData = await getAllFavoriteFoods();

        if (favFoodsData) {
            setFavoriteFoods(favFoodsData.map((food) => ({
                carbs: food.totalCarbohydrate,
                ean: food.productCode,
                fat: food.totalFat,
                id: food.id,
                kcal: food.calories,
                productTitle: food.name,
                protein: food.protein,
            })));
        }
    }, []);

    const resetScreenData = useCallback(() => {
        setSearchQuery('');
        // Removed so that the tab does not reset each time.
        // setTabIndex(0);
        setConsumedFoods([]);
        setAllowEditName(false);
        setShowBarcodeCamera(false);
        setShowPhotoCamera(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadConsumed();
            checkApiKey();
            loadRecentFood();
            loadFavoriteFood();

            return () => {
                resetScreenData();
            };
        }, [checkApiKey, loadConsumed, loadRecentFood, loadFavoriteFood, resetScreenData])
    );

    const OverviewRoute = useCallback(() => {
        return (
            <Screen style={styles.container}>
                <ScrollView>
                    <NutritionProgressBanner
                        consumed={consumed}
                        date={
                            getEndOfDayTimestampISOString(selectedDate.toISOString()) === getEndOfDayTimestampISOString(getCurrentTimestampISOString())
                                ? undefined
                                : formatDate(selectedDate.toISOString(), 'dd/MM/yyyy')
                        }
                    />
                    {Platform.OS === 'web' ? (
                        <View style={{ height: 40 }} />
                    ) : null}
                    {(recentTrackedFoods.length > 0 || favoriteFoods.length > 0) ? (
                        <View>
                            <SegmentedButtons
                                buttons={[
                                    { label: t('recent'), value: 'recent' },
                                    { label: t('favorite'), value: 'favorite' },
                                ]}
                                onValueChange={setFoodHistoryType}
                                style={styles.segmentedButtons}
                                value={foodHistoryType}
                            />
                            {foodHistory.length > 0 ? (
                                <FlashList
                                    contentContainerStyle={styles.listContent}
                                    data={foodHistory}
                                    estimatedItemSize={115}
                                    keyExtractor={(item, index) => (item.id || index).toString()}
                                    onEndReachedThreshold={0.5}
                                    renderItem={({ item }) => (
                                        <FoodItem
                                            food={item}
                                            onAddFood={(food) => {
                                                setSelectedFood(food);
                                                setIsNutritionModalVisible(true);
                                            }}
                                        />
                                    )}
                                />
                            ) : t('no_data')}
                        </View>
                    ) : null}
                </ScrollView>
            </Screen>
        );
    }, [consumed, favoriteFoods.length, foodHistory, foodHistoryType, recentTrackedFoods.length, selectedDate, styles.container, styles.listContent, styles.segmentedButtons, t]);

    const handleEditNutrition = (userNutrition: UserNutritionDecryptedReturnType) => {
        setSelectedFood({
            carbs: userNutrition.carbohydrate,
            fat: userNutrition.fat,
            grams: userNutrition.grams,
            kcal: userNutrition.calories,
            productTitle: userNutrition.name,
            protein: userNutrition.protein,
        });

        setUserNutritionId(userNutrition.id);
        setIsNutritionModalVisible(true);
    };

    const handleDeleteNutrition = useCallback((userNutrition: UserNutritionDecryptedReturnType) => {
        setSelectedNutrition(userNutrition);
        setDeleteModalVisible(true);
    }, []);

    const handleConfirmDeleteNutrition = useCallback(async () => {
        if (!selectedNutrition) {
            return;
        }

        try {
            await deleteUserNutrition(selectedNutrition.id);
            await loadConsumed();
        } catch (error) {
            console.error(t('failed_delete_nutrition'), error);
        } finally {
            setDeleteModalVisible(false);
            setSelectedNutrition(null);
        }
    }, [selectedNutrition, loadConsumed, t]);

    const MealsRoute = useCallback(() => {
        const mealGroups = consumedFoods.reduce((groups, food) => {
            const mealType = food.mealType || MEAL_TYPE.UNKNOWN;
            if (!groups[mealType]) {
                groups[mealType] = [];
            }

            groups[mealType].push(food);
            return groups;
        }, {} as { [key: string]: UserNutritionDecryptedReturnType[] });

        return (
            <ScrollView
                contentContainerStyle={styles.mealsContent}
                refreshControl={
                    <RefreshControl
                        colors={[colors.primary]}
                        onRefresh={handleSyncHealthConnect}
                        refreshing={isLoading}
                    />
                }
            >
                {consumedFoods.length === 0 ? (
                    <Text style={styles.noTrackedText}>{t('no_tracked_meals')}</Text>
                ) : null}
                {Object.entries(MEAL_TYPE)
                    .sort(([_, mealTypeA], [__, mealTypeB]) => mealTypeA - mealTypeB)
                    .map(([mealTypeName, mealType]) => {
                        const userNutritions = mealGroups[mealType];
                        if (userNutritions && userNutritions.length > 0) {
                            return (
                                <View key={mealTypeName} style={styles.mealContainer}>
                                    <View style={styles.mealHeader}>
                                        <Text style={styles.mealTitle}>
                                            {mealCategories.find((m) => m.name === mealTypeName.toLowerCase())?.icon} {t(mealTypeName.toLowerCase())}
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
                                                            <FontAwesome5 color={colors.primary} name="edit" size={20} />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => handleDeleteNutrition(userNutrition)}>
                                                            <FontAwesome5 color={colors.primary} name="trash" size={20} />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                                <View style={styles.metricRow}>
                                                    <Text style={styles.metricDetail}>
                                                        {t('item_value', {
                                                            item: t('calories'),
                                                            value: safeToFixed(userNutrition.calories),
                                                        })}
                                                    </Text>
                                                    <Text style={styles.metricDetail}>
                                                        {t('item_value_unit', {
                                                            item: t('carbs'),
                                                            value: getDisplayFormattedWeight(userNutrition.carbohydrate || 0, GRAMS, isImperial).toString(),
                                                            weightUnit: macroUnit,
                                                        })}
                                                    </Text>
                                                </View>
                                                <View style={styles.metricRow}>
                                                    <Text style={styles.metricDetail}>
                                                        {t('item_value_unit', {
                                                            item: t('fats'),
                                                            value: getDisplayFormattedWeight(userNutrition.fat || 0, GRAMS, isImperial).toString(),
                                                            weightUnit: macroUnit,
                                                        })}
                                                    </Text>
                                                    <Text style={styles.metricDetail}>
                                                        {t('item_value_unit', {
                                                            item: t('proteins'),
                                                            value: getDisplayFormattedWeight(userNutrition.protein || 0, GRAMS, isImperial).toString(),
                                                            weightUnit: macroUnit,
                                                        })}
                                                    </Text>
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
    }, [consumedFoods, styles.mealsContent, styles.noTrackedText, styles.mealContainer, styles.mealHeader, styles.mealTitle, styles.foodItem, styles.cardContent, styles.cardHeader, styles.cardTitle, styles.iconContainer, styles.metricRow, styles.metricDetail, isLoading, handleSyncHealthConnect, colors.primary, t, mealCategories, isImperial, macroUnit, handleDeleteNutrition]);

    const renderScene = ({ route }: { route: { key: string } }) => {
        switch (route.key) {
            case 'meals':
                return <MealsRoute />;
            case 'overview':
                return <OverviewRoute />;
            default:
                return null;
        }
    };

    const renderTabBar = (props: any) => (
        <TabBar
            {...props}
            activeColor={colors.onSurface}
            inactiveColor={colors.onSurface}
            indicatorStyle={{ backgroundColor: dark ? colors.primary : colors.surface }}
            labelStyle={{ fontWeight: 'bold' }}
            style={{ backgroundColor: dark ? colors.surface : colors.primaryContainer }}
        />
    );

    const handleBarCodeScanned = useCallback(async ({ data, type }: { data: BarcodeScanningResult['data'], type?: BarcodeScanningResult['type'] }) => {
        setScanned(true);
        setShowBarcodeCamera(false);

        const foodInfo = await fetchProductByEAN(data);

        if (foodInfo) {
            setSelectedFood(foodInfo);
            setIsNutritionModalVisible(true);
        }

        setScanned(false);
    }, []);

    // Function to request camera permissions and show the barcode scanner
    const openBarcodeCamera = useCallback(async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                alert(t('camera_permission_denied'));
                return;
            }
        }

        setShowBarcodeCamera(true);
    }, [permission?.granted, requestPermission, t]);

    const handleChangeDate = useCallback((date: Date) => {
        setSelectedDate(date);
        loadConsumed(date);
    }, [loadConsumed]);

    // Function to request camera permissions and show the photo camera
    const openPhotoCamera = useCallback(async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                alert(t('camera_permission_denied'));
                return;
            }
        }
        setShowPhotoCamera(true);
    }, [permission?.granted, requestPermission, t]);

    const handlePhoto = useCallback(async (imageUri: string) => {
        if (photoMode === 'meal') {
            const macros = await estimateNutritionFromPhoto(imageUri);
            if (macros) {
                const normalizedMacros = normalizeMacrosByGrams({
                    carbs: macros.carbs,
                    fat: macros.fat,
                    grams: macros.grams,
                    kcal: macros.kcal,
                    kj: macros.kj,
                    protein: macros.protein,
                });

                setSelectedFood({
                    ...normalizedMacros,
                    estimatedGrams: macros.grams,
                    productTitle: macros.name,
                });
                setAllowEditName(true);
            }
        } else {
            const macros = await extractMacrosFromLabelPhoto(imageUri);
            if (macros) {
                const normalizedMacros = normalizeMacrosByGrams({
                    carbs: macros.carbs,
                    fat: macros.fat,
                    grams: macros.grams,
                    kcal: macros.kcal,
                    kj: macros.kj,
                    protein: macros.protein,
                });

                setSelectedFood({
                    ...normalizedMacros,
                    productTitle: macros.name,
                });
                setAllowEditName(true);
            }
        }
    }, [photoMode]);

    const handleLoadLocalFile = useCallback(async (type: 'barcode' | 'photo') => {
        if (Platform.OS === 'web') {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.style.display = 'none';

            input.onchange = async (event) => {
                // @ts-ignore it's fine, files exist.
                const file = event.target?.files?.[0];
                if (file) {
                    try {
                        const reader = new FileReader();
                        reader.onload = async () => {
                            const imageUri = reader.result;
                            if (typeof imageUri === 'string') {
                                setIsLoading(true);
                                setIsNutritionModalVisible(true);
                                setShowBarcodeCamera(false);
                                setShowPhotoCamera(false);

                                if (type === 'photo') {
                                    await handlePhoto(imageUri);
                                } else if (type === 'barcode') {
                                    Quagga.decodeSingle({
                                        decoder: {
                                            readers: ['ean_reader', 'ean_8_reader'],
                                        },
                                        inputStream: { size: 800 },
                                        src: imageUri,
                                    },
                                    (result) => {
                                        if (result?.codeResult) {
                                            if (result.codeResult.code) {
                                                handleBarCodeScanned({
                                                    data: result.codeResult.code,
                                                    type: result.codeResult.format,
                                                });
                                            }
                                        } else {
                                            alert(t('no_barcodes_detected'));
                                        }
                                    }
                                    );
                                }

                                setIsLoading(false);
                            }
                        };
                        reader.readAsDataURL(file);
                    } catch (error) {
                        console.error('Error loading local file:', error);
                    }
                }
            };

            document.body.appendChild(input);
            input.click();
            document.body.removeChild(input);
        } else {
            try {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    alert(t('media_library_permission_denied'));
                    return;
                }

                const result = await ImagePicker.launchImageLibraryAsync({
                    allowsEditing: false,
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 1,
                });

                if (!result.canceled && result.assets?.length > 0) {
                    const imageUri = result.assets[0].uri;

                    setIsLoading(true);
                    setIsNutritionModalVisible(true);
                    setShowBarcodeCamera(false);
                    setShowPhotoCamera(false);

                    if (type === 'photo') {
                        await handlePhoto(imageUri);
                    } else if (type === 'barcode') {
                        try {
                            const barcodes = await detectBarcodes(imageUri, [
                                BarcodeFormat.EAN_13,
                                BarcodeFormat.EAN_8,
                            ]);

                            if (barcodes.length > 0) {
                                const firstBarcode = barcodes[0];
                                if (firstBarcode.rawValue) {
                                    await handleBarCodeScanned({
                                        data: firstBarcode.rawValue,
                                        type: firstBarcode.format as unknown as string,
                                    });
                                } else {
                                    alert(t('no_barcodes_detected'));
                                }
                            } else {
                                alert(t('no_barcodes_detected'));
                            }
                        } catch (error) {
                            console.error('Error detecting barcodes:', error);
                            alert(t('barcode_detection_error'));
                        }
                    }

                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Error loading local file:', error);
            }
        }
    }, [handlePhoto, handleBarCodeScanned, t]);

    // Handler for taking a photo
    const handleTakePhoto = useCallback(async () => {
        if (photoCameraRef.current) {
            try {
                // @ts-ignore
                const photo = await (photoCameraRef.current as typeof CameraView).takePictureAsync();
                setIsLoading(true);
                setShowPhotoCamera(false);
                setIsNutritionModalVisible(true);

                if (photoMode === 'meal') {
                    const macros = await estimateNutritionFromPhoto(photo.uri);
                    if (macros) {
                        const normalizedMacros = normalizeMacrosByGrams({
                            carbs: macros.carbs,
                            fat: macros.fat,
                            grams: macros.grams,
                            kcal: macros.kcal,
                            kj: macros.kj,
                            protein: macros.protein,
                        });

                        setSelectedFood({
                            ...normalizedMacros,
                            estimatedGrams: macros.grams,
                            productTitle: macros.name,
                        });
                        setAllowEditName(true);
                    }
                } else {
                    const macros = await extractMacrosFromLabelPhoto(photo.uri);
                    if (macros) {
                        const normalizedMacros = normalizeMacrosByGrams({
                            carbs: macros.carbs,
                            fat: macros.fat,
                            grams: macros.grams,
                            kcal: macros.kcal,
                            kj: macros.kj,
                            protein: macros.protein,
                        });

                        setSelectedFood({
                            ...normalizedMacros,
                            productTitle: macros.name,
                        });
                        setAllowEditName(true);
                    }
                }

                setIsLoading(false);
            } catch (error) {
                console.error('Error taking photo:', error);
            }
        }
    }, [photoMode]);

    const handleFoodSearch = useCallback(() => {
        navigation.navigate('foodSearch', { defaultMealType: preSelectedMealType, initialSearchQuery: searchQuery });
    }, [navigation, preSelectedMealType, searchQuery]);

    const handleCloseTrackingModal = useCallback(() => {
        setIsNutritionModalVisible(false);
        setSelectedFood(null);
        setUserNutritionId(null);
        setAllowEditName(false);

        loadConsumed();
    }, [loadConsumed]);

    const renderScannerOverlay = useCallback(() => (
        <View style={styles.scannerOverlayContainer}>
            <View style={styles.scannerOverlayTop} />
            <View style={styles.scannerOverlayMiddle}>
                <View style={styles.scannerFocusArea}>
                    <View style={styles.focusBorder} />
                </View>
            </View>
            <View style={styles.scannerOverlayBottom}>
                <View style={[styles.controls, styles.scannerControls]}>
                    <TouchableOpacity
                        onPress={() => setShowBarcodeCamera(false)}
                        style={styles.photoControlButton}
                    >
                        <FontAwesome5 color={colors.onPrimary} name="times-circle" size={30} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => handleLoadLocalFile('barcode')}
                        style={styles.photoControlButton}
                    >
                        <FontAwesome5 color={colors.onPrimary} name="file-upload" size={30} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    ), [colors.onPrimary, handleLoadLocalFile, styles.focusBorder, styles.photoControlButton, styles.controls, styles.scannerControls, styles.scannerFocusArea, styles.scannerOverlayBottom, styles.scannerOverlayContainer, styles.scannerOverlayMiddle, styles.scannerOverlayTop]);

    const renderPhotoCameraOverlay = useCallback(() => (
        <View style={styles.photoCameraOverlay}>
            <SegmentedButtons
                buttons={[
                    {
                        label: t('meal'),
                        style: {
                            backgroundColor: photoMode === 'meal' ? colors.secondaryContainer : colors.surface,
                        },
                        value: 'meal',
                    },
                    {
                        label: t('food_label'),
                        style: {
                            backgroundColor: photoMode === 'label' ? colors.secondaryContainer : colors.surface,
                        },
                        value: 'label',
                    },
                ]}
                onValueChange={setPhotoMode}
                style={styles.segmentedButtons}
                value={photoMode}
            />
            <View style={[styles.controls, styles.photoControls]}>
                <TouchableOpacity
                    onPress={() => setShowPhotoCamera(false)}
                    style={styles.photoControlButton}
                >
                    <FontAwesome5 color={colors.onPrimary} name="times-circle" size={30} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleTakePhoto}
                    style={styles.captureButton}
                >
                    <View style={styles.captureButtonCircle} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => handleLoadLocalFile('photo')}
                    style={styles.photoControlButton}
                >
                    <FontAwesome5 color={colors.onPrimary} name="file-upload" size={30} />
                </TouchableOpacity>
            </View>
        </View>
    ), [styles.photoCameraOverlay, styles.segmentedButtons, styles.controls, styles.photoControls, styles.photoControlButton, styles.captureButton, styles.captureButtonCircle, t, photoMode, colors.secondaryContainer, colors.surface, colors.onPrimary, handleTakePhoto, handleLoadLocalFile]);

    const fabActions = useMemo(() => [{
        icon: () => <FontAwesome5 color={colors.primary} name="bread-slice" size={FAB_ICON_SIZE} />,
        label: t('track_breakfast'),
        onPress: () => {
            setFoodSearchModalVisible(true);
            setPreSelectedMealType('1');
        },
        style: { backgroundColor: colors.surface },
    }, {
        icon: () => <FontAwesome5 color={colors.primary} name="hamburger" size={FAB_ICON_SIZE} />,
        label: t('track_lunch'),
        onPress: () => {
            setFoodSearchModalVisible(true);
            setPreSelectedMealType('2');
        },
        style: { backgroundColor: colors.surface },
    }, {
        icon: () => <FontAwesome5 color={colors.primary} name="drumstick-bite" size={FAB_ICON_SIZE} />,
        label: t('track_dinner'),
        onPress: () => {
            setFoodSearchModalVisible(true);
            setPreSelectedMealType('3');
        },
        style: { backgroundColor: colors.surface },
    }, {
        icon: () => <FontAwesome5 color={colors.primary} name="apple-alt" size={FAB_ICON_SIZE} />,
        label: t('track_snacks'),
        onPress: () => {
            setFoodSearchModalVisible(true);
            setPreSelectedMealType('4');
        },
        style: { backgroundColor: colors.surface },
    }], [colors.primary, colors.surface, t]);

    return (
        <FABWrapper actions={fabActions} icon="plus" visible={!showPhotoCamera && !showBarcodeCamera}>
            <View style={styles.container}>
                <Appbar.Header mode="small" statusBarHeight={0} style={styles.appbarHeader}>
                    <Appbar.Content title={t('macro_tracker')} titleStyle={styles.appbarTitle} />
                </Appbar.Header>
                <View style={styles.content}>
                    <View style={styles.searchContainer}>
                        <TextInput
                            mode="outlined"
                            onChangeText={setSearchQuery}
                            placeholder={t('search_food')}
                            style={styles.searchInput}
                            value={searchQuery}
                        />
                        {searchQuery ? (
                            <Button
                                mode="outlined"
                                onPress={handleFoodSearch}
                                style={styles.iconButton}
                            >
                                <FontAwesome5 color={colors.primary} name="search" size={20} />
                            </Button>
                        ) : (
                            <>
                                <Button
                                    mode="outlined"
                                    onPress={openBarcodeCamera}
                                    style={styles.iconButton}
                                >
                                    <FontAwesome5 color={colors.primary} name="barcode" size={20} />
                                </Button>
                                {isAiEnabled ? (
                                    <Button
                                        mode="outlined"
                                        onPress={openPhotoCamera}
                                        style={styles.iconButton}
                                    >
                                        <FontAwesome5 color={colors.primary} name="camera" size={20} />
                                    </Button>
                                ) : null}
                            </>
                        )}
                    </View>
                    <ArrowedDatePicker
                        initialDate={selectedDate}
                        onChange={handleChangeDate}
                    />
                    <TabView
                        initialLayout={{ width: Dimensions.get('window').width }}
                        navigationState={{ index: tabIndex, routes }}
                        onIndexChange={setTabIndex}
                        renderScene={renderScene}
                        renderTabBar={renderTabBar}
                    />
                </View>
                {showBarcodeCamera ? (
                    <View style={styles.cameraContainer}>
                        <CameraView
                            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                            ratio="16:9"
                            style={styles.camera}
                        >
                            {renderScannerOverlay()}
                        </CameraView>
                    </View>
                ) : null}
                {showPhotoCamera ? (
                    <View style={styles.cameraContainer}>
                        <CameraView
                            ref={photoCameraRef}
                            style={styles.camera}
                        >
                            {renderPhotoCameraOverlay()}
                        </CameraView>
                    </View>
                ) : null}
                <FoodTrackingModal
                    allowEditName={allowEditName}
                    date={selectedDate.toISOString()}
                    defaultMealType={preSelectedMealType}
                    food={selectedFood}
                    isLoading={isLoading}
                    onClose={handleCloseTrackingModal}
                    userNutritionId={userNutritionId}
                    visible={isNutritionModalVisible}
                />
                <SearchFoodModal
                    defaultMealType={preSelectedMealType}
                    onClose={handleCloseFoodSearchModal}
                    onFoodSelected={handleOnFoodSelected}
                    showLastTracked={consumedFoods.filter(
                        (food) => food.mealType?.toString() === preSelectedMealType
                    ).length === 0}
                    visible={foodSearchModalVisible}
                />
                <ThemedModal
                    cancelText={t('no')}
                    confirmText={t('yes')}
                    onClose={() => setDeleteModalVisible(false)}
                    onConfirm={handleConfirmDeleteNutrition}
                    title={selectedNutrition ? t('delete_nutrition_confirmation', { title: selectedNutrition.name }) : t('delete_confirmation_generic')}
                    visible={deleteModalVisible}
                />
            </View>
        </FABWrapper>
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
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderRadius: 35,
        height: 70,
        justifyContent: 'center',
        width: 70,
    },
    captureButtonCircle: {
        backgroundColor: 'white',
        borderColor: colors.onSurface,
        borderRadius: 30,
        borderWidth: 5,
        height: 60,
        opacity: 0.7,
        width: 60,
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
        width: '85%',
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
    controls: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    focusBorder: {
        borderColor: colors.primary,
        borderRadius: 8,
        borderWidth: 2,
        height: '100%',
        width: '100%',
    },
    foodItem: {
        backgroundColor: colors.surface,
        borderColor: colors.primary,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
        padding: 8,
    },
    iconButton: {
        marginLeft: 4,
    },
    iconContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    listContent: {
        backgroundColor: colors.background,
        flex: 1,
        paddingBottom: 16,
        paddingHorizontal: 16,
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
    mealsContent: {
        padding: 16,
    },
    mealTitle: {
        color: colors.onSurface,
        fontSize: 16,
        fontWeight: '600',
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
    noTrackedText: {
        color: colors.onSurface,
        fontSize: 16,
        textAlign: 'center',
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
    photoControlButton: {
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: 25,
        height: 50,
        justifyContent: 'center',
        width: 50,
    },
    photoControls: {
        bottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        position: 'absolute',
        width: '100%',
    },
    scannerControls: {
        bottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        position: 'absolute',
        width: '100%',
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
