import { parseCsv, parseCsvTable } from '../csv';

describe('parseCsv', () => {
  it('reads plain comma rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('keeps commas and newlines inside quoted fields and undoubles quotes', () => {
    const rows = parseCsv('name,notes\n"Bench, flat","line one\nline ""two"""\n');
    expect(rows).toEqual([
      ['name', 'notes'],
      ['Bench, flat', 'line one\nline "two"'],
    ]);
  });

  it('strips a leading BOM and accepts CRLF, LF and lone CR', () => {
    expect(parseCsv('\uFEFFa,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a,b\n1,2')).toEqual(parseCsv('a,b\r\n1,2'));
    expect(parseCsv('a,b\r1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('drops blank lines but keeps rows of empty cells', () => {
    expect(parseCsv('a,b\n\n   \n,\n')).toEqual([
      ['a', 'b'],
      ['', ''],
    ]);
  });

  it('sniffs semicolon files from the header only', () => {
    const table = parseCsvTable('Date;Weight;Notes\n2024-03-07;102,5;"a;b, c"');
    expect(table.delimiter).toBe(';');
    expect(table.records[1].cells).toEqual(['2024-03-07', '102,5', 'a;b, c']);
  });

  it('ignores commas inside a quoted header cell when sniffing', () => {
    const table = parseCsvTable('"a,b,c,d";x;y\n1;2;3');
    expect(table.delimiter).toBe(';');
  });

  it('reports the starting line of each record, counting lines inside quoted fields', () => {
    const table = parseCsvTable('h1,h2\n"multi\nline\nfield",x\n\nlast,row');
    expect(table.records.map((record) => record.line)).toEqual([1, 2, 6]);
    expect(table.records[1].cells).toEqual(['multi\nline\nfield', 'x']);
  });

  it('keeps an unterminated quote as the rest of the text instead of throwing', () => {
    expect(parseCsv('a,"open\nstill open')).toEqual([['a', 'open\nstill open']]);
  });

  it('parses a 10 MB file', () => {
    const row = '2024-03-07,"Bench, flat ""wide""",60,8\n';
    const text =
      'Date,Exercise,Weight,Reps\n' + row.repeat(Math.ceil((10 * 1024 * 1024) / row.length));
    const rows = parseCsv(text);
    expect(rows.length).toBeGreaterThan(100000);
    expect(rows[1]).toEqual(['2024-03-07', 'Bench, flat "wide"', '60', '8']);
  });
});
