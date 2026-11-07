import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  copyPattern,
  declaredStep,
  flowSelection,
  liveRows,
  localeCopy,
  stepName,
} from '../flowKit';
import { modalActionLabelKeys } from '../flows/whatsNew';
import type { AuditFlow } from '../routes';

const FLOW: AuditFlow = {
  name: 'weekly-review-flow',
  files: [],
  steps: ['weekly-review (applied)', 'weekly-review (tour page)', 'workout-summary'],
};

describe('step names', () => {
  it('puts a variant inside the brackets, or adds brackets when there are none', () => {
    expect(stepName('whats-new (tour page)', '3')).toBe('whats-new (tour page 3)');
    expect(stepName('workout-summary', 'late')).toBe('workout-summary (late)');
    expect(stepName('workout-summary')).toBe('workout-summary');
  });

  it('maps a measured name back to the step that declares it, variants included', () => {
    expect(declaredStep(FLOW, 'weekly-review (applied)')).toBe('weekly-review (applied)');
    expect(declaredStep(FLOW, 'weekly-review (tour page 12)')).toBe('weekly-review (tour page)');
    expect(declaredStep(FLOW, 'weekly-review (applied twice)')).toBe('weekly-review (applied)');
    expect(declaredStep(FLOW, 'weekly-review (tour)')).toBeNull();
    expect(declaredStep(FLOW, 'workout-summary 2')).toBeNull();
  });
});

describe('flowSelection', () => {
  const only =
    (...parts: string[]) =>
    (name: string) =>
      parts.some((part) => name.toLowerCase().includes(part));

  it('runs and measures everything when the flow itself is named', () => {
    const selection = flowSelection(FLOW, only('weekly-review-flow'));
    expect(selection.runs).toBe(true);
    expect(selection.measures('workout-summary')).toBe(true);
  });

  it('runs for one named step but measures only the steps that are wanted', () => {
    const selection = flowSelection(FLOW, only('applied'));
    expect(selection.runs).toBe(true);
    expect(selection.measures('weekly-review (applied)')).toBe(true);
    expect(selection.measures('workout-summary')).toBe(false);
  });

  it('does not run when nothing in it is wanted', () => {
    expect(flowSelection(FLOW, only('cycle')).runs).toBe(false);
  });
});

describe('localeCopy', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-copy-'));
  beforeAll(() => {
    for (const [dir, value] of [
      ['en-us', { a: { next: 'Next', only: 'English only' } }],
      ['ru-ru', { a: { next: 'Далее' } }],
    ] as const) {
      fs.mkdirSync(path.join(root, dir), { recursive: true });
      fs.writeFileSync(path.join(root, dir, 'tour.json'), JSON.stringify(value));
    }
  });

  it('reads the locale, then English, then the fallback', () => {
    expect(localeCopy('ru-RU', 'tour', ['a', 'next'], '?', root)).toBe('Далее');
    expect(localeCopy('ru-RU', 'tour', ['a', 'only'], '?', root)).toBe('English only');
    expect(localeCopy('ru-RU', 'tour', ['a', 'missing'], 'fallback', root)).toBe('fallback');
    expect(localeCopy('ru-RU', 'nofile', ['a'], 'fallback', root)).toBe('fallback');
  });
});

describe('copyPattern', () => {
  it('matches a label with its placeholders filled in, escaping everything else', () => {
    const pattern = copyPattern('Log weight for {{date}} (kg)');
    expect(pattern.test('Log weight for Sun, Nov 1 (kg)')).toBe(true);
    expect(pattern.test('Log weight for  (kg)')).toBe(false);
    expect(pattern.test('Log weight for Sun, Nov 1 (kg) again')).toBe(false);
  });

  it('can match a label that starts a longer accessible name', () => {
    expect(copyPattern('Cardio log', { prefix: true }).test('Cardio log Record cardio')).toBe(true);
  });
});

describe('liveRows', () => {
  it('reads every chunk of the table and leaves out deleted rows and other tables', () => {
    const entries = [
      { key: 'notes.metadata', value: '{}' },
      { key: 'notes.chunk.0', value: JSON.stringify([{ id: 'a' }, { id: 'b', deleted_at: 5 }]) },
      {
        key: 'notes.chunk.1',
        value: JSON.stringify([{ id: 'c', _status: 'deleted' }, { id: 'd' }]),
      },
      { key: 'notes_extra.chunk.0', value: JSON.stringify([{ id: 'x' }]) },
    ];
    expect(liveRows(entries, 'notes').map((row) => row.id)).toEqual(['a', 'd']);
  });
});

describe("What's new modal actions", () => {
  it('finds the first label of each modal action, in action blocks and feature lists alike', () => {
    const keys = modalActionLabelKeys([
      {
        pages: [
          { blocks: [{ type: 'action', action: 'openWeeklyReview', labelKey: 'route' }] },
          {
            blocks: [
              {
                type: 'featureList',
                items: [
                  { action: 'openCardioLog', labelKey: 'cardio' },
                  { action: 'openWorkoutSettings', labelKey: 'restrictions' },
                ],
              },
              { type: 'action', action: 'openWorkoutSettings', labelKey: 'gym' },
            ],
          },
        ],
      },
    ]);
    expect(Object.fromEntries(keys)).toEqual({
      openCardioLog: 'cardio',
      openWorkoutSettings: 'restrictions',
    });
  });
});
