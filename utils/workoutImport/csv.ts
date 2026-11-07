/**
 * RFC 4180 reader for workout exports. Every character is visited a constant
 * number of times (quoted runs are found with indexOf), so a 10 MB file parses
 * in linear time and no regex runs over the whole text.
 */

export type CsvDelimiter = ',' | ';';

export interface CsvRecord {
  /** 1-based line where the record starts; a quoted field may span later lines. */
  line: number;
  cells: string[];
}

export interface CsvTable {
  delimiter: CsvDelimiter;
  records: CsvRecord[];
}

const BOM = 0xfeff;
const QUOTE = 0x22;
const COMMA = 0x2c;
const SEMICOLON = 0x3b;
const LF = 0x0a;
const CR = 0x0d;

export function parseCsv(text: string): string[][] {
  return parseCsvTable(text).records.map((record) => record.cells);
}

export function parseCsvTable(text: string): CsvTable {
  const src = text.charCodeAt(0) === BOM ? text.slice(1) : text;
  const delimiter = sniffDelimiter(src);
  const delimiterCode = delimiter === ';' ? SEMICOLON : COMMA;
  const n = src.length;
  const records: CsvRecord[] = [];
  let i = 0;
  let line = 1;

  while (i < n) {
    const startLine = line;
    const cells: string[] = [];
    let ended = false;

    while (!ended) {
      let field: string;
      if (src.charCodeAt(i) === QUOTE) {
        const quoted = readQuoted(src, i + 1);
        // Lenient: text after the closing quote joins the field up to the next delimiter.
        let k = quoted.next;
        const tailStart = k;
        while (k < n && !isFieldEnd(src.charCodeAt(k), delimiterCode)) {
          k++;
        }

        field = quoted.value + src.slice(tailStart, k);
        line += quoted.breaks;
        i = k;
      } else {
        let k = i;
        while (k < n && !isFieldEnd(src.charCodeAt(k), delimiterCode)) {
          k++;
        }

        field = src.slice(i, k);
        i = k;
      }

      cells.push(field);

      if (i >= n) {
        ended = true;
      } else if (src.charCodeAt(i) === delimiterCode) {
        i++;
        if (i >= n) {
          // A trailing delimiter still means one more (empty) field.
          cells.push('');
          ended = true;
        }
      } else {
        const isCrLf = src.charCodeAt(i) === CR && src.charCodeAt(i + 1) === LF;
        i += isCrLf ? 2 : 1;
        line++;
        ended = true;
      }
    }

    if (!isBlankRecord(cells)) {
      records.push({ line: startLine, cells });
    }
  }

  return { delimiter, records };
}

/**
 * Reads the first non-blank line outside quotes and picks `;` only when it
 * occurs more often than `,`. Comma-decimal locales export semicolon files.
 */
function sniffDelimiter(src: string): CsvDelimiter {
  let i = 0;
  while (i < src.length && (src.charCodeAt(i) === LF || src.charCodeAt(i) === CR)) {
    i++;
  }

  let inQuotes = false;
  let commas = 0;
  let semicolons = 0;
  for (; i < src.length; i++) {
    const code = src.charCodeAt(i);
    if (code === QUOTE) {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (code === LF || code === CR) {
        break;
      }

      if (code === COMMA) {
        commas++;
      } else if (code === SEMICOLON) {
        semicolons++;
      }
    }
  }

  return semicolons > commas ? ';' : ',';
}

interface QuotedRead {
  value: string;
  next: number;
  breaks: number;
}

/** Reads a quoted field body starting after the opening quote. */
function readQuoted(src: string, start: number): QuotedRead {
  const parts: string[] = [];
  let breaks = 0;
  let pos = start;

  for (;;) {
    const quote = src.indexOf('"', pos);
    if (quote === -1) {
      const rest = src.slice(pos);
      parts.push(rest);
      breaks += countBreaks(rest);
      return { value: parts.join(''), next: src.length, breaks };
    }

    const chunk = src.slice(pos, quote);
    parts.push(chunk);
    breaks += countBreaks(chunk);

    if (src.charCodeAt(quote + 1) === QUOTE) {
      parts.push('"');
      pos = quote + 2;
    } else {
      return { value: parts.join(''), next: quote + 1, breaks };
    }
  }
}

function countBreaks(text: string): number {
  let count = 0;
  for (let k = 0; k < text.length; k++) {
    const code = text.charCodeAt(k);
    if (code === LF) {
      count++;
    } else if (code === CR && text.charCodeAt(k + 1) !== LF) {
      count++;
    }
  }

  return count;
}

function isFieldEnd(code: number, delimiterCode: number): boolean {
  return code === delimiterCode || code === LF || code === CR;
}

function isBlankRecord(cells: string[]): boolean {
  return cells.length === 1 && cells[0].trim() === '';
}
