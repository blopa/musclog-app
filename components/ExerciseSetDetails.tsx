import { ICON_SIZE } from '@/constants/ui';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { ExerciseVolumeSetType } from '@/utils/types';
import { FontAwesome5 } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

const ExerciseSetDetails: React.FC<{
    onDeleteSet?: (setIndex: number, setId?: number) => void;
    onEditSet?: (setIndex: number, setId?: number) => void;
    set: ExerciseVolumeSetType;
    setIndex: number;
    showBorder?: boolean;
}> = ({ onDeleteSet, onEditSet, set, setIndex, showBorder = false }) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const { weightUnit } = useUnit();
    const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);

    return (
        <View key={setIndex} style={[styles.setContainer, showBorder ? styles.setContainerBorder : undefined]}>
            <View style={styles.setHeader}>
                <Text style={styles.setSubtitle}>
                    {t('set')} #{setIndex + 1}
                </Text>
                <View style={styles.crudButtons}>
                    {onEditSet ? (
                        <FontAwesome5
                            color={colors.primary}
                            name="edit"
                            onPress={() => onEditSet(setIndex, set.id)}
                            size={ICON_SIZE}
                            style={styles.crudButton}
                        />
                    ) : null}
                    {onDeleteSet ? (
                        <FontAwesome5
                            color={colors.primary}
                            name="trash"
                            onPress={() => onDeleteSet(setIndex, set.id)}
                            size={ICON_SIZE}
                            style={styles.crudButton}
                        />
                    ) : null}
                </View>
            </View>
            <View style={styles.setDetails}>
                {Number(set.weight) > 0 ? (
                    <Text style={styles.exerciseDetail}>
                        {t('weight', { weightUnit })}: {set.weight}
                    </Text>
                ) : null}
                {set.targetWeight ? (
                    <Text style={styles.exerciseDetail}>
                        {t('target_weight', { weightUnit })}: {set.targetWeight}
                    </Text>
                ) : null}
                <Text style={styles.exerciseDetail}>
                    {t('reps')}: {set.reps}
                </Text>
                {set.targetReps ? (
                    <Text style={styles.exerciseDetail}>
                        {t('target_reps')}: {set.targetReps}
                    </Text>
                ) : null}
                <Text style={styles.exerciseDetail}>
                    {t('rest_time')}: {set.restTime}s
                </Text>
                {set.difficultyLevel ? (
                    <Text style={styles.exerciseDetail}>
                        {t('difficulty_level')}: {t('out_of_ten_short', { number: set.difficultyLevel })}
                    </Text>
                ) : null}
                {set.isDropSet ? (
                    <Text style={styles.exerciseDetail}>
                        {t('drop_set')}: {t('yes')}
                    </Text>
                ) : null}
            </View>
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    crudButton: {
        marginLeft: 10,
    },
    crudButtons: {
        flexDirection: 'row',
        letterSpacing: 14,
    },
    exerciseDetail: {
        color: colors.onSurface,
        fontSize: 14,
        width: '48%',
    },
    setContainer: {
        width: '100%',
    },
    setContainerBorder: {
        borderColor: colors.shadow,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
        padding: 8,
    },
    setDetails: {
        backgroundColor: colors.inverseOnSurface,
        borderRadius: 8,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 8,
        padding: 12,
    },
    setHeader: {
        backgroundColor: colors.surface,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    setSubtitle: {
        color: colors.onSurface,
        fontSize: 14,
        fontWeight: 'bold',
        margin: 5,
    },
});

export default ExerciseSetDetails;
