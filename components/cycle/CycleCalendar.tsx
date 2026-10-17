import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { localDayStartFromUtcMs } from '@/utils/calendarDate';
import {
  calendarMarkers,
  describeMarkers,
  type MarkerDescriptor,
} from '@/utils/cycle/calendarMarkers';
import type { CycleTimeline } from '@/utils/cycle/cycleTimeline';
import type { CycleDayLogDto, CyclePeriodInput } from '@/utils/cycle/types';
import { monthGridDays, weekdayDates } from '@/utils/monthGrid';

type CycleCalendarProps = {
  periods: CyclePeriodInput[];
  dayLogs: CycleDayLogDto[];
  timeline: CycleTimeline | null;
  /** Local midnight ms of today. */
  today: number;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  showFertile: boolean;
};

const CELL = 36;
const MAX_MONTHS_AHEAD = 3;

/**
 * Month calendar of what was LOGGED (filled and outlined marks) and what is ESTIMATED (dashed
 * outline, underline bar). Every mark has a different shape and a word in the legend, and every
 * day has a spoken description, so nothing depends on telling pink from green.
 */
export function CycleCalendar({
  periods,
  dayLogs,
  timeline,
  today,
  selectedDay,
  onSelectDay,
  showFertile,
}: CycleCalendarProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [month, setMonth] = useState(() => new Date(today));

  const markersFor = useMemo(
    () => calendarMarkers({ periods, dayLogs, timeline, today }),
    [periods, dayLogs, timeline, today]
  );
  const days = useMemo(() => monthGridDays(month), [month]);
  const weekdays = useMemo(() => weekdayDates(new Date(today)), [today]);
  const lastMonth = useMemo(() => {
    const limit = new Date(today);
    limit.setMonth(limit.getMonth() + MAX_MONTHS_AHEAD);

    return limit;
  }, [today]);

  const rose = theme.colors.rose.brand;
  const cellBorderColor = (selected: boolean, roseRing: boolean) => {
    if (selected) {
      return theme.colors.accent.primary;
    }

    return roseRing ? rose : theme.colors.text.tertiary;
  };

  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    month
  );
  const canGoForward =
    month.getFullYear() * 12 + month.getMonth() <
    lastMonth.getFullYear() * 12 + lastMonth.getMonth();

  const shift = (delta: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  const describe = (part: MarkerDescriptor): string => {
    switch (part.kind) {
      case 'bleeding':
        return t(`cycle.calendar.bleeding.${part.level}`);
      case 'period':
        return t('cycle.calendar.a11y.period');
      case 'predicted':
        return t('cycle.calendar.a11y.predicted');
      case 'fertile':
        return t('cycle.calendar.a11y.fertile');
      case 'observation':
        return t('cycle.calendar.a11y.observation');
    }
  };

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between">
        <Pressable
          onPress={() => shift(-1)}
          accessibilityRole="button"
          accessibilityLabel={t('cycle.calendar.previousMonth')}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center"
        >
          <ChevronLeft size={22} color={theme.colors.text.secondary} />
        </Pressable>
        <Text
          className="text-base font-bold capitalize text-text-primary"
          accessibilityRole="header"
        >
          {monthLabel}
        </Text>
        <Pressable
          onPress={() => shift(1)}
          disabled={!canGoForward}
          accessibilityRole="button"
          accessibilityLabel={t('cycle.calendar.nextMonth')}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center"
          style={{ opacity: canGoForward ? 1 : 0.3 }}
        >
          <ChevronRight size={22} color={theme.colors.text.secondary} />
        </Pressable>
      </View>

      <View className="flex-row">
        {weekdays.map((d) => (
          <View key={d.getDay()} style={{ width: '14.2857%' }} className="items-center pb-1">
            <Text className="text-[11px] font-bold uppercase text-text-tertiary">
              {new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(d)}
            </Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {days.map(({ date, inMonth }) => {
          const day = localDayStartFromUtcMs(date.getTime());
          const m = markersFor(day);
          const spotting = m.bleeding === 'spotting' && !m.period;
          const filled = m.period || (m.bleeding != null && m.bleeding !== 'spotting');
          const isToday = day === today;
          const isSelected = day === selectedDay;
          const parts = describeMarkers(m).map(describe);
          const label = [
            new Intl.DateTimeFormat(locale, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            }).format(date),
            ...(isToday ? [t('cycle.calendar.a11y.today')] : []),
            ...(parts.length > 0 ? parts : [t('cycle.calendar.a11y.nothing')]),
          ].join(', ');

          return (
            <Pressable
              key={day}
              onPress={() => onSelectDay(day)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: isSelected }}
              style={{
                width: '14.2857%',
                alignItems: 'center',
                paddingVertical: 3,
                opacity: inMonth ? 1 : 0.35,
              }}
            >
              <View
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: CELL / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: filled ? rose : 'transparent',
                  borderWidth: spotting || m.predicted || isSelected || isToday ? 2 : 0,
                  borderStyle: m.predicted && !spotting ? 'dashed' : 'solid',
                  borderColor: cellBorderColor(isSelected, spotting || m.predicted),
                }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{
                    color: filled ? theme.colors.text.alwaysWhite : theme.colors.text.primary,
                  }}
                >
                  {formatInteger(date.getDate())}
                </Text>
              </View>
              <View
                style={{
                  height: 6,
                  marginTop: 2,
                  flexDirection: 'row',
                  gap: 3,
                  alignItems: 'center',
                }}
              >
                {showFertile && m.fertile ? (
                  <View
                    style={{
                      width: 12,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: theme.colors.status.info,
                    }}
                  />
                ) : null}
                {m.observation ? (
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: theme.colors.text.secondary,
                    }}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View
        className="mt-3 flex-row flex-wrap gap-x-4 gap-y-2"
        accessibilityLabel={t('cycle.calendar.legend')}
      >
        <LegendItem label={t('cycle.calendar.legendPeriod')}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: rose }} />
        </LegendItem>
        <LegendItem label={t('cycle.calendar.legendSpotting')}>
          <View
            style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: rose }}
          />
        </LegendItem>
        <LegendItem label={t('cycle.calendar.legendPredicted')}>
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: rose,
            }}
          />
        </LegendItem>
        {showFertile ? (
          <LegendItem label={t('cycle.calendar.legendFertile')}>
            <View
              style={{
                width: 14,
                height: 3,
                borderRadius: 2,
                backgroundColor: theme.colors.status.info,
              }}
            />
          </LegendItem>
        ) : null}
        <LegendItem label={t('cycle.calendar.legendLogged')}>
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: theme.colors.text.secondary,
            }}
          />
        </LegendItem>
      </View>
    </View>
  );
}

function LegendItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center gap-2">
      {children}
      <Text className="text-xs text-text-secondary">{label}</Text>
    </View>
  );
}
