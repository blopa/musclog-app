import { parseDateText, parseImportDate } from '../parseDate';

// Fixed reference: 5 November 2026, midday, local time.
const NOW = new Date(2026, 10, 5, 12, 0);

function ok(cell: string) {
  const result = parseImportDate(cell, NOW);
  if (result.kind !== 'ok') {
    throw new Error(`expected ok for "${cell}", got ${result.kind}`);
  }
  return { day: result.day, startMinutes: result.startMinutes };
}

describe('parseImportDate wall-clock forms', () => {
  it.each([
    ['2024-03-07', '2024-03-07', null],
    ['2024-03-07 18:51:52', '2024-03-07', 18 * 60 + 51],
    ['2024-03-07T18:51', '2024-03-07', 18 * 60 + 51],
    ['2024/03/07', '2024-03-07', null],
    ['2024.03.07', '2024-03-07', null],
  ])('reads %s', (cell, day, minutes) => {
    expect(ok(cell)).toEqual({ day, startMinutes: minutes });
  });

  it('keeps a wall-clock time exactly as written', () => {
    expect(ok('2024-03-07 00:00:00')).toEqual({ day: '2024-03-07', startMinutes: 0 });
    expect(ok('2024-03-07 23:59')).toEqual({ day: '2024-03-07', startMinutes: 23 * 60 + 59 });
  });

  it('reads 12-hour clock forms', () => {
    expect(ok('2024-03-07 8:05 PM')).toEqual({ day: '2024-03-07', startMinutes: 20 * 60 + 5 });
    expect(ok('2024-03-07 12:30 am')).toEqual({ day: '2024-03-07', startMinutes: 30 });
    expect(ok('Dec 22, 2025 12:15 PM')).toEqual({ day: '2025-12-22', startMinutes: 12 * 60 + 15 });
  });

  it('reads numeric day-first dates and settles ambiguity day-first', () => {
    expect(ok('07/03/2024')).toEqual({ day: '2024-03-07', startMinutes: null });
    expect(ok('03/07/2024')).toEqual({ day: '2024-07-03', startMinutes: null });
    // A part above 12 settles the order.
    expect(ok('25/03/2024')).toEqual({ day: '2024-03-25', startMinutes: null });
    expect(ok('03/25/2024')).toEqual({ day: '2024-03-25', startMinutes: null });
  });
});

describe('parseImportDate localised month words', () => {
  it.each([
    ['22 Dec 2025, 08:00', '2025-12-22', 8 * 60],
    ['Dec 22, 2025 8:00', '2025-12-22', 8 * 60],
    ['21 août 2024, 18:00', '2024-08-21', 18 * 60],
    ['3 févr. 2024, 07:30', '2024-02-03', 7 * 60 + 30],
    ['12 mrt 2024', '2024-03-12', null],
    ['12 maart 2024', '2024-03-12', null],
    ['5 juin 2024', '2024-06-05', null],
    ['5 juil. 2024', '2024-07-05', null],
    ['1 de janeiro de 2024', '2024-01-01', null],
    ['4 de dezembro de 2024', '2024-12-04', null],
    ['2 ene 2024', '2024-01-02', null],
    ['2 abr 2024', '2024-04-02', null],
    ['9 mag 2024', '2024-05-09', null],
    ['9 Mai 2024', '2024-05-09', null],
    ['9 Okt 2024', '2024-10-09', null],
    ['6 März 2024', '2024-03-06', null],
    ['7 sept. 2024', '2024-09-07', null],
    ['7 dic 2024', '2024-12-07', null],
  ])('reads %s', (cell, day, minutes) => {
    expect(ok(cell)).toEqual({ day, startMinutes: minutes });
  });

  it('tells juin and juil apart by the whole word', () => {
    expect(ok('1 juin 2024').day).toBe('2024-06-01');
    expect(ok('1 juil 2024').day).toBe('2024-07-01');
  });
});

describe('parseImportDate zoned timestamps', () => {
  it('converts a zoned instant to the local day and minute', () => {
    const iso = '2024-03-07T23:30:00+02:00';
    const instant = new Date(iso);
    const expectedDay = [
      instant.getFullYear(),
      String(instant.getMonth() + 1).padStart(2, '0'),
      String(instant.getDate()).padStart(2, '0'),
    ].join('-');
    const expectedMinutes = instant.getHours() * 60 + instant.getMinutes();
    expect(ok(iso)).toEqual({ day: expectedDay, startMinutes: expectedMinutes });
  });

  it('treats Z as UTC', () => {
    const instant = new Date('2024-03-07T10:00:00Z');
    expect(ok('2024-03-07T10:00:00Z').startMinutes).toBe(
      instant.getHours() * 60 + instant.getMinutes()
    );
  });

  it('keeps the offset arithmetic exact for +hhmm forms', () => {
    const a = parseDateText('2024-03-07 10:00 +0200');
    const b = parseDateText('2024-03-07T08:00:00Z');
    expect(a?.zoned).toBe(true);
    expect(b?.zoned).toBe(true);
    expect(a && b && a.ms).toBe(b && b.ms);
  });
});

describe('parseImportDate rejects', () => {
  it.each([
    '2024-02-31',
    '2023-02-29',
    '2024-13-01',
    '2024-03-07 24:00',
    '2024-03-07 12:60',
    '2024-03-07 13:00 PM',
    '1899-12-31',
    'not a date',
    '',
    '18:51',
    '2024-03-07 18:51 +25:00',
    '2024-03-07 18:51:52 extra words',
  ])('rejects %j as a bad date', (cell) => {
    expect(parseImportDate(cell, NOW)).toEqual({ kind: 'badDate' });
  });

  it('rejects anything more than one day after now as a future date', () => {
    expect(parseImportDate('2026-11-07', NOW)).toEqual({ kind: 'futureDate' });
    expect(parseImportDate('2026-12-31 08:00', NOW)).toEqual({ kind: 'futureDate' });
    expect(parseImportDate('2026-11-07T09:00:00Z', NOW)).toEqual({ kind: 'futureDate' });
  });

  it('accepts tomorrow', () => {
    expect(ok('2026-11-06').day).toBe('2026-11-06');
  });

  it('returns null from the text parser for non-dates', () => {
    expect(parseDateText('nope')).toBeNull();
  });

  it('survives very long input', () => {
    expect(parseImportDate('2024 '.repeat(5000), NOW)).toEqual({ kind: 'badDate' });
  });
});
