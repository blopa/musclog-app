/* eslint-disable no-undef */
/**
 * Writes the free printable food diary (PDF, A4 and US Letter, in two versions) and the spreadsheet
 * that /tools/nutrition-log-template offers, into public/downloads/.
 *
 *   npm run generate-nutrition-log
 *
 * Two versions, one sheet per day:
 *   - "ready": the calories and macros of what you ate, already worked out for the amount;
 *   - "per 100 g": the label's per-100 g numbers, a box for the grams eaten and boxes where you do
 *     the arithmetic yourself (per 100 g x grams / 100).
 *
 * Nothing here is hand-made: every file is rebuilt from this script, and the same run is what the
 * test pins. The spreadsheet does the per-100 g arithmetic with formulas. `pdfkit` is an optional
 * dependency (only needed here), so a missing install fails with a clear message.
 */
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'downloads');

/** The file names the page links to. The page's model (`nutritionLogTemplateModel.ts`) lists the same. */
const FILES = {
  readyA4: 'musclog-nutrition-log-a4.pdf',
  readyLetter: 'musclog-nutrition-log-letter.pdf',
  per100A4: 'musclog-nutrition-log-per-100g-a4.pdf',
  per100Letter: 'musclog-nutrition-log-per-100g-letter.pdf',
  xlsx: 'musclog-nutrition-log.xlsx',
};

/** Sheets in each PDF: one per day, so a print covers a week. */
const PDF_SHEETS = 7;
const ENTRY_ROWS = 12;

// ---------------------------------------------------------------------------------------------
// Spreadsheet
// ---------------------------------------------------------------------------------------------

/** Rows a day sheet holds in the spreadsheet. */
const SHEET_ENTRY_ROWS = 30;

/** Layout shared by both spreadsheet tabs (1-based rows, as spreadsheets count them). */
const SHEET_LAYOUT = {
  dateRow: 1,
  headerRow: 3,
  firstEntryRow: 4,
  lastEntryRow: 3 + SHEET_ENTRY_ROWS,
  totalRow: 3 + SHEET_ENTRY_ROWS + 2,
  goalRow: 3 + SHEET_ENTRY_ROWS + 3,
  leftRow: 3 + SHEET_ENTRY_ROWS + 4,
};

/** "Day" tab: macros already worked out for the amount eaten. */
const DAY_COLUMNS = [
  'Meal',
  'Food',
  'Amount (g)',
  'Calories',
  'Protein (g)',
  'Carbs (g)',
  'Fat (g)',
  'Notes',
];
/** Day tab columns that are added up (D to G, 0-based 3 to 6). */
const DAY_SUM_COLUMNS = [3, 4, 5, 6];

/** "Per 100 g" tab: the label's numbers, the grams eaten and the worked-out amounts. */
const PER100_COLUMNS = [
  'Food',
  'Calories per 100 g',
  'Protein per 100 g',
  'Carbs per 100 g',
  'Fat per 100 g',
  'Eaten (g)',
  'Calories eaten',
  'Protein eaten (g)',
  'Carbs eaten (g)',
  'Fat eaten (g)',
  'Notes',
];
/** Per 100 g tab columns that are added up (G to J, 0-based 6 to 9). */
const PER100_SUM_COLUMNS = [6, 7, 8, 9];

const README_ROWS = [
  ['Musclog food diary'],
  [''],
  ['How to use'],
  ['Day tab: for when you already know the calories and macros of what you ate.'],
  [
    '1. Write the meal, the food and the amount, then the calories, protein, carbs and fat for that amount.',
  ],
  [
    '2. The Total row adds the day up. Type your targets in the Goal row and Left shows what remains.',
  ],
  [''],
  ['Per 100 g tab: for when you only have the numbers printed per 100 g on a label.'],
  ['1. Write the food, then the calories, protein, carbs and fat per 100 g from the label.'],
  ['2. Write how many grams you ate. The columns on the right work out what that amount holds.'],
  [
    '3. The sums are: per 100 g x grams eaten / 100. Example: 12 g protein per 100 g, 150 g eaten: 12 x 150 / 100 = 18 g.',
  ],
  [''],
  [
    'Use one copy of the file per day, or add a tab for each day. Weigh food raw or cooked as the label states.',
  ],
  ['Free and open source: https://musclog.app'],
];

function cellRef(columnIndex, row) {
  return `${String.fromCharCode(65 + columnIndex)}${row}`;
}

/** Adds the Total, Goal and Left rows under a tab's entries. */
function addSummaryRows(sheet, labelColumn, sumColumns) {
  const { firstEntryRow, lastEntryRow, totalRow, goalRow, leftRow } = SHEET_LAYOUT;
  sheet[cellRef(labelColumn, totalRow)] = { t: 's', v: 'Total' };
  sheet[cellRef(labelColumn, goalRow)] = { t: 's', v: 'Goal' };
  sheet[cellRef(labelColumn, leftRow)] = { t: 's', v: 'Left' };
  for (const column of sumColumns) {
    const first = cellRef(column, firstEntryRow);
    const last = cellRef(column, lastEntryRow);
    sheet[cellRef(column, totalRow)] = { t: 'n', f: `ROUND(SUM(${first}:${last}),1)` };
    const goal = cellRef(column, goalRow);
    const total = cellRef(column, totalRow);
    sheet[cellRef(column, leftRow)] = {
      t: 'n',
      f: `IF(${goal}="","",ROUND(${goal}-${total},1))`,
    };
  }
}

function buildDaySheet() {
  const { dateRow, headerRow, leftRow } = SHEET_LAYOUT;
  const sheet = {};
  sheet[cellRef(0, dateRow)] = { t: 's', v: 'Date' };
  DAY_COLUMNS.forEach((label, column) => {
    sheet[cellRef(column, headerRow)] = { t: 's', v: label };
  });
  addSummaryRows(sheet, 2, DAY_SUM_COLUMNS);
  sheet['!ref'] = `A1:${cellRef(DAY_COLUMNS.length - 1, leftRow)}`;
  sheet['!cols'] = [14, 30, 12, 12, 13, 12, 10, 34].map((wch) => ({ wch }));
  return sheet;
}

function buildPer100Sheet() {
  const { dateRow, headerRow, firstEntryRow, lastEntryRow, leftRow } = SHEET_LAYOUT;
  const sheet = {};
  sheet[cellRef(0, dateRow)] = { t: 's', v: 'Date' };
  PER100_COLUMNS.forEach((label, column) => {
    sheet[cellRef(column, headerRow)] = { t: 's', v: label };
  });

  // Eaten amount = per 100 g x grams / 100, left empty until both numbers are typed.
  const grams = 5;
  for (let row = firstEntryRow; row <= lastEntryRow; row += 1) {
    for (let offset = 0; offset < 4; offset += 1) {
      const per100 = cellRef(1 + offset, row);
      const gramsCell = `$${String.fromCharCode(65 + grams)}${row}`;
      sheet[cellRef(6 + offset, row)] = {
        t: 'n',
        f: `IF(OR(${per100}="",${gramsCell}=""),"",ROUND(${per100}*${gramsCell}/100,1))`,
      };
    }
  }

  addSummaryRows(sheet, 5, PER100_SUM_COLUMNS);
  sheet['!ref'] = `A1:${cellRef(PER100_COLUMNS.length - 1, leftRow)}`;
  sheet['!cols'] = [30, 13, 13, 13, 13, 10, 13, 14, 13, 12, 34].map((wch) => ({ wch }));
  return sheet;
}

function buildXlsxBuffer() {
  const XLSX = require('xlsx');
  const readme = XLSX.utils.aoa_to_sheet(README_ROWS);
  readme['!cols'] = [{ wch: 120 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, buildDaySheet(), 'Day');
  XLSX.utils.book_append_sheet(book, buildPer100Sheet(), 'Per 100 g');
  XLSX.utils.book_append_sheet(book, readme, 'Read me');
  // Formulas carry no stored result: Excel, Sheets, Numbers and LibreOffice work them out on open.

  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}

// ---------------------------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------------------------

const PAGE_SIZES = {
  a4: { width: 841.89, height: 595.28 },
  letter: { width: 792, height: 612 },
};

const MARGIN = 36;
const INK = '#1a1a1a';
const MUTED = '#666666';
const RULE = '#999999';
const SOFT_RULE = '#cccccc';
const HEADER_ROW_HEIGHT = 15;
const ROW_HEIGHT = 24;

/**
 * Each version is a list of columns. A column with a `group` shares a header band with its
 * neighbours that carry the same `group`; one without a group spans both header rows.
 * `total` marks the columns the Total, Goal and Left boxes sit under.
 */
function readyColumns(usable) {
  const numbers = 56;
  const meal = 62;
  const amount = 64;
  const food = 180;
  const notes = usable - meal - food - amount - numbers * 4;
  return [
    { label: 'Meal', width: meal },
    { label: 'Food', width: food },
    { label: 'Amount (g)', width: amount },
    { label: 'Calories', width: numbers, total: true },
    { label: 'Protein (g)', width: numbers, total: true },
    { label: 'Carbs (g)', width: numbers, total: true },
    { label: 'Fat (g)', width: numbers, total: true },
    { label: 'Notes', width: notes },
  ];
}

function per100Columns(usable) {
  const per100 = 42;
  const grams = 56;
  const eaten = 52;
  const food = 150;
  const notes = usable - food - per100 * 4 - grams - eaten * 4;
  return [
    { label: 'Food', width: food },
    { label: 'kcal', width: per100, group: 'Per 100 g (from the label)' },
    { label: 'Protein', width: per100, group: 'Per 100 g (from the label)' },
    { label: 'Carbs', width: per100, group: 'Per 100 g (from the label)' },
    { label: 'Fat', width: per100, group: 'Per 100 g (from the label)' },
    { label: 'Eaten (g)', width: grams },
    { label: 'kcal', width: eaten, group: 'You ate: per 100 g x grams / 100', total: true },
    { label: 'Protein', width: eaten, group: 'You ate: per 100 g x grams / 100', total: true },
    { label: 'Carbs', width: eaten, group: 'You ate: per 100 g x grams / 100', total: true },
    { label: 'Fat', width: eaten, group: 'You ate: per 100 g x grams / 100', total: true },
    { label: 'Notes', width: notes },
  ];
}

const VERSIONS = {
  ready: {
    columns: readyColumns,
    title: 'Food diary',
    hint: 'Write the calories and macros for the amount you ate, not per 100 g: from the per-serving column of the label, a food app or a kitchen scale and your own sums.',
  },
  per100: {
    columns: per100Columns,
    title: 'Food diary: per 100 g',
    hint: 'Copy the per 100 g numbers from the label, write the grams you ate, then work out each amount: per 100 g x grams / 100. Example: 12 g protein per 100 g, 150 g eaten: 12 x 150 / 100 = 18 g.',
  },
};

function columnLefts(columns, x) {
  const lefts = [];
  let left = x;
  for (const column of columns) {
    lefts.push(left);
    left += column.width;
  }

  return lefts;
}

function drawHeader(doc, columns, x, y) {
  const lefts = columnLefts(columns, x);
  const bandHeight = HEADER_ROW_HEIGHT * 2;
  const grouped = columns.some((column) => column.group);

  doc.font('Helvetica-Bold').fontSize(9).fillColor(INK);
  let index = 0;
  while (index < columns.length) {
    const column = columns[index];
    if (grouped && column.group) {
      let end = index;
      while (end + 1 < columns.length && columns[end + 1].group === column.group) {
        end += 1;
      }

      const width = lefts[end] + columns[end].width - lefts[index];
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK);
      doc.text(column.group, lefts[index], y + 4, { width, align: 'center', lineBreak: false });
      for (let i = index; i <= end; i += 1) {
        doc.font('Helvetica').fontSize(8).fillColor(MUTED);
        doc.text(columns[i].label, lefts[i], y + HEADER_ROW_HEIGHT + 4, {
          width: columns[i].width,
          align: 'center',
          lineBreak: false,
        });
      }

      index = end + 1;
    } else {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(INK);
      doc.text(column.label, lefts[index] + 4, y + (grouped ? bandHeight / 2 - 5 : 10), {
        width: column.width - 8,
        align: column.total || column.label.startsWith('Eaten') ? 'center' : 'left',
        lineBreak: false,
      });
      index += 1;
    }
  }

  return { lefts, bandHeight };
}

function writePdf(version, size) {
  let PDFDocument;
  try {
    PDFDocument = require('pdfkit');
  } catch {
    throw new Error('pdfkit is not installed. Run `npm install` (it is an optional dependency).');
  }

  const { title, hint, columns: buildColumns } = VERSIONS[version];
  const { width, height } = PAGE_SIZES[size];
  const doc = new PDFDocument({
    size: [width, height],
    margin: MARGIN,
    autoFirstPage: false,
    info: {
      Title: `Musclog ${title.toLowerCase()}`,
      Author: 'Musclog',
      Subject: 'A printable food diary',
      // Fixed so the file is the same on every run.
      CreationDate: new Date('2026-01-01T00:00:00Z'),
    },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const usable = width - MARGIN * 2;
  const columns = buildColumns(usable);

  for (let sheet = 1; sheet <= PDF_SHEETS; sheet += 1) {
    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(20).fillColor(INK).text(title, MARGIN, MARGIN);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(`Day ${sheet} of ${PDF_SHEETS}`, MARGIN, MARGIN + 6, { width: usable, align: 'right' });

    // Header fields: a label and a line to write on.
    const fieldsY = MARGIN + 34;
    const fields = [
      ['Date', 170],
      ['Training or rest day', 170],
      ['Bodyweight', 110],
      ['Water', 90],
    ];
    let x = MARGIN;
    for (const [label, fieldWidth] of fields) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(MUTED)
        .text(label, x, fieldsY, { width: fieldWidth });
      doc
        .moveTo(x, fieldsY + 22)
        .lineTo(x + fieldWidth - 12, fieldsY + 22)
        .lineWidth(0.6)
        .strokeColor(RULE)
        .stroke();
      x += fieldWidth;
    }

    const tableY = fieldsY + 38;
    const { lefts, bandHeight } = drawHeader(doc, columns, MARGIN, tableY);

    const gridTop = tableY + bandHeight;
    const gridBottom = gridTop + ROW_HEIGHT * ENTRY_ROWS;
    doc.lineWidth(0.6).strokeColor(RULE);
    for (let row = 0; row <= ENTRY_ROWS; row += 1) {
      const y = gridTop + row * ROW_HEIGHT;
      doc
        .moveTo(MARGIN, y)
        .lineTo(MARGIN + usable, y)
        .stroke();
    }

    // Column rules: solid between groups, light and dashed inside one.
    for (let index = 0; index <= columns.length; index += 1) {
      const vx = index === columns.length ? MARGIN + usable : lefts[index];
      const insideGroup =
        index > 0 &&
        index < columns.length &&
        columns[index].group &&
        columns[index].group === columns[index - 1].group;
      if (insideGroup) {
        doc.strokeColor(SOFT_RULE).dash(2, { space: 2 });
        doc
          .moveTo(vx, gridTop - HEADER_ROW_HEIGHT)
          .lineTo(vx, gridBottom)
          .stroke();
        doc.undash().strokeColor(RULE);
      } else {
        doc.moveTo(vx, tableY).lineTo(vx, gridBottom).stroke();
      }
    }

    doc
      .moveTo(MARGIN, tableY)
      .lineTo(MARGIN + usable, tableY)
      .stroke();

    // Total, Goal and Left: boxes under the columns that are added up.
    const totalIndexes = columns.map((column, i) => (column.total ? i : -1)).filter((i) => i >= 0);
    const firstTotal = totalIndexes[0];
    const summaryLeft = lefts[firstTotal];
    const summaryWidth =
      lefts[totalIndexes[totalIndexes.length - 1]] +
      columns[totalIndexes[totalIndexes.length - 1]].width -
      summaryLeft;
    const summaryTop = gridBottom + 8;
    ['Total', 'Goal', 'Left'].forEach((label, rowIndex) => {
      const y = summaryTop + rowIndex * ROW_HEIGHT;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(INK);
      doc.text(label, summaryLeft - 80, y + 8, { width: 72, align: 'right', lineBreak: false });
      doc.lineWidth(0.6).strokeColor(RULE);
      doc.rect(summaryLeft, y, summaryWidth, ROW_HEIGHT).stroke();
      for (const index of totalIndexes.slice(1)) {
        doc
          .moveTo(lefts[index], y)
          .lineTo(lefts[index], y + ROW_HEIGHT)
          .stroke();
      }
    });

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(hint, MARGIN, summaryTop, { width: summaryLeft - 100 - MARGIN });
    doc.text(
      'Musclog: a free, open-source workout and nutrition tracker. https://musclog.app',
      MARGIN,
      // Inside the bottom margin: text that ends below it makes pdfkit add a page of its own.
      height - MARGIN - 14,
      { width: usable, align: 'center', lineBreak: false }
    );
  }

  doc.end();
  return done;
}

async function generate(outputDir = OUTPUT_DIR) {
  fs.mkdirSync(outputDir, { recursive: true });
  const outputs = {
    [FILES.readyA4]: await writePdf('ready', 'a4'),
    [FILES.readyLetter]: await writePdf('ready', 'letter'),
    [FILES.per100A4]: await writePdf('per100', 'a4'),
    [FILES.per100Letter]: await writePdf('per100', 'letter'),
    [FILES.xlsx]: buildXlsxBuffer(),
  };
  for (const [name, content] of Object.entries(outputs)) {
    fs.writeFileSync(path.join(outputDir, name), content);
  }

  return Object.keys(outputs);
}

module.exports = {
  FILES,
  PDF_SHEETS,
  SHEET_LAYOUT,
  DAY_COLUMNS,
  PER100_COLUMNS,
  generate,
  OUTPUT_DIR,
};

if (require.main === module) {
  generate().then(
    (names) =>
      console.log(`Wrote ${names.length} files to ${OUTPUT_DIR}:\n  ${names.join('\n  ')}`),
    (error) => {
      console.error(error.message);
      process.exit(1);
    }
  );
}
