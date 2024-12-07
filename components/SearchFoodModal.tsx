import { FoodTrackingType } from '@/components/FoodTrackingModal';
import ThemedModal from '@/components/ThemedModal';
import { AI_SETTINGS_TYPE } from '@/constants/storage';
import { useSettings } from '@/storage/SettingsContext';
import { estimateNutritionFromPhoto, extractMacrosFromLabelPhoto, getAiApiVendor } from '@/utils/ai';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { fetchProductByEAN } from '@/utils/fetchFoodData';
import { FontAwesome5 } from '@expo/vector-icons';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Dimensions,
    TextInput as RNTextInput,
    StyleSheet,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { Button, Portal, SegmentedButtons, Text, useTheme } from 'react-native-paper';

interface SearchFoodModalProps {
    onClose: () => void;
    onFoodSelected: (food: FoodTrackingType) => void;
    style?: ViewStyle;
    visible: boolean;
}

const SearchFoodModal = ({
    onClose,
    onFoodSelected,
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

    const photoCameraRef = useRef(null);

    const { getSettingByType } = useSettings();
    const checkApiKey = useCallback(async () => {
        const vendor = await getAiApiVendor();
        const isAiSettingsEnabled = await getSettingByType(AI_SETTINGS_TYPE);

        const hasAiEnabled = Boolean(vendor) && isAiSettingsEnabled?.value === 'true';
        setIsAiEnabled(hasAiEnabled);
    }, [getSettingByType]);

    useFocusEffect(
        useCallback(() => {
            checkApiKey();
        }, [checkApiKey])
    );

    const handleBarCodeScanned = useCallback(
        async ({ data }: BarcodeScanningResult) => {
            setScanned(true);
            setShowBarcodeCamera(false);
            setIsLoading(true);

            const foodInfo = await fetchProductByEAN(data);

            if (foodInfo) {
                onFoodSelected(foodInfo);
            } else {
                alert(t('no_food_found'));
            }

            setScanned(false);
            setIsLoading(false);
        },
        [onFoodSelected, t]
    );

    const openBarcodeCamera = useCallback(async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                alert(t('camera_permission_denied'));
                return;
            }
        }

        setShowBarcodeCamera(true);
    }, [permission, requestPermission, t]);

    const openPhotoCamera = useCallback(async () => {
        if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) {
                alert(t('camera_permission_denied'));
                return;
            }
        }

        setShowPhotoCamera(true);
    }, [permission, requestPermission, t]);

    const handleTakePhoto = useCallback(async () => {
        setIsLoading(true);
        if (photoCameraRef.current) {
            try {
                // @ts-ignore
                const photo = await photoCameraRef.current.takePictureAsync();
                setShowPhotoCamera(false);

                let macros;
                if (photoMode === 'meal') {
                    macros = await estimateNutritionFromPhoto(photo.uri);
                } else {
                    macros = await extractMacrosFromLabelPhoto(photo.uri);
                }

                if (macros) {
                    onFoodSelected({
                        carbs: macros.carbs,
                        fat: macros.fat,
                        grams: macros.grams,
                        kcal: macros.kcal,
                        productTitle: macros.name,
                        protein: macros.protein,
                    });
                } else {
                    alert(t('no_macros_found'));
                }
            } catch (error) {
                console.error('Error taking photo:', error);
            }
        }
        setIsLoading(false);
    }, [onFoodSelected, photoMode, t]);

    const handleFoodSearch = useCallback(() => {
        onClose();
        navigation.navigate('foodSearch', { initialSearchQuery: searchQuery });
    }, [navigation, onClose, searchQuery]);

    const renderScannerOverlay = useCallback(
        () => (
            <View style={styles.scannerOverlayContainer}>
                <View style={styles.scannerOverlayTop} />
                <View style={styles.scannerOverlayMiddle}>
                    <View style={styles.scannerFocusArea}>
                        <View style={styles.focusBorder} />
                    </View>
                </View>
                <View style={styles.scannerOverlayBottom} />
            </View>
        ),
        [styles]
    );

    const renderPhotoCameraOverlay = useCallback(
        () => (
            <View style={styles.photoCameraOverlay}>
                <SegmentedButtons
                    buttons={[
                        {
                            label: t('meal'),
                            style: { backgroundColor: photoMode === 'meal' ? colors.secondaryContainer : colors.surface },
                            value: 'meal',
                        },
                        {
                            label: t('food_label'),
                            style: { backgroundColor: photoMode === 'label' ? colors.secondaryContainer : colors.surface },
                            value: 'label',
                        },
                    ]}
                    onValueChange={setPhotoMode}
                    style={styles.segmentedButtons}
                    value={photoMode}
                />
                <View style={styles.bottomControls}>
                    <TouchableOpacity onPress={() => setShowPhotoCamera(false)} style={styles.photoCloseButton}>
                        <Text style={styles.photoCloseText}>{t('close')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleTakePhoto} style={styles.captureButton}>
                        <FontAwesome5 color={colors.primary} name="camera" size={30} />
                    </TouchableOpacity>
                </View>
            </View>
        ),
        [colors.primary, colors.secondaryContainer, colors.surface, handleTakePhoto, photoMode, styles, t]
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
                            <View style={styles.cameraOverlay}>
                                <Button mode="contained" onPress={() => setShowBarcodeCamera(false)} style={styles.closeButton}>
                                    {t('close')}
                                </Button>
                            </View>
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
        </ThemedModal>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    bottomControls: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    camera: {
        flex: 1,
        height: Dimensions.get('window').height - 28,
        left: 0,
        position:'absolute',
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
        backgroundColor: 'transparent',
    },
    closeButton: {
        backgroundColor: colors.primary,
        padding: 8,
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
