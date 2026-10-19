import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarHeart, CheckCircle, CircleDot, Plus, Settings } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { AppointmentSummarySheet } from '@/components/cycle/AppointmentSummarySheet';
import { ContextTimeline } from '@/components/cycle/ContextTimeline';
import { CycleCalendar } from '@/components/cycle/CycleCalendar';
import { CycleCareCard } from '@/components/cycle/CycleCareCard';
import { CycleComparison } from '@/components/cycle/CycleComparison';
import { CycleDaySheet } from '@/components/cycle/CycleDaySheet';
import { CycleInsightsCard } from '@/components/cycle/CycleInsightsCard';
import { CycleTrends } from '@/components/cycle/CycleTrends';
import { DayLogSummary } from '@/components/cycle/DayLogSummary';
import { PeriodHistoryList } from '@/components/cycle/PeriodHistoryList';
import { PinSuggestionCard } from '@/components/cycle/PinSuggestionCard';
import { PredictionCard } from '@/components/cycle/PredictionCard';
import { PredictionDetailsSheet } from '@/components/cycle/PredictionDetailsSheet';
import { QuickLogRow } from '@/components/cycle/QuickLogRow';
import { ReminderExplainerSheet } from '@/components/cycle/ReminderExplainerSheet';
import { DateNavigator } from '@/components/DateNavigator';
import { AreaLockGate } from '@/components/lock/AreaLockGate';
import { MasterLayout } from '@/components/MasterLayout';
import { CycleContextModal } from '@/components/modals/CycleContextModal';
import { CyclePortabilityModal } from '@/components/modals/CyclePortabilityModal';
import { CycleSettingsModal } from '@/components/modals/CycleSettingsModal';
import { EditPeriodModal } from '@/components/modals/EditPeriodModal';
import { PeriodLogModal } from '@/components/modals/PeriodLogModal';
import { PhaseWheel } from '@/components/PhaseWheel';
import { AnimatedContent } from '@/components/theme/AnimatedContent';
import { Button } from '@/components/theme/Button';
import { IconButton } from '@/components/theme/IconButton';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import { TextButton } from '@/components/theme/TextButton';
import { CYCLE_PHASE_LABEL_KEYS, type PeriodLogMode } from '@/constants/cycle';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { localCalendarDayDate, localDayStartMs } from '@/utils/calendarDate';
import { type CycleReminderKind, isCycleReminderKind } from '@/utils/cycle/cycleReminders';
import type { CycleContextDto, CyclePeriodDto } from '@/utils/cycle/types';

type HistoryTab = 'calendar' | 'history' | 'comparison' | 'trends';

/**
 * One sheet or modal at a time. A flag per surface let several be "open" at once and put seven
 * modals side by side, the shape iOS drops modals for (see `local/no-sibling-modals`).
 */
type Panel =
  | { kind: 'day' }
  | { kind: 'restore' }
  | { kind: 'settings' }
  | { kind: 'details' }
  | { kind: 'appointment' }
  | { kind: 'period'; mode: PeriodLogMode }
  | { kind: 'editPeriod'; period: CyclePeriodDto }
  | { kind: 'context'; context: CycleContextDto | null }
  | { kind: 'why'; reminder: CycleReminderKind };

export default function CycleScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { reminder } = useLocalSearchParams<{ reminder?: string }>();
  const { formatInteger } = useFormatAppNumber();
  const { cycleShowFertility } = useSettings();
  const {
    cycle,
    pausedCycle,
    resumeTracking,
    timeline,
    predictionStats,
    activePeriod,
    periods,
    history,
    dayLogs,
    contexts,
    moods,
    guidance,
    today,
  } = useMenstrualCycle();

  const [tab, setTab] = useState<HistoryTab>('calendar');
  const [selectedDate, setSelectedDate] = useState(() => localCalendarDayDate(new Date()));
  // The last panel stays mounted after it closes, so its closing animation can play.
  const [panel, setPanelState] = useState<Panel | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const setPanel = (next: Panel) => {
    setPanelState(next);
    setPanelOpen(true);
  };

  // A tapped reminder lands here with `?reminder=<kind>`: explain it once, then drop the param so
  // returning to the screen does not reopen the sheet. Adjusting state during render rather than
  // in an effect, so the sheet is part of the first frame.
  const [handledReminder, setHandledReminder] = useState<string | undefined>(undefined);
  if (reminder !== handledReminder) {
    setHandledReminder(reminder);
    if (reminder && isCycleReminderKind(reminder)) {
      setPanel({ kind: 'why', reminder });
    }
  }

  const close = () => {
    setPanelOpen(false);
    if (reminder) {
      router.setParams({ reminder: undefined });
    }
  };

  const day = localDayStartMs(selectedDate);
  const cycleDay = timeline?.elapsedDay ?? null;
  const currentPhase = timeline?.currentPhase ?? null;
  const avgCycleLength = predictionStats.medianLength;
  const isOverdue = timeline?.prediction.state === 'late';
  const latestStart = periods.reduce((max, p) => Math.max(max, p.startDate), 0);
  const showFertile = cycleShowFertility && timeline?.fertileEstimate != null;

  const openDay = (selected: number) => {
    setSelectedDate(localCalendarDayDate(new Date(selected)));
    setPanel({ kind: 'day' });
  };

  const startTracking = () => {
    router.navigate({
      pathname: '/app/onboarding/cycle-setup',
      params: { nextRoute: encodeURIComponent('/app/cycle') },
    } as never);
  };

  const renderPanel = () => {
    switch (panel?.kind) {
      case 'day':
        return <CycleDaySheet visible={panelOpen} onClose={close} day={day} />;
      case 'restore':
        return <CyclePortabilityModal visible={panelOpen} onClose={close} />;
      case 'settings':
        return <CycleSettingsModal visible={panelOpen} onClose={close} />;
      case 'details':
        return <PredictionDetailsSheet visible={panelOpen} onClose={close} />;
      case 'appointment':
        return <AppointmentSummarySheet visible={panelOpen} onClose={close} />;
      case 'period':
        return (
          <PeriodLogModal
            visible={panelOpen}
            onClose={close}
            mode={panel.mode}
            initialDate={selectedDate}
          />
        );
      case 'editPeriod':
        return (
          <EditPeriodModal
            visible={panelOpen}
            onClose={close}
            period={panel.period}
            isLatest={panel.period.startDate === latestStart}
          />
        );
      case 'context':
        return <CycleContextModal visible={panelOpen} onClose={close} context={panel.context} />;
      case 'why':
        return (
          <ReminderExplainerSheet
            kind={panelOpen ? panel.reminder : null}
            onClose={close}
            onChangeReminders={() => setPanel({ kind: 'settings' })}
          />
        );
      default:
        return null;
    }
  };

  return (
    <MasterLayout>
      <AreaLockGate area="cycle">
        <KeyboardAwareScrollView
          bottomOffset={16}
          className="flex-1"
          showsVerticalScrollIndicator={false}
        >
          <AnimatedContent>
            <View className="px-4 py-8">
              {/* One short title with where the cycle is as its subtitle. The day itself is shown once,
                  inside the wheel; a "15/28" badge up here repeated it. */}
              <View className="mb-6 flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <Text
                    accessibilityRole="header"
                    className="text-4xl font-black text-text-primary"
                    numberOfLines={1}
                  >
                    {t('cycle.title')}
                  </Text>
                  {cycle && cycleDay != null && !guidance.hidePeriodActions && currentPhase ? (
                    <Text className="mt-1 text-base font-semibold text-accent-primary">
                      {t(CYCLE_PHASE_LABEL_KEYS[currentPhase])}
                    </Text>
                  ) : null}
                  {cycle && isOverdue && !guidance.hidePeriodActions ? (
                    <Text className="mt-1 text-sm text-text-tertiary">
                      {t('cycle.periodNotLogged')}
                    </Text>
                  ) : null}
                </View>
                <IconButton
                  icon={Settings}
                  accessibilityLabel={t('cycle.settings.title')}
                  onPress={() => setPanel({ kind: 'settings' })}
                />
              </View>

              {!cycle ? (
                <View className="mb-8 items-center rounded-2xl bg-bg-overlay p-8">
                  <CalendarHeart size={40} color={theme.colors.text.secondary} />
                  <Text className="mt-4 text-center text-lg font-bold text-text-primary">
                    {pausedCycle ? t('cycle.noData.pausedTitle') : t('cycle.noData.title')}
                  </Text>
                  <Text className="mt-2 text-center text-sm text-text-secondary">
                    {pausedCycle
                      ? t('cycle.noData.pausedDescription')
                      : t('cycle.noData.description')}
                  </Text>
                  <TextButton
                    label={t('cycle.complete.restoreFirst')}
                    onPress={() => setPanel({ kind: 'restore' })}
                  />
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
                  {/* Today: the one period action, and logging the day. */}
                  {guidance.hidePeriodActions ? null : (
                    <View className="mb-6 gap-3">
                      {activePeriod ? (
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
                              {cycleDay != null
                                ? t('cycle.periodActive', { day: formatInteger(cycleDay) })
                                : t('cycle.periodActiveGeneric')}
                            </Text>
                          </View>
                          <Button
                            label={t('cycle.actions.periodEnded')}
                            icon={CheckCircle}
                            variant="roseOutline"
                            width="full"
                            onPress={() => setPanel({ kind: 'period', mode: 'end' })}
                          />
                        </>
                      ) : (
                        <Button
                          label={t('cycle.actions.periodStarted')}
                          icon={CircleDot}
                          variant="rose"
                          width="full"
                          onPress={() => setPanel({ kind: 'period', mode: 'start' })}
                        />
                      )}
                    </View>
                  )}

                  <View className="mb-6 gap-4">
                    <DateNavigator selectedDate={selectedDate} onDateChange={setSelectedDate} />
                    <QuickLogRow day={day} />
                    <DayLogSummary
                      log={dayLogs.find((log) => log.date === day)}
                      mood={moods.find((m) => m.date === day)?.value}
                      onEdit={() => setPanel({ kind: 'day' })}
                    />
                  </View>

                  {/* The forecast: the wheel and what the estimate rests on. */}
                  {cycleDay != null && !guidance.hidePeriodActions ? (
                    <View className="mb-6 items-center justify-center">
                      <PhaseWheel
                        currentPhase={currentPhase}
                        cycleDay={cycleDay}
                        totalDays={avgCycleLength}
                        segments={timeline?.segments ?? null}
                      />
                    </View>
                  ) : null}
                  <PredictionCard onOpenDetails={() => setPanel({ kind: 'details' })} />

                  <PinSuggestionCard />
                  <CycleInsightsCard />
                  <CycleCareCard
                    day={day}
                    onAppointment={() => setPanel({ kind: 'appointment' })}
                  />

                  <View className="mb-4 flex-row items-center justify-between">
                    <Text className="text-2xl font-bold text-text-primary">
                      {t('cycle.history.title')}
                    </Text>
                    <IconButton
                      icon={Plus}
                      accessibilityLabel={t('cycle.actions.logPastPeriod')}
                      color={theme.colors.accent.primary}
                      onPress={() => setPanel({ kind: 'period', mode: 'past' })}
                    />
                  </View>

                  <View className="mb-4">
                    <SegmentedControl
                      options={[
                        { label: t('cycle.history.tabCalendar'), value: 'calendar' },
                        { label: t('cycle.history.tabHistory'), value: 'history' },
                        { label: t('cycle.comparison.tab'), value: 'comparison' },
                        { label: t('cycle.complete.trends'), value: 'trends' },
                      ]}
                      value={tab}
                      onValueChange={(value) => setTab(value as HistoryTab)}
                    />
                  </View>

                  {tab === 'trends' ? <CycleTrends onSelectDay={openDay} /> : null}
                  {tab === 'calendar' ? (
                    <CycleCalendar
                      periods={periods}
                      dayLogs={dayLogs}
                      timeline={timeline}
                      today={today}
                      selectedDay={day}
                      showFertile={showFertile}
                      onSelectDay={openDay}
                    />
                  ) : null}
                  {tab === 'comparison' ? <CycleComparison onSelectDay={openDay} /> : null}
                  {tab === 'history' ? (
                    <View>
                      <PeriodHistoryList
                        periods={periods}
                        history={history}
                        onEdit={(period) => setPanel({ kind: 'editPeriod', period })}
                      />
                      <ContextTimeline
                        contexts={contexts}
                        onEdit={(context) => setPanel({ kind: 'context', context })}
                      />
                      <View className="mt-4">
                        <TextButton
                          label={t('cycle.settings.changeContext')}
                          onPress={() => setPanel({ kind: 'context', context: null })}
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

        {/* Inside the gate: if the cycle area re-locks, an open sheet goes with it. */}
        {renderPanel()}
      </AreaLockGate>
    </MasterLayout>
  );
}
