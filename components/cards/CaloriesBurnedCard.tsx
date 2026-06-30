import MaterialIcons from '@react-native-vector-icons/material-icons/static';
import { Info } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { CircadianScienceModal } from '@/components/modals/CircadianScienceModal';
import { BLOCK_DURATION, BLOCK_FRACTIONS } from '@/constants/circadian';
import { useEmpiricalTDEE } from '@/hooks/useEmpiricalTDEE';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { localDayStartMs } from '@/utils/calendarDate';

import { GenericCard } from './GenericCard';

// Segments in minutes-since-midnight order.
// `rate` = fraction of TDEE burned per minute within this segment.
const CIRCADIAN_SEGMENTS = [
  { start: 0, end: 180, rate: BLOCK_FRACTIONS.earlySlеep / BLOCK_DURATION, blockKey: 'earlySlеep' },
  { start: 180, end: 420, rate: BLOCK_FRACTIONS.nadir / BLOCK_DURATION, blockKey: 'nadir' },
  { start: 420, end: 660, rate: BLOCK_FRACTIONS.morning / BLOCK_DURATION, blockKey: 'morning' },
  { start: 660, end: 900, rate: BLOCK_FRACTIONS.midday / BLOCK_DURATION, blockKey: 'midday' },
  { start: 900, end: 1140, rate: BLOCK_FRACTIONS.peak / BLOCK_DURATION, blockKey: 'peak' },
  { start: 1140, end: 1380, rate: BLOCK_FRACTIONS.evening / BLOCK_DURATION, blockKey: 'evening' },
  {
    start: 1380,
    end: 1440,
    rate: BLOCK_FRACTIONS.earlySlеep / BLOCK_DURATION,
    blockKey: 'earlySlеep',
  },
] as const;

function getCircadianCaloriesBurned(tdee: number, minutesSinceMidnight: number): number {
  let burned = 0;
  for (const seg of CIRCADIAN_SEGMENTS) {
    if (minutesSinceMidnight <= seg.start) {
      break;
    }
    const elapsed = Math.min(minutesSinceMidnight, seg.end) - seg.start;
    burned += elapsed * seg.rate * tdee;
  }
  return Math.round(burned);
}

function getCurrentBlockKey(minutesSinceMidnight: number): string {
  for (const seg of CIRCADIAN_SEGMENTS) {
    if (minutesSinceMidnight < seg.end) {
      return seg.blockKey;
    }
  }
  return CIRCADIAN_SEGMENTS[CIRCADIAN_SEGMENTS.length - 1].blockKey;
}

function getMinutesSinceMidnight(): number {
  return (Date.now() - localDayStartMs(new Date())) / 60_000;
}

export function CaloriesBurnedCard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const { tdee } = useEmpiricalTDEE();

  const [minutesSinceMidnight, setMinutesSinceMidnight] = useState(getMinutesSinceMidnight);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setMinutesSinceMidnight(getMinutesSinceMidnight());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const caloriesBurned = getCircadianCaloriesBurned(tdee, minutesSinceMidnight);
  const dayProgress = Math.min(minutesSinceMidnight / 1440, 1);
  const currentBlockKey = getCurrentBlockKey(minutesSinceMidnight);

  return (
    <>
      <GenericCard variant="card" backgroundVariant="gradient" size="default">
        <View className="relative z-10 flex flex-col gap-1 p-6">
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

          <Text className="text-3xl font-bold tracking-tight text-white">
            {formatInteger(caloriesBurned)}{' '}
            <Text className="text-lg font-normal text-text-secondary">{t('progress.kcal')}</Text>
          </Text>

          <Text className="mt-1 text-sm text-text-secondary">
            {t('progress.caloriesBurnedSubtitle', { tdee: formatInteger(tdee) })}
          </Text>

          <View
            className="mt-4 overflow-hidden rounded-full"
            style={{ height: 4, backgroundColor: theme.colors.background.white5 }}
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
