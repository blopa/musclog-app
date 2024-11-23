import { IMPERIAL_SYSTEM } from '@/constants/storage';
import useUnit from '@/hooks/useUnit';
import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { ExerciseReturnType } from '@/utils/types';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

type SetInfoProps = {
    completedReps: string;
    currentSetIndex: number;
    exercise?: ExerciseReturnType;
    imageUrl: string;
    setsLength: number;
    weightLifted: string;
    weightUnit: string;
};

const SetInfo = ({
    completedReps,
    currentSetIndex,
    exercise,
    imageUrl,
    setsLength,
    weightLifted,
    weightUnit,
}: SetInfoProps) => {
    const { t } = useTranslation();
    const { colors, dark } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors, dark);
    const { unitSystem } = useUnit();

    const isWeightValid = useCallback((weight: string) => {
        return weight && Number(weight) > 0;
    }, []);

    return (
        <>
            <Text style={styles.title}>{exercise?.name}</Text>
            <Text style={styles.subTitle}>{t('set_count', { current: currentSetIndex + 1, total: setsLength })}</Text>
            <Image source={{ uri: imageUrl }} style={styles.workoutImage} />
            <View style={styles.infoContainer}>
                {isWeightValid(weightLifted) ? (
                    <View style={styles.infoRow}>
                        <MaterialCommunityIcons
                            color={colors.onSurface}
                            name={unitSystem === IMPERIAL_SYSTEM ? 'weight-pound' : 'weight-kilogram'}
                            size={30}
                            style={styles.infoIcon}
                        />
                        <Text style={styles.infoLabel}>{t('weight', { weightUnit })}:</Text>
                        <Text style={styles.infoValue}>{weightLifted} {weightUnit}</Text>
                    </View>
                ) : null}
                <View style={styles.infoRow}>
                    <FontAwesome color={colors.onSurface} name="repeat" size={30} style={styles.infoIcon} />
                    <Text style={styles.infoLabel}>{t('reps')}:</Text>
                    <Text style={styles.infoValue}>{completedReps}</Text>
                </View>
            </View>
        </>
    );
};

const makeStyles = (colors: CustomThemeColorsType, dark: boolean) => StyleSheet.create({
    infoContainer: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: dark ? '#333' : '#ccc',
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
        shadowColor: colors.shadow,
        shadowOffset: { height: 2, width: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
        width: '100%',
    },
    infoIcon: {
        marginTop: -4,
    },
    infoLabel: {
        color: colors.onSurface,
        flex: 1,
        fontSize: 18,
        marginLeft: 12,
        textAlign: 'left',
    },
    infoRow: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 4,
        paddingHorizontal: 10,
        width: '100%',
    },
    infoValue: {
        color: colors.onSurface,
        flex: 1,
        fontSize: 26,
        fontWeight: 'bold',
        lineHeight: 30,
        textAlign: 'right',
    },
    subTitle: {
        color: colors.onBackground,
        fontSize: 20,
        marginBottom: 16,
    },
    title: {
        color: colors.onBackground,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    workoutImage: {
        borderRadius: 12,
        height: 200,
        marginBottom: 16,
        shadowColor: colors.shadow,
        shadowOffset: { height: 2, width: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
        width: 250,
    },
});

export default SetInfo;
