import { FoodTrackingType } from '@/components/FoodTrackingModal';
import ThemedCard from '@/components/ThemedCard';
import ThemedModal from '@/components/ThemedModal';
import { AI_SETTINGS_TYPE } from '@/constants/storage';
import { FAB_ICON_SIZE } from '@/constants/ui';
import { useSettings } from '@/storage/SettingsContext';
import { estimateNutritionFromPhoto, extractMacrosFromLabelPhoto, getAiApiVendor } from '@/utils/ai';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { normalizeMacrosByGrams } from '@/utils/data';
import { addUserNutritions, getUserNutritionOnDate } from '@/utils/database';
import { getCurrentTimestampISOString, getDaysAgoTimestampISOString } from '@/utils/date';
import { fetchProductByEAN } from '@/utils/fetchFoodData';
import { exerptlizeString } from '@/utils/string';
import { UserNutritionDecryptedReturnType } from '@/utils/types';
import Quagga from '@ericblade/quagga2';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    TextInput as RNTextInput,
    StyleSheet,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { BarcodeFormat, detectBarcodes } from 'react-native-barcodes-detector';
import { Button, Card, IconButton, Portal, SegmentedButtons, Text, useTheme } from 'react-native-paper';

interface SearchFoodModalProps {
    defaultMealType?: string;
    onClose: () => void;
    onFoodSelected: (food: FoodTrackingType) => void;
    showLastTracked?: boolean;
    style?: ViewStyle;
    visible: boolean;
}

const SearchFoodModal = ({
    defaultMealType = '0',
    onClose,
    onFoodSelected,
    showLastTracked = false,
    style,
    visible,
}: SearchFoodModalProps) => {
    const navigation = useNavigation<NavigationProp<any>>();
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);

    const [searchQuery, setSearchQuery] = useState('');
    const [showBarcodeCamera, setShowBarcodeCamera] = useState(false);
    const [showPhotoCamera, setShowPhotoCamera] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [photoMode, setPhotoMode] = useState<string>('meal');
    const [isAiEnabled, setIsAiEnabled] = useState(false);

    const [lastTrackedFoods, setLastTrackedFoods] = useState<UserNutritionDecryptedReturnType[]>([]);

    const photoCameraRef = useRef<CameraView>(null);

    const { getSettingByType } = useSettings();
    const checkApiKey = useCallback(async () => {
        const vendor = await getAiApiVendor();
        const isAiSettingsEnabled = await getSettingByType(AI_SETTINGS_TYPE);

        const hasAiEnabled = Boolean(vendor) && isAiSettingsEnabled?.value === 'true';
        setIsAiEnabled(hasAiEnabled);
    }, [getSettingByType]);

    const fetchLastTrackedFoods = useCallback(async () => {
        if (showLastTracked && visible) {
            const userNutritionFromYesterday = await getUserNutritionOnDate(getDaysAgoTimestampISOString(1));
            setLastTrackedFoods(
                userNutritionFromYesterday.filter(({ mealType }) => mealType?.toString() === defaultMealType)
            );
        }
    }, [visible, defaultMealType, showLastTracked]);

    useFocusEffect(
        useCallback(() => {
            checkApiKey();
            fetchLastTrackedFoods();
        }, [checkApiKey, fetchLastTrackedFoods])
    );

    const handleBarCodeScanned = useCallback(
        async ({ data, type }: { data: BarcodeScanningResult['data'], type?: BarcodeScanningResult['type'] }) => {
            setScanned(true);
            setShowBarcodeCamera(false);
            setIsLoading(true);

            try {
                const foodInfo = await fetchProductByEAN(data);

                if (foodInfo) {
                    onFoodSelected(foodInfo);
                } else {
                    Alert.alert(t('no_food_found'));
                }
            } catch (error) {
                console.error('Error fetching product by EAN:', error);
                Alert.alert(t('error_fetching_product'));
            } finally {
                setScanned(false);
                setIsLoading(false);
            }
        },
        [onFoodSelected, t]
    );

    const openBarcodeCamera = useCallback(async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                Alert.alert(t('camera_permission_denied'));
                return;
            }
        }

        setShowBarcodeCamera(true);
    }, [permission?.granted, requestPermission, t]);

    const openPhotoCamera = useCallback(async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                Alert.alert(t('camera_permission_denied'));
                return;
            }
        }

        setShowPhotoCamera(true);
    }, [permission?.granted, requestPermission, t]);

    const handlePhoto = useCallback(async (imageUri: string) => {
        try {
            let macros;
            if (photoMode === 'meal') {
                macros = await estimateNutritionFromPhoto(imageUri);
            } else {
                macros = await extractMacrosFromLabelPhoto(imageUri);
            }

            if (macros) {
                const normalizedMacros = normalizeMacrosByGrams({
                    carbs: macros.carbs,
                    fat: macros.fat,
                    grams: macros.grams,
                    kcal: macros.kcal,
                    kj: macros.kj,
                    protein: macros.protein,
                });

                const food: FoodTrackingType = {
                    ...normalizedMacros,
                    productTitle: macros.name,
                };

                if (photoMode === 'meal') {
                    food.estimatedGrams = macros.grams;
                }

                onFoodSelected(food);
            } else {
                Alert.alert(t('no_macros_found'));
            }
        } catch (error) {
            console.error('Error handling photo:', error);
            Alert.alert(t('error_handling_photo'));
        }
    }, [photoMode, onFoodSelected, t]);

    const handleLoadLocalFile = useCallback(async (type: 'barcode' | 'photo') => {
        try {
            if (Platform.OS === 'web') {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.style.display = 'none';

                input.onchange = async (event) => {
                    // @ts-ignore
                    const file = event.target?.files?.[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = async () => {
                            const imageUri = reader.result as string;
                            setIsLoading(true);
                            setIsLoading(true);
                            setShowBarcodeCamera(false);
                            setShowPhotoCamera(false);

                            if (type === 'photo') {
                                await handlePhoto(imageUri);
                            } else if (type === 'barcode') {
                                Quagga.decodeSingle(
                                    {
                                        decoder: {
                                            readers: ['ean_reader', 'ean_8_reader'],
                                        },
                                        locate: true,
                                        src: imageUri,
                                    },
                                    (result) => {
                                        if (result && result.codeResult && result.codeResult.code) {
                                            handleBarCodeScanned({
                                                data: result.codeResult.code,
                                                type: result.codeResult.format,
                                            });
                                        } else {
                                            Alert.alert(t('no_barcodes_detected'));
                                        }
                                    }
                                );
                            }

                            setIsLoading(false);
                        };
                        reader.readAsDataURL(file);
                    }
                };

                document.body.appendChild(input);
                input.click();
                document.body.removeChild(input);
            } else {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert(t('media_library_permission_denied'));
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
                                }
                            } else {
                                Alert.alert(t('no_barcodes_detected'));
                            }
                        } catch (error) {
                            console.error('Error detecting barcodes:', error);
                            Alert.alert(t('barcode_detection_error'));
                        }
                    }

                    setIsLoading(false);
                }
            }
        } catch (error) {
            console.error('Error loading local file:', error);
            Alert.alert(t('error_loading_file'));
        }
    }, [handleBarCodeScanned, handlePhoto, t]);

    const handleTakePhoto = useCallback(async () => {
        if (photoCameraRef.current) {
            try {
                const photo = await photoCameraRef.current.takePictureAsync();
                setIsLoading(true);
                setShowPhotoCamera(false);

                if (photo?.uri) {
                    await handlePhoto(photo.uri);
                } else {
                    Alert.alert(t('error_taking_photo'));
                }
            } catch (error) {
                console.error('Error taking photo:', error);
                Alert.alert(t('error_taking_photo'));
            } finally {
                setIsLoading(false);
            }
        }
    }, [handlePhoto, t]);

    const handleTrackSameAsYesterday = useCallback(async () => {
        setIsLoading(true);

        try {
            await addUserNutritions(
                lastTrackedFoods.map((userNutrition) => ({
                    ...userNutrition,
                    date: getCurrentTimestampISOString(),
                }))
            );

            Alert.alert(t('track_successful'));
            onClose();
        } catch (error) {
            console.error('Error tracking same as yesterday:', error);
            Alert.alert(t('error_tracking'));
        } finally {
            setIsLoading(false);
        }
    }, [lastTrackedFoods, onClose, t]);

    const handleFoodSearch = useCallback(() => {
        onClose();
        setSearchQuery('');
        navigation.navigate('foodSearch', { defaultMealType, initialSearchQuery: searchQuery });
    }, [defaultMealType, navigation, onClose, searchQuery]);

    const renderScannerOverlay = useCallback(
        () => (
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
        ),
        [colors.onPrimary, handleLoadLocalFile, styles]
    );

    const renderPhotoCameraOverlay = useCallback(
        () => (
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
        ),
        [colors.onPrimary, colors.secondaryContainer, colors.surface, handleLoadLocalFile, handleTakePhoto, photoMode, styles.captureButton, styles.captureButtonCircle, styles.controls, styles.photoCameraOverlay, styles.photoControlButton, styles.photoControls, styles.segmentedButtons, t]
    );

    return (
        <ThemedModal
            cancelText={t('close')}
            closeOnTouchOutside={false}
            onClose={onClose}
            style={(showPhotoCamera || showBarcodeCamera) ? styles.fullSize : style}
            title={t('search_food')}
            visible={visible}
        >
            {(showBarcodeCamera || showPhotoCamera || isLoading) ? null : (
                <>
                    <View style={styles.searchContainer}>
                        <RNTextInput
                            onChangeText={setSearchQuery}
                            placeholder={t('search_food')}
                            placeholderTextColor={colors.onSurfaceVariant}
                            style={styles.searchInput}
                            value={searchQuery}
                        />
                        <Button mode="outlined" onPress={handleFoodSearch} style={styles.iconButton}>
                            <FontAwesome5 color={colors.primary} name="search" size={20} />
                        </Button>
                    </View>
                    <View style={styles.iconRow}>
                        <Button mode="outlined" onPress={openBarcodeCamera} style={styles.iconButton}>
                            <FontAwesome5 color={colors.primary} name="barcode" size={20} />
                        </Button>
                        {isAiEnabled && (
                            <Button mode="outlined" onPress={openPhotoCamera} style={styles.iconButton}>
                                <FontAwesome5 color={colors.primary} name="camera" size={20} />
                            </Button>
                        )}
                    </View>
                </>
            )}
            {isLoading ? (
                <ActivityIndicator color={colors.primary} size="large" />
            ) : null}
            <Portal>
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
                        <CameraView ref={photoCameraRef} style={styles.camera}>
                            {renderPhotoCameraOverlay()}
                        </CameraView>
                    </View>
                ) : null}
            </Portal>
            {!isLoading && lastTrackedFoods.length > 0 ? (
                <ThemedCard style={styles.cardContainer}>
                    <Card.Content style={styles.cardContent}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>
                                {t('same_as_yesterday')}
                            </Text>
                            <Text>
                                {exerptlizeString(lastTrackedFoods.map(
                                    (food) => food.name
                                ).join(', '), 70)}
                            </Text>
                        </View>
                        <View style={styles.cardActions}>
                            <IconButton
                                icon="plus"
                                onPress={handleTrackSameAsYesterday}
                                size={FAB_ICON_SIZE}
                            />
                        </View>
                    </Card.Content>
                </ThemedCard>
            ) : null}
        </ThemedModal>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    camera: {
        flex: 1,
        height: Dimensions.get('window').height - 28,
        left: 0,
        position: 'absolute',
        top: 0,
        width: '100%',
    },
    cameraContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'black',
        justifyContent: 'center',
        zIndex: 9999,
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
    cardActions: {
        alignItems: 'center',
        flexDirection: 'row',
    },
    cardContainer: {
        marginBottom: 16,
        marginTop: 16,
    },
    cardContent: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    cardHeader: {
        flex: 1,
    },
    cardTitle: {
        color: colors.onSurface,
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    closeButton: {
        backgroundColor: colors.primary,
        padding: 8,
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
    fullSize: {
        height: '100%',
        left: 0,
        position: 'absolute',
        top: 0,
        width: '100%',
    },
    iconButton: {
        marginLeft: 4,
    },
    iconRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 16,
    },
    loadingIndicator: {
        marginTop: 20,
    },
    photoCameraOverlay: {
        flex: 1,
        justifyContent: 'space-between',
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
        bottom: 80,
        display: 'flex',
        justifyContent: 'space-between',
        position: 'absolute',
        width: '100%',
    },
    scannerControls: {
        bottom: 80,
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
        borderColor: colors.outline,
        borderRadius: 4,
        borderWidth: 1,
        color: colors.onSurface,
        flex: 1,
        height: 40,
        marginRight: 8,
        paddingHorizontal: 8,
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

export default SearchFoodModal;
