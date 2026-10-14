import { useRouter } from 'expo-router';
import { CheckCircle, CircleDot, Plus, Settings, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { ContextTimeline } from '@/components/cycle/ContextTimeline';
import { CycleCalendar } from '@/components/cycle/CycleCalendar';
import { CycleComparison } from '@/components/cycle/CycleComparison';
import { CycleDaySheet } from '@/components/cycle/CycleDaySheet';
import { CycleInsightsCard } from '@/components/cycle/CycleInsightsCard';
import { DayLogSummary } from '@/components/cycle/DayLogSummary';
import { PeriodHistoryList } from '@/components/cycle/PeriodHistoryList';
import { PinSuggestionCard } from '@/components/cycle/PinSuggestionCard';
import { PredictionCard } from '@/components/cycle/PredictionCard';
import { PredictionDetailsSheet } from '@/components/cycle/PredictionDetailsSheet';
import { QuickLogRow } from '@/components/cycle/QuickLogRow';
import { DateNavigator } from '@/components/DateNavigator';
import { CycleLockGate } from '@/components/lock/CycleLockGate';
import { MasterLayout } from '@/components/MasterLayout';
import { CycleContextModal } from '@/components/modals/CycleContextModal';
import { CycleSettingsModal } from '@/components/modals/CycleSettingsModal';
import { EditPeriodModal } from '@/components/modals/EditPeriodModal';
import { PeriodLogModal } from '@/components/modals/PeriodLogModal';
import { PhaseWheel } from '@/components/PhaseWheel';
import { AnimatedContent } from '@/components/theme/AnimatedContent';
import { Button } from '@/components/theme/Button';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import { TextButton } from '@/components/theme/TextButton';
import { type PeriodLogMode } from '@/constants/cycle';
import { useCycleMoods } from '@/hooks/useCycleMoods';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import {
  localCalendarDayDate,
  localDayStartFromUtcMs,
  localDayStartMs,
  MS_PER_SOLAR_DAY,
} from '@/utils/calendarDate';
import type { CycleContextDto, CyclePeriodDto } from '@/utils/cycle/types';

type HistoryTab = 'calendar' | 'history' | 'comparison';

export default function CycleScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { formatInteger } = useFormatAppNumber();
  const { cycleShowFertility } = useSettings();
  const {
    cycle,
    pausedCycle,
    resumeTracking,
    cycleDay,
    currentPhase,
    timeline,
    predictionState,
    predictionStats,
    activePeriod,
    isCurrentlyInPeriod,
    periods,
    history,
    dayLogs,
    contexts,
    guidance,
    nowMs,
  } = useMenstrualCycle();

  const { moods } = useCycleMoods();
  const [tab, setTab] = useState<HistoryTab>('calendar');
  const [selectedDate, setSelectedDate] = useState(() => localCalendarDayDate(new Date()));
  const [daySheetOpen, setDaySheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [periodMode, setPeriodMode] = useState<PeriodLogMode>('start');
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [editing, setEditing] = useState<CyclePeriodDto | null>(null);
  const [contextEditing, setContextEditing] = useState<CycleContextDto | null>(null);
  const [contextOpen, setContextOpen] = useState(false);

  const day = localDayStartMs(selectedDate);
  const avgCycleLength = predictionStats.medianLength;
  const isOverdue = predictionState === 'late';
  const latestStart = periods.reduce((max, p) => Math.max(max, p.startDate), 0);

  const showFertile = cycleShowFertility === true && timeline?.fertileEstimate != null;
  const editingIsLatest = editing?.startDate === latestStart;

  const openPeriod = (mode: PeriodLogMode) => {
    setPeriodMode(mode);
    setPeriodModalOpen(true);
  };

  const startTracking = () => {
    router.navigate({
      pathname: '/app/onboarding/cycle-setup',
      params: { nextRoute: encodeURIComponent('/app/cycle') },
    } as never);
  };

  const dayCounter = () => {
    if (cycleDay == null) {
      return '--';
    }

    const padded = cycleDay.toString().padStart(2, '0');

    // Past the average length the "/28" denominator would be wrong, so show the plain count.
    return cycleDay > avgCycleLength ? padded : `${padded}/${avgCycleLength}`;
  };

  return (
    <MasterLayout>
      <CycleLockGate>
        <KeyboardAwareScrollView
          bottomOffset={16}
          className="flex-1"
          showsVerticalScrollIndicator={false}
        >
          <AnimatedContent>
            <View className="px-4 py-8">
              <View className="mb-6 flex-row items-center justify-between">
                <Text className="flex-1 text-4xl font-black text-text-primary">
                  {t('cycle.title')}
                </Text>
                <Pressable
                  onPress={() => setSettingsOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('cycle.settings.title')}
                  className="h-10 w-10 items-center justify-center rounded-full bg-bg-overlay"
                  hitSlop={8}
                >
                  <Settings size={20} color={theme.colors.text.secondary} />
                </Pressable>
              </View>

              {!cycle ? (
                <View className="mb-8 items-center rounded-2xl bg-bg-overlay p-8">
                  <Sparkles size={40} color={theme.colors.text.secondary} />
                  <Text className="mt-4 text-center text-lg font-bold text-text-primary">
                    {pausedCycle ? t('cycle.noData.pausedTitle') : t('cycle.noData.title')}
                  </Text>
                  <Text className="mt-2 text-center text-sm text-text-secondary">
                    {pausedCycle
                      ? t('cycle.noData.pausedDescription')
                      : t('cycle.noData.description')}
                  </Text>
                  <View className="mt-6 w-full">
                    <Button
                      label={pausedCycle ? t('cycle.noData.resume') : t('cycle.noData.start')}
                      onPress={pausedCycle ? () => void resumeTracking() : startTracking}
                      variant="accent"
                      width="full"
                    />
                  </View>
                </View>
              ) : (
                <>
                  <View className="mb-6 flex-row items-center justify-between">
                    <View className="rounded-2xl bg-bg-overlay px-4 py-3">
                      <Text className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
                        {t('focus.day')}
                      </Text>
                      <Text className="text-2xl font-black text-accent-primary">
                        {dayCounter()}
                      </Text>
                      {isOverdue ? (
                        <Text className="text-xs text-text-tertiary">
                          {t('cycle.periodNotLogged')}
                        </Text>
                      ) : null}
                    </View>
                    <View className="items-end">
                      <Text className="text-sm font-bold uppercase tracking-widest text-accent-primary">
                        {t('focus.currentPhase')}
                      </Text>
                      <Text className="text-2xl font-black capitalize text-text-primary">
                        {currentPhase ? t(`cycle.phase.${currentPhase}`) : '--'}
                      </Text>
                    </View>
                  </View>

                  <View className="mb-8 items-center justify-center">
                    <PhaseWheel
                      currentPhase={currentPhase}
                      cycleDay={cycleDay ?? 1}
                      totalDays={avgCycleLength}
                      segments={timeline?.segments ?? null}
                    />
                  </View>

                  {guidance.hidePeriodActions ? null : (
                    <View className="mb-6 gap-3">
                      {isCurrentlyInPeriod ? (
                        <>
                          <View
                            className="flex-row items-center gap-3 rounded-2xl px-4 py-3"
                            style={{ backgroundColor: theme.colors.rose.brand10 }}
                          >
                            <CircleDot size={16} color={theme.colors.rose.brand} />
                            <Text
                              className="text-sm font-semibold"
                              style={{ color: theme.colors.rose.brand }}
                            >
                              {activePeriod
                                ? t('cycle.periodActive', {
                                    day: formatInteger(
                                      Math.round(
                                        (localDayStartFromUtcMs(nowMs) - activePeriod.startDate) /
                                          MS_PER_SOLAR_DAY
                                      ) + 1
                                    ),
                                  })
                                : t('cycle.periodActiveGeneric')}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => openPeriod('end')}
                            className="flex-row items-center justify-center gap-2 rounded-2xl border-2 px-4 py-4"
                            style={{ borderColor: theme.colors.rose.brand }}
                          >
                            <CheckCircle size={20} color={theme.colors.rose.brand} />
                            <Text className="font-bold" style={{ color: theme.colors.rose.brand }}>
                              {t('cycle.actions.periodEnded')}
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity
                          onPress={() => openPeriod('start')}
                          className="flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4"
                          style={{ backgroundColor: theme.colors.rose.brand }}
                        >
                          <CircleDot size={20} color={theme.colors.text.alwaysWhite} />
                          <Text className="font-bold text-text-always-white">
                            {t('cycle.actions.periodStarted')}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  <PredictionCard onOpenDetails={() => setDetailsOpen(true)} />

                  <View className="mb-6">
                    <DateNavigator selectedDate={selectedDate} onDateChange={setSelectedDate} />
                  </View>

                  <View className="mb-6 gap-4">
                    <QuickLogRow day={day} />
                    <DayLogSummary
                      log={dayLogs.find((log) => log.date === day)}
                      mood={moods.find((m) => m.date === day)?.value}
                      onEdit={() => setDaySheetOpen(true)}
                    />
                  </View>

                  <PinSuggestionCard />
                  <CycleInsightsCard />

                  <View className="mb-4 flex-row items-center justify-between">
                    <Text className="text-2xl font-bold text-text-primary">
                      {t('cycle.history.title')}
                    </Text>
                    <Pressable
                      onPress={() => openPeriod('past')}
                      accessibilityRole="button"
                      accessibilityLabel={t('cycle.actions.logPastPeriod')}
                      className="h-10 w-10 items-center justify-center rounded-full bg-accent-primary"
                    >
                      <Plus size={24} color={theme.colors.text.onAccent} />
                    </Pressable>
                  </View>

                  <View className="mb-4">
                    <SegmentedControl
                      options={[
                        { label: t('cycle.history.tabCalendar'), value: 'calendar' },
                        { label: t('cycle.history.tabHistory'), value: 'history' },
                        { label: t('cycle.comparison.tab'), value: 'comparison' },
                      ]}
                      value={tab}
                      onValueChange={(value) => setTab(value as HistoryTab)}
                    />
                  </View>

                  {tab === 'calendar' ? (
                    <CycleCalendar
                      periods={periods}
                      dayLogs={dayLogs}
                      timeline={timeline}
                      nowMs={nowMs}
                      selectedDay={day}
                      showFertile={showFertile}
                      onSelectDay={(selected) => {
                        setSelectedDate(localCalendarDayDate(new Date(selected)));
                        setDaySheetOpen(true);
                      }}
                    />
                  ) : null}
                  {tab === 'comparison' ? (
                    <CycleComparison
                      onSelectDay={(selected) => {
                        setSelectedDate(new Date(selected));
                        setDaySheetOpen(true);
                      }}
                    />
                  ) : null}
                  {tab === 'history' ? (
                    <View>
                      <PeriodHistoryList periods={periods} history={history} onEdit={setEditing} />
                      <ContextTimeline
                        contexts={contexts}
                        onEdit={(context) => {
                          setContextEditing(context);
                          setContextOpen(true);
                        }}
                      />
                      <View className="mt-4">
                        <TextButton
                          label={t('cycle.settings.changeContext')}
                          onPress={() => {
                            setContextEditing(null);
                            setContextOpen(true);
                          }}
                        />
                      </View>
                    </View>
                  ) : null}
                </>
              )}
            </View>
            <View pointerEvents="none" style={{ height: theme.spacing.margin.base }} />
          </AnimatedContent>
        </KeyboardAwareScrollView>
      </CycleLockGate>

      <CycleDaySheet visible={daySheetOpen} onClose={() => setDaySheetOpen(false)} day={day} />
      <PeriodLogModal
        visible={periodModalOpen}
        onClose={() => setPeriodModalOpen(false)}
        mode={periodMode}
        initialDate={selectedDate}
      />
      <EditPeriodModal
        visible={editing != null}
        onClose={() => setEditing(null)}
        period={editing}
        isLatest={editingIsLatest}
      />
      <PredictionDetailsSheet visible={detailsOpen} onClose={() => setDetailsOpen(false)} />
      <CycleContextModal
        visible={contextOpen}
        onClose={() => setContextOpen(false)}
        context={contextEditing}
      />
      <CycleSettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </MasterLayout>
  );
}
