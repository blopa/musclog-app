import { parseWorkoutImport } from '@/utils/workoutImport/sessions';

import {
  checkLogCsv,
  EXAMPLE_ROW_NOTE,
  LOG_DOWNLOADS,
  MAX_CHECK_CHARS,
} from '../workoutLogTemplateModel';

const NOW = new Date('2026-06-01T12:00:00Z');
const HEADER = 'Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE,Notes';

describe('checkLogCsv', () => {
  it("counts workouts and sets the way the app's importer reads them", () => {
    const csv = [
      HEADER,
      '2026-01-05 18:10:00,Push Day,Bench Press (Barbell),1,60,8,8,',
      '2026-01-05 18:10:00,Push Day,Bench Press (Barbell),2,65,6,9,',
      '2026-01-05 18:10:00,Push Day,Overhead Press (Barbell),1,40,8,,',
      '2026-01-08 18:00:00,Pull Day,Barbell Row,1,50,10,,',
    ].join('\n');
    const result = checkLogCsv(csv, 'kg', NOW);
    expect(result).toEqual({ ok: true, workouts: 2, sets: 4, skipped: 0, exampleRow: false });

    const direct = parseWorkoutImport(csv, { assumedWeightUnit: 'kg', now: NOW });
    expect(direct.ok && direct.sessions).toHaveLength(2);
  });

  it('counts rows it cannot read as skipped', () => {
    const csv = [
      HEADER,
      '2026-01-05 18:10:00,Push Day,Bench Press (Barbell),1,60,8,8,',
      'not a date,Push Day,Bench Press (Barbell),2,65,6,9,',
    ].join('\n');
    expect(checkLogCsv(csv, 'kg', NOW)).toEqual({
      ok: true,
      workouts: 1,
      sets: 1,
      skipped: 1,
      exampleRow: false,
    });
  });

  it('refuses empty, header-only and unrecognised files with a named problem', () => {
    expect(checkLogCsv('  \n', 'kg', NOW)).toEqual({ ok: false, problem: 'empty' });
    expect(checkLogCsv(HEADER, 'kg', NOW)).toEqual({ ok: false, problem: 'noRows' });
    expect(checkLogCsv('a,b,c\n1,2,3', 'kg', NOW)).toEqual({ ok: false, problem: 'unreadable' });
    expect(checkLogCsv('x'.repeat(MAX_CHECK_CHARS + 1), 'kg', NOW)).toEqual({
      ok: false,
      problem: 'tooLarge',
    });
  });
});

describe('the example row', () => {
  it('is flagged so the page can tell the visitor to delete it', () => {
    const csv = `${HEADER}\n2026-01-05 18:10:00,Push Day,Bench Press,1,60,8,8,${EXAMPLE_ROW_NOTE}`;
    expect(checkLogCsv(csv, 'kg', NOW)).toMatchObject({ ok: true, exampleRow: true });
  });
});

describe('LOG_DOWNLOADS', () => {
  it('names each file once, under public/downloads', () => {
    const files = LOG_DOWNLOADS.map((download) => download.file);
    expect(new Set(files).size).toBe(files.length);
    expect(LOG_DOWNLOADS.map((download) => download.kind).sort()).toEqual([
      'pdf',
      'pdf',
      'sheet',
      'sheet',
    ]);
  });
});
