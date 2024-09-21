import CustomTextInput from '@/components/CustomTextInput';
import ThemedModal from '@/components/ThemedModal';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { formatFloatNumericInputText } from '@/utils/string';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from 'react-native-paper';

interface EditMacrosModalProps {
    carbohydrate: string;
    fat: string;
    handleCloseEditModal: () => void;
    handleSaveEdit: () => void;
    protein: string;
    setCarbohydrate: (value: ((prev: string) => string) | string) => void;
    setFat: (value: ((prev: string) => string) | string) => void;
    setProtein: (value: ((prev: string) => string) | string) => void;
    visible: boolean;
}

const EditMacrosModal: React.FC<EditMacrosModalProps> = ({
    carbohydrate,
    fat,
    handleCloseEditModal,
    handleSaveEdit,
    protein,
    setCarbohydrate,
    setFat,
    setProtein,
    visible,
}) => {
    const { t } = useTranslation();
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);

    const handleFormatNumericText = (text: string, key: 'carbohydrate' | 'fat' | 'protein') => {
        const formattedText = formatFloatNumericInputText(text);

        if (formattedText || !text) {
            if (key === 'carbohydrate') {
                setCarbohydrate(formattedText || '');
            } else if (key === 'fat') {
                setFat(formattedText || '');
            } else {
                setProtein(formattedText || '');
            }
        }
    };

    return (
        <ThemedModal
            cancelText={t('cancel')}
            confirmText={t('save')}
            onClose={handleCloseEditModal}
            onConfirm={handleSaveEdit}
            title={t('edit_macros')}
            visible={visible}
        >
            <View style={styles.modalRow}>
                <View style={styles.modalInputContainer}>
                    <TouchableOpacity
                        hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
                        onPress={() => setCarbohydrate((prev) => Math.max(0, Number(prev) - 1).toString())}
                    >
                        <FontAwesome color={colors.shadow} name="minus" size={26} />
                    </TouchableOpacity>
                    <CustomTextInput
                        inputStyle={styles.editInput}
                        keyboardType="numeric"
                        label={t('carbs')}
                        onChangeText={(text) => handleFormatNumericText(text, 'carbohydrate')}
                        placeholder={t('enter_carbs')}
                        value={carbohydrate}
                        wrapperStyle={styles.editInputWrapper}
                    />
                    <TouchableOpacity
                        hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
                        onPress={() => setCarbohydrate((prev) => (Number(prev) + 1).toString())}
                    >
                        <FontAwesome color={colors.shadow} name="plus" size={26} />
                    </TouchableOpacity>
                </View>
            </View>
            <View style={styles.modalRow}>
                <View style={styles.modalInputContainer}>
                    <TouchableOpacity
                        hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
                        onPress={() => setFat((prev) => Math.max(0, Number(prev) - 1).toString())}
                    >
                        <FontAwesome color={colors.shadow} name="minus" size={26} />
                    </TouchableOpacity>
                    <CustomTextInput
                        inputStyle={styles.editInput}
                        keyboardType="numeric"
                        label={t('fat')}
                        onChangeText={(text) => handleFormatNumericText(text, 'fat')}
                        placeholder={t('enter_fat')}
                        value={fat}
                        wrapperStyle={styles.editInputWrapper}
                    />
                    <TouchableOpacity
                        hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
                        onPress={() => setFat((prev) => (Number(prev) + 1).toString())}
                    >
                        <FontAwesome color={colors.shadow} name="plus" size={26} />
                    </TouchableOpacity>
                </View>
            </View>
            <View style={styles.modalRow}>
                <View style={styles.modalInputContainer}>
                    <TouchableOpacity
                        hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
                        onPress={() => setProtein((prev) => Math.max(0, Number(prev) - 1).toString())}
                    >
                        <FontAwesome color={colors.shadow} name="minus" size={26} />
                    </TouchableOpacity>
                    <CustomTextInput
                        inputStyle={styles.editInput}
                        keyboardType="numeric"
                        label={t('protein')}
                        onChangeText={(text) => handleFormatNumericText(text, 'protein')}
                        placeholder={t('enter_protein')}
                        value={protein}
                        wrapperStyle={styles.editInputWrapper}
                    />
                    <TouchableOpacity
                        hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
                        onPress={() => setProtein((prev) => (Number(prev) + 1).toString())}
                    >
                        <FontAwesome color={colors.shadow} name="plus" size={26} />
                    </TouchableOpacity>
                </View>
            </View>
        </ThemedModal>
    );
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    editInput: {
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    editInputWrapper: {
        marginHorizontal: 'auto',
        paddingHorizontal: 12,
        width: '80%',
    },
    modalInputContainer: {
        alignItems: 'center',
        backgroundColor: colors.background,
        flexDirection: 'row',
        justifyContent: 'center',
        paddingHorizontal: 8,
        width: '100%',
    },
    modalRow: {
        alignItems: 'center',
        backgroundColor: colors.background,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingHorizontal: 22,
    },
});

export default EditMacrosModal;
