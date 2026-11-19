import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { NUTRITION_LOG_DOWNLOADS } from '@/components/website/tools/nutritionLogTemplateModel';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const log = require('../generate-nutrition-log.js');

const PUBLISHED = join(__dirname, '..', '..', 'public', 'downloads');

describe('generate-nutrition-log', () => {
  let dir: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'musclog-nutrition-log-'));
    await log.generate(dir);
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('writes exactly the files the page links to', () => {
    expect(Object.values(log.FILES).sort()).toEqual(
      NUTRITION_LOG_DOWNLOADS.map((d) => d.file).sort()
    );
    for (const { file } of NUTRITION_LOG_DOWNLOADS) {
      expect(existsSync(join(dir, file))).toBe(true);
    }
  });

  it('writes real PDFs with one page per day', () => {
    for (const file of [
      log.FILES.readyA4,
      log.FILES.readyLetter,
      log.FILES.per100A4,
      log.FILES.per100Letter,
    ]) {
      const bytes = readFileSync(join(dir, file)).toString('latin1');
      expect(bytes.startsWith('%PDF-')).toBe(true);
      expect(bytes.match(/\/Type \/Page\b(?!s)/g)).toHaveLength(log.PDF_SHEETS);
    }
  });

  it('writes a spreadsheet with the Day, Per 100 g and Read me tabs', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx');
    const book = XLSX.read(readFileSync(join(dir, log.FILES.xlsx)), { sheetStubs: true });
    expect(book.SheetNames).toEqual(['Day', 'Per 100 g', 'Read me']);

    const { headerRow, firstEntryRow, lastEntryRow, totalRow, goalRow, leftRow } = log.SHEET_LAYOUT;
    const day = book.Sheets.Day;
    log.DAY_COLUMNS.forEach((label: string, column: number) => {
      expect(day[`${String.fromCharCode(65 + column)}${headerRow}`].v).toBe(label);
    });
    expect(day[`D${totalRow}`].f).toBe(`ROUND(SUM(D${firstEntryRow}:D${lastEntryRow}),1)`);
    expect(day[`D${leftRow}`].f).toBe(`IF(D${goalRow}="","",ROUND(D${goalRow}-D${totalRow},1))`);

    const per100 = book.Sheets['Per 100 g'];
    log.PER100_COLUMNS.forEach((label: string, column: number) => {
      expect(per100[`${String.fromCharCode(65 + column)}${headerRow}`].v).toBe(label);
    });
    // Protein eaten (H) = protein per 100 g (C) x grams eaten (F) / 100.
    expect(per100[`H${firstEntryRow}`].f).toBe(
      `IF(OR(C${firstEntryRow}="",$F${firstEntryRow}=""),"",ROUND(C${firstEntryRow}*$F${firstEntryRow}/100,1))`
    );
    expect(per100[`H${lastEntryRow}`]).toBeDefined();
    expect(per100[`H${lastEntryRow + 1}`]).toBeUndefined();
    expect(per100[`G${totalRow}`].f).toBe(`ROUND(SUM(G${firstEntryRow}:G${lastEntryRow}),1)`);
  });

  it('matches the files committed under public/downloads (rerun npm run generate-nutrition-log)', () => {
    for (const { file } of NUTRITION_LOG_DOWNLOADS) {
      expect(readFileSync(join(PUBLISHED, file)).equals(readFileSync(join(dir, file)))).toBe(true);
    }
  });
});
