import MaterialIcons from '@react-native-vector-icons/material-icons/static';
import { Info } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { CircadianScienceModal } from '@/components/modals/CircadianScienceModal';
import { useCircadianBurn } from '@/hooks/useCircadianBurn';
import { useEmpiricalTDEE } from '@/hooks/useEmpiricalTDEE';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './GenericCard';

export function CaloriesBurnedCard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const { tdee } = useEmpiricalTDEE();

  const [modalVisible, setModalVisible] = useState(false);

  const { blockKey: currentBlockKey, burned, dayProgress } = useCircadianBurn(tdee);
  const caloriesBurned = Math.round(burned);

  return (
    <>
      <GenericCard variant="flat">
        <View className="flex flex-col gap-1 p-6">
          {/* Header row */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <MaterialIcons
                name="local-fire-department"
                size={theme.iconSize.lg}
                color={theme.colors.accent.primary}
              />
              <Text className="text-sm font-medium" style={{ color: theme.colors.accent.primary }}>
                {t('progress.caloriesBurnedToday')}
              </Text>
            </View>
            <Pressable onPress={() => setModalVisible(true)} hitSlop={12} style={{ padding: 4 }}>
              <Info size={16} color={theme.colors.text.secondary} />
            </Pressable>
          </View>

          <Text className="text-3xl font-bold tracking-tight text-text-primary">
            {formatInteger(caloriesBurned)}{' '}
            <Text className="text-lg font-normal text-text-secondary">{t('progress.kcal')}</Text>
          </Text>

          <Text className="mt-1 text-sm text-text-secondary">
            {t('progress.caloriesBurnedSubtitle', { tdee: formatInteger(tdee) })}
          </Text>

          <View
            className="mt-4 overflow-hidden rounded-full"
            style={{ height: 4, backgroundColor: theme.colors.background.ink5 }}
          >
            <View
              className="h-full rounded-full"
              style={{
                width: `${Math.round(dayProgress * 100)}%`,
                backgroundColor: theme.colors.accent.primary,
              }}
            />
          </View>

          <View className="mt-2 flex-row items-center justify-between">
            <Text
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: theme.colors.text.secondary }}
            >
              {t('progress.caloriesBurnedProgress', {
                percent: Math.round(dayProgress * 100),
              })}
            </Text>
            <Text
              className="text-[10px] font-semibold"
              style={{ color: theme.colors.accent.primary }}
            >
              {t(`progress.circadianPhase.${currentBlockKey}`)}
            </Text>
          </View>
        </View>
      </GenericCard>

      <CircadianScienceModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        tdee={tdee}
      />
    </>
  );
}
