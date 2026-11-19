import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { checkLogCsv, LOG_DOWNLOADS } from '@/components/website/tools/workoutLogTemplateModel';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const log = require('../generate-workout-log.js');

const PUBLISHED = join(__dirname, '..', '..', 'public', 'downloads');

describe('generate-workout-log', () => {
  let dir: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'musclog-log-'));
    await log.generate(dir);
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('writes exactly the files the page links to', () => {
    expect(Object.values(log.FILES).sort()).toEqual(LOG_DOWNLOADS.map((d) => d.file).sort());
    for (const { file } of LOG_DOWNLOADS) {
      expect(existsSync(join(dir, file))).toBe(true);
    }
  });

  it('writes real PDFs with one page per sheet', () => {
    for (const file of [log.FILES.pdfA4, log.FILES.pdfLetter]) {
      const bytes = readFileSync(join(dir, file)).toString('latin1');
      expect(bytes.startsWith('%PDF-')).toBe(true);
      expect(bytes.match(/\/Type \/Page\b(?!s)/g)).toHaveLength(log.PDF_SHEETS);
    }
  });

  it('writes a spreadsheet with the Log and Read me sheets and the importer columns', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx');
    const book = XLSX.read(readFileSync(join(dir, log.FILES.xlsx)));
    expect(book.SheetNames).toEqual(['Log', 'Read me']);
    const rows = XLSX.utils.sheet_to_json(book.Sheets.Log, { header: 1 });
    expect(rows[0]).toEqual(log.LOG_COLUMNS);
  });

  it("writes a CSV that Musclog's own importer reads", () => {
    const csv = readFileSync(join(dir, log.FILES.csv), 'utf8');
    expect(csv.split('\n')[0]).toBe(log.LOG_COLUMNS.join(','));
    expect(checkLogCsv(csv, 'kg', new Date('2026-06-01T12:00:00Z'))).toEqual({
      ok: true,
      workouts: 1,
      sets: 1,
      skipped: 0,
    });
  });

  it('matches the files committed under public/downloads (rerun npm run generate-workout-log)', () => {
    for (const { file } of LOG_DOWNLOADS) {
      expect(readFileSync(join(PUBLISHED, file)).equals(readFileSync(join(dir, file)))).toBe(true);
    }
  });
});
