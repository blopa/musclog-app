import type { BarcodeScanningResult } from 'expo-camera';

import ThemedCard from '@/components/ThemedCard';
import { ICON_SIZE } from '@/constants/ui';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { getUserNutritionBetweenDates } from '@/utils/database';
import { safeToFixed } from '@/utils/string';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { CameraView, useCameraPermissions  } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Platform, Dimensions, TouchableOpacity } from 'react-native';
import { Appbar, TextInput, Button, Text, useTheme } from 'react-native-paper';
import { TabView, TabBar } from 'react-native-tab-view';

const FoodLog = ({ navigation }: { navigation: NavigationProp<any> }) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [index, setIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [consumed, setConsumed] = useState({
        calories: 0,
        protein: 0,
        carbohydrate: 0,
        fat: 0,
    });
    const [routes] = useState([
        { key: 'overview', title: t('overview') },
        { key: 'meals', title: t('meals') },
    ]);

    // New state variables for camera permission and barcode scanning
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [showBarcodeCamera, setShowBarcodeCamera] = useState(false);
    const [showPhotoCamera, setShowPhotoCamera] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    // Reference to the photo camera
    const photoCameraRef = useRef(null);

    // Mock data for demonstration
    const dailyGoal = {
        calories: 2500,
        protein: 150,
        carbohydrate: 300,
        fat: 80,
    };

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
        setIsSearchFocused(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadConsumed();

            return () => {
                resetScreenData();
            };
        }, [loadConsumed, resetScreenData])
    );

    const OverviewRoute = () => {
        const macros = [
            { name: t('calories'), consumed: safeToFixed(consumed.calories), goal: dailyGoal.calories, unit: 'kcal' },
            { name: t('proteins'), consumed: safeToFixed(consumed.protein), goal: dailyGoal.protein, unit: 'g' },
            { name: t('carbs'), consumed: safeToFixed(consumed.carbohydrate), goal: dailyGoal.carbohydrate, unit: 'g' },
            { name: t('fats'), consumed: safeToFixed(consumed.fat), goal: dailyGoal.fat, unit: 'g' },
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

    const MealsRoute = () => (
        <FlashList
            data={mealCategories}
            keyExtractor={(item) => item.name}
            renderItem={({ item: category }) => (
                <ThemedCard>
                    <View style={styles.cardContent}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>
                                {category.icon} {category.name}
                            </Text>
                            <Text style={styles.noItemsText}>{t('no_items_added_yet')}</Text>
                        </View>
                        <View style={styles.cardActions}>
                            <FontAwesome5
                                color={colors.primary}
                                name="plus"
                                onPress={() => {
                                    /* Handle add meal item */
                                }}
                                size={ICON_SIZE}
                                style={styles.plusButton}
                            />
                        </View>
                    </View>
                </ThemedCard>
            )}
            estimatedItemSize={115}
            contentContainerStyle={styles.listContent}
        />
    );

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

    // Handler for barcode scanning
    const handleBarCodeScanned = ({ type, data }: BarcodeScanningResult) => {
        setScanned(true);
        setShowBarcodeCamera(false);
        // Handle the scanned data (e.g., search for the food item)
        alert(`${t('barcode_scanned')}: ${data}`);
        // Reset the scanned state for future scans
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
    const handleTakePhoto = async () => {
        if (photoCameraRef.current) {
            try {
                // @ts-ignore
                const photo = await (photoCameraRef.current as typeof CameraView).takePictureAsync();
                console.log('Photo taken:', photo.uri);
                // Here you can send the photo to AI for processing
                setShowPhotoCamera(false);
            } catch (error) {
                console.error('Error taking photo:', error);
            }
        }
    };

    const handleFoodSearch = useCallback(() => {
        navigation.navigate('foodSearch', { initialSearchQuery: searchQuery });
    }, [navigation, searchQuery]);

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
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setIsSearchFocused(false)}
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
                            <Button
                                mode="outlined"
                                onPress={openPhotoCamera}
                                style={styles.iconButton}
                            >
                                <FontAwesome5 name="camera" size={20} color={colors.primary} />
                            </Button>
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
                        <View style={styles.photoCameraOverlay}>
                            <TouchableOpacity onPress={() => setShowPhotoCamera(false)} style={styles.photoCloseButton}>
                                <Text style={styles.photoCloseText}>{t('close')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleTakePhoto} style={styles.captureButton}>
                                <FontAwesome5 name="camera" size={30} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </CameraView>
                </View>
            )}
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
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: -24,
    },
    cardContent: {
        padding: 16,
    },
    cardHeader: {
        flex: 1,
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
    iconButton: {
        marginLeft: 4,
    },
    listContent: {
        backgroundColor: colors.background,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    macroContainer: {
        marginBottom: 12,
    },
    metricDetail: {
        color: colors.onSurface,
        fontSize: 14,
        marginBottom: 4,
    },
    noItemsText: {
        color: colors.onSurface,
        fontSize: 14,
    },
    photoCameraOverlay: {
        alignItems: 'center',
        bottom: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        left: 0,
        paddingHorizontal: 20,
        position: 'absolute',
        right: 0,
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
    plusButton: {
        marginLeft: 4,
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
});

export default FoodLog;
