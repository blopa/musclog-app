import { median } from './cycleHistory';
import type { PredictionStats } from './cycleStats';
import type {
  BleedingLevel,
  CycleContextDto,
  CycleDayLogDto,
  CycleHistoryEntry,
  CyclePeriodDto,
} from './types';

/** Everything the page says that is words or formatted numbers, resolved by the caller. */
export interface SummaryCopy {
  title: string;
  rangeLine: string;
  disclaimer: string;
  sections: {
    overview: string;
    periods: string;
    bleeding: string;
    symptoms: string;
    pain: string;
    notes: string;
    context: string;
  };
  columns: { start: string; end: string; duration: string; cycleLength: string; status: string };
  empty: string;
  statusUsed: string;
  statusInProgress: string;
  statusExcluded: (reason: string) => string;
  endUnknown: string;
  endEstimated: string;
  overviewLines: string[];
  bleedingLabel: (level: BleedingLevel) => string;
  symptomLabel: (key: string) => string;
  severityLabel: (severity: 1 | 2 | 3) => string;
  contextLine: (context: CycleContextDto) => string;
  painLine: string | null;
  observationsTitle?: string;
  observationLines?: string[];
  formatDate: (ms: number) => string;
  formatInteger: (n: number) => string;
}

export interface SummaryInput {
  from: number;
  to?: number;
  periods: CyclePeriodDto[];
  history: CycleHistoryEntry[];
  stats: PredictionStats;
  dayLogs: CycleDayLogDto[];
  contexts: CycleContextDto[];
  moods?: { date: number; value: number }[];
}

export interface SummaryFacts {
  periods: CyclePeriodDto[];
  history: CycleHistoryEntry[];
  dayLogs: CycleDayLogDto[];
  contexts: CycleContextDto[];
  bleedingDays: Partial<Record<BleedingLevel, number>>;
  topSymptoms: { key: string; days: number; severe: number; moderate: number; mild: number }[];
  pain: { loggedDays: number; max: number | null; median: number | null; severeDays: number };
  notes: { date: number; text: string }[];
}

const HIGH_PAIN = 6;
const MAX_SYMPTOMS = 8;

/** The numbers behind the page, kept apart from the HTML so they can be tested directly. */
export function collectSummaryFacts(input: SummaryInput): SummaryFacts {
  const periods = input.periods.filter(
    (p) => p.startDate >= input.from && p.startDate <= (input.to ?? Infinity)
  );

  const history = input.history.filter(
    (h) => h.start >= input.from && h.start <= (input.to ?? Infinity)
  );

  const dayLogs = input.dayLogs
    .filter((d) => d.date >= input.from && d.date <= (input.to ?? Infinity))
    .sort((a, b) => a.date - b.date);
  const contexts = input.contexts;

  const bleedingDays: SummaryFacts['bleedingDays'] = {};
  const symptoms = new Map<
    string,
    { days: number; severe: number; moderate: number; mild: number }
  >();
  const pains: number[] = [];

  for (const log of dayLogs) {
    if (log.bleeding && log.bleeding !== 'none') {
      bleedingDays[log.bleeding] = (bleedingDays[log.bleeding] ?? 0) + 1;
    }

    for (const s of log.symptoms) {
      const entry = symptoms.get(s.key) ?? { days: 0, severe: 0, moderate: 0, mild: 0 };
      entry.days += 1;
      if (s.severity === 3) {
        entry.severe += 1;
      }

      if (s.severity === 2) {
        entry.moderate += 1;
      }

      if (s.severity === 1) {
        entry.mild += 1;
      }

      symptoms.set(s.key, entry);
    }

    if (log.pain != null) {
      pains.push(log.pain);
    }
  }

  return {
    periods,
    history,
    dayLogs,
    contexts,
    bleedingDays,
    topSymptoms: [...symptoms.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.days - a.days)
      .slice(0, MAX_SYMPTOMS),
    pain: {
      loggedDays: pains.length,
      max: pains.length ? Math.max(...pains) : null,
      median: pains.length ? median(pains) : null,
      severeDays: pains.filter((p) => p >= HIGH_PAIN).length,
    },
    notes: dayLogs.filter((d) => d.note.trim()).map((d) => ({ date: d.date, text: d.note.trim() })),
  };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const e = escapeHtml;

/**
 * An appointment record of what the person logged; length depends on the selected history. It states the data and
 * says it is self-recorded; it never interprets it.
 */
export function buildAppointmentSummaryHtml(input: SummaryInput, copy: SummaryCopy): string {
  const facts = collectSummaryFacts(input);
  const byStart = new Map(facts.history.map((h) => [h.start, h]));

  const periodRows = [...facts.periods]
    .sort((a, b) => a.startDate - b.startDate)
    .map((p) => {
      const h = byStart.get(p.startDate);
      const end =
        p.endDate != null
          ? `${copy.formatDate(p.endDate)}${p.endKind === 'estimated' ? ` (${copy.endEstimated})` : ''}`
          : copy.endUnknown;
      let status = '';
      if (h?.status === 'used') {
        status = copy.statusUsed;
      } else if (h?.status === 'in_progress') {
        status = copy.statusInProgress;
      } else if (h?.reason) {
        status = copy.statusExcluded(h.reason);
      }

      return `<tr><td>${e(copy.formatDate(p.startDate))}</td><td>${e(end)}</td><td>${
        h?.durationDays != null && h.durationKnown ? e(copy.formatInteger(h.durationDays)) : '—'
      }</td><td>${h?.lengthDays != null ? e(copy.formatInteger(h.lengthDays)) : '—'}</td><td>${e(
        status
      )}</td></tr>`;
    })
    .join('');

  const bleedingItems = (Object.keys(facts.bleedingDays) as BleedingLevel[])
    .map(
      (level) =>
        `<li>${e(copy.bleedingLabel(level))}: ${e(copy.formatInteger(facts.bleedingDays[level]!))}</li>`
    )
    .join('');

  const symptomRows = facts.topSymptoms
    .map((s) => {
      const parts = [
        s.severe ? `${copy.severityLabel(3)} ${copy.formatInteger(s.severe)}` : '',
        s.moderate ? `${copy.severityLabel(2)} ${copy.formatInteger(s.moderate)}` : '',
        s.mild ? `${copy.severityLabel(1)} ${copy.formatInteger(s.mild)}` : '',
      ].filter(Boolean);

      return `<tr><td>${e(copy.symptomLabel(s.key))}</td><td>${e(copy.formatInteger(s.days))}</td><td>${e(
        parts.join(' · ')
      )}</td></tr>`;
    })
    .join('');

  const noteItems = facts.notes
    .map((n) => `<li><strong>${e(copy.formatDate(n.date))}</strong> — ${e(n.text)}</li>`)
    .join('');
  const contextItems = [...facts.contexts]
    .sort((a, b) => a.effectiveFrom - b.effectiveFrom)
    .map(
      (c) =>
        `<li><strong>${e(copy.formatDate(c.effectiveFrom))}</strong> — ${e(copy.contextLine(c))}</li>`
    )
    .join('');

  const section = (title: string, body: string) =>
    body ? `<section><h2>${e(title)}</h2>${body}</section>` : '';

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(copy.title)}</title><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;margin:32px;font-size:13px;line-height:1.45}
h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
.sub{color:#555;margin:0 0 8px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:4px 8px 4px 0;border-bottom:1px solid #eee;vertical-align:top}
th{font-size:11px;text-transform:uppercase;color:#555}ul{margin:4px 0;padding-left:18px}.disclaimer{margin-top:24px;color:#555;font-size:11px}
</style></head><body>
<h1>${e(copy.title)}</h1><p class="sub">${e(copy.rangeLine)}</p>
${section(copy.sections.overview, `<ul>${copy.overviewLines.map((l) => `<li>${e(l)}</li>`).join('')}</ul>`)}
${section(
  copy.sections.periods,
  periodRows
    ? `<table><thead><tr><th>${e(copy.columns.start)}</th><th>${e(copy.columns.end)}</th><th>${e(
        copy.columns.duration
      )}</th><th>${e(copy.columns.cycleLength)}</th><th>${e(copy.columns.status)}</th></tr></thead><tbody>${periodRows}</tbody></table>`
    : `<p>${e(copy.empty)}</p>`
)}
${section(copy.sections.bleeding, bleedingItems ? `<ul>${bleedingItems}</ul>` : '')}
${section(
  copy.sections.symptoms,
  symptomRows ? `<table><tbody>${symptomRows}</tbody></table>` : ''
)}
${section(copy.sections.pain, copy.painLine ? `<p>${e(copy.painLine)}</p>` : '')}
${section(copy.sections.notes, noteItems ? `<ul>${noteItems}</ul>` : '')}
${section(copy.sections.context, contextItems ? `<ul>${contextItems}</ul>` : '')}
${section(copy.observationsTitle ?? '', copy.observationLines?.length ? `<ul>${copy.observationLines.map((line) => `<li>${e(line)}</li>`).join('')}</ul>` : '')}
<p class="disclaimer">${e(copy.disclaimer)}</p>
</body></html>`;
}
