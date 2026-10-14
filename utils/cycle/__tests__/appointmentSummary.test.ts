import {
  buildAppointmentSummaryHtml,
  collectSummaryFacts,
  escapeHtml,
  type SummaryCopy,
} from '../appointmentSummary';
import { buildCycleHistory } from '../cycleHistory';
import { computePredictionStats } from '../cycleStats';
import type { CycleDayLogDto, CyclePeriodDto } from '../types';

const day = (n: number) => new Date(2024, 0, n).getTime();
const period = (
  id: string,
  start: number,
  end: number | null,
  endKind: CyclePeriodDto['endKind'],
  note = ''
): CyclePeriodDto => ({
  id,
  cycleId: 'c',
  startDate: day(start),
  endDate: end == null ? null : day(end),
  endKind,
  timezone: '+00:00',
  excludedFromStats: false,
  note,
});
const log = (n: number, extra: Partial<CycleDayLogDto>): CycleDayLogDto => ({
  id: String(n),
  date: day(n),
  timezone: '+00:00',
  bleeding: null,
  symptoms: [],
  noSymptoms: false,
  pain: null,
  energy: null,
  note: '',
  ...extra,
});

const periods = [
  period('a', 1, 5, 'logged'),
  period('b', 29, 33, 'estimated'),
  period('c', 57, null, 'unknown'),
];
const history = buildCycleHistory(periods);
const dayLogs = [
  log(2, {
    bleeding: 'heavy',
    symptoms: [{ key: 'cramps', severity: 3 }],
    pain: 8,
    note: 'woke <b>up</b> in pain',
  }),
  log(3, {
    bleeding: 'medium',
    symptoms: [
      { key: 'cramps', severity: 2 },
      { key: 'acne', severity: null },
    ],
    pain: 4,
  }),
  log(30, { bleeding: 'light', symptoms: [{ key: 'cramps', severity: 1 }] }),
];
const input = {
  from: day(1),
  periods,
  history,
  stats: computePredictionStats(history),
  dayLogs,
  contexts: [],
};

const copy: SummaryCopy = {
  title: 'Cycle summary',
  rangeLine: 'range',
  disclaimer: 'Self-recorded data, not a diagnosis.',
  sections: {
    overview: 'Overview',
    periods: 'Periods',
    bleeding: 'Bleeding',
    symptoms: 'Symptoms',
    pain: 'Pain',
    notes: 'Notes',
    context: 'Context',
  },
  columns: { start: 'Start', end: 'End', duration: 'Days', cycleLength: 'Cycle', status: 'Status' },
  empty: 'None',
  statusUsed: 'counted',
  statusInProgress: 'in progress',
  statusExcluded: (r) => `not counted: ${r}`,
  endUnknown: 'end unknown',
  endEstimated: 'estimated',
  overviewLines: ['3 periods'],
  bleedingLabel: (l) => l,
  symptomLabel: (k) => k,
  severityLabel: (s) => `s${s}`,
  contextLine: () => 'ctx',
  painLine: 'max 8',
  formatDate: (ms) => new Date(ms).toISOString().slice(0, 10),
  formatInteger: (n) => String(n),
};

describe('collectSummaryFacts', () => {
  const facts = collectSummaryFacts(input);

  it('counts bleeding days by level and ranks symptoms with their severities', () => {
    expect(facts.bleedingDays).toEqual({ heavy: 1, medium: 1, light: 1 });
    expect(facts.topSymptoms[0]).toMatchObject({
      key: 'cramps',
      days: 3,
      severe: 1,
      moderate: 1,
      mild: 1,
    });
    expect(facts.topSymptoms[1]).toMatchObject({ key: 'acne', days: 1 });
  });

  it('summarises pain without counting days with none logged', () => {
    expect(facts.pain).toEqual({ loggedDays: 2, max: 8, median: 6, severeDays: 1 });
  });

  it('respects the start of the range', () => {
    expect(collectSummaryFacts({ ...input, from: day(29) }).periods).toHaveLength(2);
  });
});

describe('buildAppointmentSummaryHtml', () => {
  const html = buildAppointmentSummaryHtml(input, copy);

  it('states the self-recorded disclaimer and lists periods with honest end labels', () => {
    expect(html).toContain('Self-recorded data, not a diagnosis.');
    expect(html).toContain('end unknown');
    expect(html).toContain('(estimated)');
  });

  it('labels a cycle that was not used for predictions', () => {
    const short = [period('a', 1, 5, 'logged'), period('b', 8, 12, 'logged')];
    const h = buildCycleHistory(short);
    const out = buildAppointmentSummaryHtml({ ...input, periods: short, history: h }, copy);
    expect(out).toContain('not counted: too_short');
  });

  it('escapes user text so a note cannot inject markup', () => {
    expect(html).not.toContain('<b>up</b>');
    expect(html).toContain('&lt;b&gt;up&lt;/b&gt;');
    expect(escapeHtml(`"&'`)).toBe('&quot;&amp;&#39;');
  });
});

it('excludes journal observations beyond the appointment range end', () => {
  const facts = collectSummaryFacts({ ...input, to: day(2) });
  expect(facts.dayLogs.map((log) => log.date)).toEqual([day(2)]);
});
