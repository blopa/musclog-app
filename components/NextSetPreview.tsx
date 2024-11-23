import { CustomThemeColorsType, CustomThemeType } from '@/utils/colors';
import { ExerciseReturnType, SetReturnType } from '@/utils/types';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

type NextSetPreviewProps = {
    exercise: ExerciseReturnType | undefined;
    nextSet: SetReturnType;
    style?: ViewStyle;
    weightUnit: string;
};

const NextSetPreview = ({ exercise, nextSet, style, weightUnit }: NextSetPreviewProps) => {
    const { colors } = useTheme<CustomThemeType>();
    const styles = makeStyles(colors);
    const { t } = useTranslation();

    return (
        <View style={[styles.container, style]}>
            <Text style={styles.title}>{t('next_set')}</Text>
            <Text style={styles.exerciseName}>
                {t('set_info', {
                    exerciseName: exercise?.name,
                    reps: nextSet.reps,
                    weight: nextSet.weight,
                    weightUnit,
                })}
            </Text>
        </View>
    );
};

const makeStyles = (colors: CustomThemeColorsType) => StyleSheet.create({
    container: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 8,
        justifyContent: 'center',
        marginVertical: 8,
        padding: 8,
        width: '80%',
    },
    exerciseName: {
        color: colors.onSurface,
    },
    title: {
        color: colors.onSurface,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
});

export default NextSetPreview;
