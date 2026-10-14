import type { TFunction } from 'i18next';

import { buildSummaryCopy } from '@/services/cycleExport';
import { buildAppointmentSummaryHtml } from '@/utils/cycle/appointmentSummary';
import { computePredictionStats } from '@/utils/cycle/cycleStats';
import { blankDayLog } from '@/utils/cycle/dayLog';

jest.mock('expo-print', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('@/utils/file', () => ({ shareTextFile: jest.fn() }));
jest.mock('@/components/cycle/ContextFields', () => ({
  contraceptionTitleKey: (s: string) => s,
  lifeStageTitleKey: (s: string) => s,
}));
const date = (d: number) => new Date(2024, 0, d).getTime();
const t = ((key: string) => key) as TFunction;

it('includes shared mood and archived custom observations in the selected appointment range', () => {
  const input = {
    from: date(2),
    periods: [],
    history: [],
    contexts: [],
    stats: computePredictionStats([]),
    moods: [
      { date: date(1), value: 4 },
      { date: date(2), value: 0 },
    ],
    dayLogs: [
      {
        ...blankDayLog(date(2)),
        id: 'd',
        timezone: '+00:00',
        observations: {
          sex: false,
          custom: { archived: 0 },
          customLabels: { archived: '<Personal field>' },
        },
      },
    ],
  };
  const copy = buildSummaryCopy(t, 'en-US', input, 3, date(10));
  const lines = copy.observationLines!.join('\n');
  expect(lines).toContain('bodyMetrics.addEntry.moods.0');
  expect(lines).not.toContain('bodyMetrics.addEntry.moods.4');
  expect(lines).toContain('<Personal field>: 0');
  expect(lines).toContain('common.no');
  expect(lines).not.toContain('customLabels');
  const html = buildAppointmentSummaryHtml(input, copy);
  expect(html).toContain('&lt;Personal field&gt;');
  expect(html).not.toContain('<Personal field>');
});
