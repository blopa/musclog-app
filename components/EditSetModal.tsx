import CustomTextInput from '@/components/CustomTextInput';
import ThemedModal from '@/components/ThemedModal';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { formatFloatNumericInputText, formatIntegerNumericInputText } from '@/utils/string';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from 'react-native-paper';

type EditSetModalProps = {
    handleCloseEditModal: () => void;
    handleSaveEdit: () => void;
    reps: string;
    setReps: (value: ((prev: string) => string) | string) => void;
    setWeight: (value: ((prev: string) => string) | string) => void;
    visible: boolean;
    weight: string;
};

const EditSetModal = ({
    handleCloseEditModal,
    handleSaveEdit,
    reps,
    setReps,
    setWeight,
    visible,
    weight,
}: EditSetModalProps) => {
    const { t } = useTranslation();
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);
    const { weightUnit } = useUnit();

    const handleFormatNumericText = (text: string, key: 'reps' | 'weight') => {
        const formattedText = key === 'weight'
            ? formatFloatNumericInputText(text)
            : formatIntegerNumericInputText(text);

        if (formattedText || !text) {
            if (key === 'weight') {
                setWeight(formattedText || '');
            } else {
                setReps(formattedText || '');
            }
        }
    };

    return (
        <ThemedModal
            cancelText={t('cancel')}
            confirmText={t('save')}
            onClose={handleCloseEditModal}
            onConfirm={handleSaveEdit}
            title={t('edit_set')}
            visible={visible}
        >
            <View style={styles.modalRow}>
                <View style={styles.modalInputContainer}>
                    <TouchableOpacity
                        hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
                        onPress={() => setReps((prev) => Math.max(0, Number(prev) - 1).toString())}
                    >
                        <FontAwesome color={colors.shadow} name="minus" size={26} />
                    </TouchableOpacity>
                    <CustomTextInput
                        inputStyle={styles.editInput}
                        keyboardType="numeric"
                        label={t('reps')}
                        onChangeText={(text) => handleFormatNumericText(text, 'reps')}
                        placeholder={t('enter_reps')}
                        value={reps}
                        wrapperStyle={styles.editInputWrapper}
                    />
                    <TouchableOpacity
                        hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
                        onPress={() => setReps((prev) => (Number(prev) + 1).toString())}
                    >
                        <FontAwesome color={colors.shadow} name="plus" size={26} />
                    </TouchableOpacity>
                </View>
            </View>
            <View style={styles.modalRow}>
                <View style={styles.modalInputContainer}>
                    <TouchableOpacity
                        hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
                        onPress={() => setWeight((prev) => Math.max(0, Number(prev) - 1).toString())}
                    >
                        <FontAwesome color={colors.shadow} name="minus" size={26} />
                    </TouchableOpacity>
                    <CustomTextInput
                        inputStyle={styles.editInput}
                        keyboardType="numeric"
                        label={t('weight', { weightUnit })}
                        onChangeText={(text) => handleFormatNumericText(text, 'weight')}
                        placeholder={t('enter_weight')}
                        value={weight}
                        wrapperStyle={styles.editInputWrapper}
                    />
                    <TouchableOpacity
                        hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
                        onPress={() => setWeight((prev) => (Number(prev) + 1).toString())}
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

export default EditSetModal;
