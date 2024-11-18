import CustomTextInput from '@/components/CustomTextInput';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { FlashList } from '@shopify/flash-list';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, Pressable, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';

interface SearchablePickerProps {
    items: { label: string; value: string }[];
    label: string;
    onValueChange: (itemValue: string) => void;
    selectedValue: string;
    wrapperStyle?: ViewStyle;
}

const SearchablePicker: React.FC<SearchablePickerProps> = ({
    items,
    label,
    onValueChange,
    selectedValue,
    wrapperStyle,
}) => {
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);
    const { t } = useTranslation();

    const [searchQuery, setSearchQuery] = useState('');
    const [filteredItems, setFilteredItems] = useState(items);
    const [isModalVisible, setIsModalVisible] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(300)).current;

    useEffect(() => {
        if (isModalVisible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    duration: 300,
                    toValue: 1,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    duration: 300,
                    toValue: 0,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    duration: 300,
                    toValue: 0,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    duration: 300,
                    toValue: 300,
                    useNativeDriver: true,
                }),
            ]).start(() => setIsModalVisible(false));
        }
    }, [isModalVisible, fadeAnim, slideAnim]);

    useEffect(() => {
        setFilteredItems(
            items.filter((item) =>
                item.label.toLowerCase().includes(searchQuery.toLowerCase())
            )
        );
    }, [searchQuery, items]);

    const handleSelectItem = (value: string) => {
        onValueChange(value);
        setIsModalVisible(false);
        setSearchQuery('');
    };

    const handleOpenModal = () => {
        setIsModalVisible(true);
    };

    const handleCloseModal = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                duration: 300,
                toValue: 0,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                duration: 300,
                toValue: 300,
                useNativeDriver: true,
            }),
        ]).start(() => setIsModalVisible(false));
    };

    return (
        <View style={[styles.formGroup, wrapperStyle]}>
            <Text style={styles.label}>
                {label}
            </Text>
            <TouchableOpacity onPress={handleOpenModal} style={styles.pickerContainer}>
                <Text style={styles.pickerText}>
                    {items.find(
                        (item) => item.value === selectedValue
                    )?.label || t('select')}
                </Text>
            </TouchableOpacity>
            <Modal
                animationType="none"
                onRequestClose={handleCloseModal}
                transparent={true}
                visible={isModalVisible}
            >
                <Pressable onPress={handleCloseModal} style={styles.modalContainer}>
                    <Animated.View style={[styles.modalContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                        <Pressable style={styles.innerPressable}>
                            <Text style={styles.label}>
                                {label}
                            </Text>
                            <CustomTextInput
                                inputStyle={styles.searchBox}
                                onChangeText={setSearchQuery}
                                placeholder={t('search')}
                                value={searchQuery}
                            />
                            <View style={styles.listContainer}>
                                <FlashList
                                    contentContainerStyle={styles.listContent}
                                    data={filteredItems}
                                    estimatedItemSize={40}
                                    keyExtractor={(item) => item.value}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity onPress={() => handleSelectItem(item.value)}>
                                            <Text style={styles.itemText}>{item.label}</Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            </View>
                            <Button
                                mode="contained"
                                onPress={handleCloseModal}
                                style={styles.closeButton}
                            >
                                {t('close')}
                            </Button>
                        </Pressable>
                    </Animated.View>
                </Pressable>
            </Modal>
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    closeButton: {
        marginTop: 10,
    },
    formGroup: {
        marginBottom: 16,
        width: '100%',
    },
    innerPressable: {
        flex: 1,
        width: '100%',
    },
    itemText: {
        color: colors.onSurface,
        fontSize: 16,
        paddingHorizontal: 10,
        paddingVertical: 10,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    listContainer: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 10,
    },
    modalContainer: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        flex: 1,
        justifyContent: 'center',
    },
    modalContent: {
        backgroundColor: colors.background,
        borderRadius: 8,
        flexDirection: 'column',
        maxHeight: '60%',
        minHeight: '60%',
        overflow: 'hidden',
        padding: 20,
        width: '90%',
    },
    pickerContainer: {
        backgroundColor: colors.surface,
        borderColor: colors.onSurface,
        borderRadius: 8,
        borderWidth: 1,
        height: 55,
        overflow: 'hidden',
        width: '100%',
    },
    pickerText: {
        color: colors.onSurface,
        fontSize: 16,
        paddingHorizontal: 10,
        paddingVertical: 15,
    },
    searchBox: {
        backgroundColor: colors.surface,
        borderColor: colors.onSurface,
        borderRadius: 8,
        borderWidth: 1,
        color: colors.onSurface,
        height: 55,
        marginBottom: 8,
        paddingHorizontal: 10,
    },
});

export default SearchablePicker;
