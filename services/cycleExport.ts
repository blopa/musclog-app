import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { TFunction } from 'i18next';
import { Platform } from 'react-native';

import { contraceptionTitleKey, lifeStageTitleKey } from '@/components/cycle/ContextFields';
import { SEVERITY_LABEL_KEYS, SYMPTOM_LABEL_KEYS } from '@/constants/cycle';
import { localDayStartFromUtcMs } from '@/utils/calendarDate';
import {
  buildAppointmentSummaryHtml,
  collectSummaryFacts,
  type SummaryCopy,
  type SummaryInput,
} from '@/utils/cycle/appointmentSummary';
import { dayLogsCsv, periodsCsv } from '@/utils/cycle/cycleCsv';
import type { CycleDayLogDto, CycleHistoryEntry, CyclePeriodDto } from '@/utils/cycle/types';
import { shareTextFile } from '@/utils/file';
import { formatAppDecimal, formatAppInteger } from '@/utils/formatAppNumber';
import { timestampSlug } from '@/utils/timestampSlug';

const CSV_MIME = 'text/csv';

export async function exportPeriodsCsv(periods: CyclePeriodDto[], history: CycleHistoryEntry[]) {
  await shareTextFile(
    `${timestampSlug()}-musclog-cycle-periods.csv`,
    periodsCsv(periods, history),
    CSV_MIME
  );
}

export async function exportDayLogsCsv(dayLogs: CycleDayLogDto[]) {
  await shareTextFile(`${timestampSlug()}-musclog-cycle-days.csv`, dayLogsCsv(dayLogs), CSV_MIME);
}

export type SummaryRangeMonths = 3 | 6 | 12;

const REASON_KEYS = {
  too_short: 'cycle.history.reason.too_short',
  possible_missed_period: 'cycle.history.reason.possible_missed_period',
  user_excluded: 'cycle.history.reason.user_excluded',
  hormonal_context: 'cycle.history.reason.hormonal_context',
  postpartum_context: 'cycle.history.reason.postpartum_context',
} as const;

const BLEEDING_KEYS = {
  none: 'cycle.calendar.bleeding.none',
  spotting: 'cycle.calendar.bleeding.spotting',
  light: 'cycle.calendar.bleeding.light',
  medium: 'cycle.calendar.bleeding.medium',
  heavy: 'cycle.calendar.bleeding.heavy',
  very_heavy: 'cycle.calendar.bleeding.very_heavy',
} as const;

function monthsAgo(nowMs: number, months: number): number {
  const d = new Date(nowMs);
  d.setMonth(d.getMonth() - months);

  return localDayStartFromUtcMs(d.getTime());
}

/** Resolves every sentence and number of the appointment summary in the person's language. */
export function buildSummaryCopy(
  t: TFunction,
  locale: string,
  input: SummaryInput,
  months: SummaryRangeMonths,
  nowMs: number
): SummaryCopy {
  const int = (n: number) => formatAppInteger(locale, n);
  const date = (ms: number) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(ms);
  const facts = collectSummaryFacts(input);
  const { stats } = input;
  const used = facts.history.filter((h) => h.status === 'used').length;
  const excluded = facts.history.filter((h) => h.status === 'excluded').length;

  const overviewLines = [
    t('cycle.summary.overviewPeriods', {
      count: facts.periods.length,
      n: int(facts.periods.length),
    }),
    stats.usableCount > 0
      ? t('cycle.summary.overviewLength', {
          median: int(stats.medianLength),
          low: int(stats.rangeLow),
          high: int(stats.rangeHigh),
        })
      : t('cycle.summary.overviewNoLength'),
    t('cycle.summary.overviewUsed', { used: int(used), excluded: int(excluded) }),
  ];

  const painLine =
    facts.pain.loggedDays > 0
      ? t('cycle.summary.pain', {
          days: int(facts.pain.loggedDays),
          median: formatAppDecimal(locale, facts.pain.median ?? 0, 1),
          max: int(facts.pain.max ?? 0),
          severe: int(facts.pain.severeDays),
        })
      : null;

  return {
    title: t('cycle.summary.title'),
    rangeLine: t('cycle.summary.range', {
      from: date(input.from),
      to: date(nowMs),
      months: int(months),
    }),
    disclaimer: t('cycle.summary.disclaimer'),
    sections: {
      overview: t('cycle.summary.sectionOverview'),
      periods: t('cycle.summary.sectionPeriods'),
      bleeding: t('cycle.summary.sectionBleeding'),
      symptoms: t('cycle.summary.sectionSymptoms'),
      pain: t('cycle.summary.sectionPain'),
      notes: t('cycle.summary.sectionNotes'),
      context: t('cycle.summary.sectionContext'),
    },
    columns: {
      start: t('cycle.summary.colStart'),
      end: t('cycle.summary.colEnd'),
      duration: t('cycle.summary.colDuration'),
      cycleLength: t('cycle.summary.colCycleLength'),
      status: t('cycle.summary.colStatus'),
    },
    empty: t('cycle.summary.empty'),
    statusUsed: t('cycle.summary.statusUsed'),
    statusInProgress: t('cycle.summary.statusInProgress'),
    statusExcluded: (reason) =>
      t('cycle.history.notUsed', {
        reason: t(REASON_KEYS[reason as keyof typeof REASON_KEYS] ?? reason),
      }),
    endUnknown: t('cycle.history.unknownEnd'),
    endEstimated: t('cycle.history.estimatedEnd'),
    overviewLines,
    bleedingLabel: (level) => t(BLEEDING_KEYS[level]),
    symptomLabel: (key) =>
      SYMPTOM_LABEL_KEYS[key] ? t(SYMPTOM_LABEL_KEYS[key]) : key.replace(/_/g, ' '),
    severityLabel: (severity) => t(SEVERITY_LABEL_KEYS[severity]),
    contextLine: (context) =>
      `${t(lifeStageTitleKey(context.lifeStage))} · ${t(contraceptionTitleKey(context.contraception))}`,
    painLine,
    formatDate: date,
    formatInteger: int,
  };
}

/** Builds the summary for the chosen range and opens it for printing or sharing as a PDF. */
export async function shareAppointmentSummary(args: {
  t: TFunction;
  locale: string;
  months: SummaryRangeMonths;
  nowMs: number;
  data: Omit<SummaryInput, 'from'>;
}): Promise<void> {
  const from = monthsAgo(args.nowMs, args.months);
  const input: SummaryInput = { ...args.data, from };
  const html = buildAppointmentSummaryHtml(
    input,
    buildSummaryCopy(args.t, args.locale, input, args.months, args.nowMs)
  );

  if (Platform.OS === 'web') {
    await Print.printAsync({ html });

    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
