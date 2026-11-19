/**
 * Writes the free printable workout log (PDF, A4 and US Letter) and the spreadsheet template (XLSX
 * and CSV) that /tools/workout-log-template offers, into public/downloads/.
 *
 *   npm run generate-workout-log
 *
 * Nothing here is hand-made: every file is rebuilt from this script, and the same run is what the
 * test pins. The spreadsheet uses the column layout Musclog's own workout importer reads (the
 * "Strong" layout), so a filled sheet saved as CSV imports into the app without conversion.
 * `pdfkit` is an optional dependency (it is only needed here), so a missing install fails with a
 * clear message instead of a stack trace.
 */
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'downloads');

/** The file names the page links to. The page's model (`workoutLogTemplateModel.ts`) lists the same. */
const FILES = {
  pdfA4: 'musclog-workout-log-a4.pdf',
  pdfLetter: 'musclog-workout-log-letter.pdf',
  xlsx: 'musclog-workout-log.xlsx',
  csv: 'musclog-workout-log.csv',
};

/** Columns of the spreadsheet, in the order and under the names the app's importer detects. */
const LOG_COLUMNS = [
  'Date',
  'Workout Name',
  'Exercise Name',
  'Set Order',
  'Weight',
  'Reps',
  'RPE',
  'Notes',
];

/**
 * One example row, so the layout is obvious. The note says to delete it: left in, it would import
 * as a real set.
 */
const EXAMPLE_ROW = [
  '2026-01-05 18:10:00',
  'Push Day',
  'Bench Press (Barbell)',
  '1',
  '60',
  '8',
  '8',
  'Example row: delete this line',
];

const README_ROWS = [
  ['Musclog workout log'],
  [''],
  ['How to use'],
  ['1. Go to the Log sheet and delete the example row.'],
  [
    '2. Write one row per set: the date, the workout, the exercise, the set number, the weight and the reps.',
  ],
  ['3. Weight is a plain number in the unit you always use. Leave Reps empty for a timed set.'],
  ['4. RPE is optional: 10 is a set with nothing left, 9 leaves one rep, 8 leaves two.'],
  [
    '5. To move it into the Musclog app, save the Log sheet as CSV and use Settings > Backups and data > Import workouts.',
  ],
  [''],
  ['Free and open source: https://musclog.app'],
];

const csvCell = (value) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** The CSV template: the header and the example row. */
function buildCsv() {
  return `${[LOG_COLUMNS, EXAMPLE_ROW].map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

function buildXlsxBuffer() {
  const XLSX = require('xlsx');
  const log = XLSX.utils.aoa_to_sheet([LOG_COLUMNS, EXAMPLE_ROW]);
  log['!cols'] = [20, 18, 28, 10, 10, 8, 8, 34].map((wch) => ({ wch }));
  const readme = XLSX.utils.aoa_to_sheet(README_ROWS);
  readme['!cols'] = [{ wch: 110 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, log, 'Log');
  XLSX.utils.book_append_sheet(book, readme, 'Read me');

  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}

const PAGE_SIZES = {
  a4: { width: 841.89, height: 595.28 },
  letter: { width: 792, height: 612 },
};

/** Sheets in each PDF: a small log book, printed once and used for a few weeks. */
const PDF_SHEETS = 4;
const EXERCISE_ROWS = 12;
const SET_COLUMNS = 5;
const MARGIN = 36;
const INK = '#1a1a1a';
const MUTED = '#666666';
const RULE = '#999999';

function writePdf(size) {
  let PDFDocument;
  try {
    PDFDocument = require('pdfkit');
  } catch {
    throw new Error('pdfkit is not installed. Run `npm install` (it is an optional dependency).');
  }

  const { width, height } = PAGE_SIZES[size];
  const doc = new PDFDocument({
    size: [width, height],
    margin: MARGIN,
    autoFirstPage: false,
    info: {
      Title: 'Musclog workout log',
      Author: 'Musclog',
      Subject: 'A printable workout log',
      // Fixed so the file is the same on every run.
      CreationDate: new Date('2026-01-01T00:00:00Z'),
    },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const usable = width - MARGIN * 2;
  const exerciseWidth = 170;
  const weightWidth = 44;
  const repsWidth = 34;
  const setWidth = weightWidth + repsWidth;
  const notesWidth = usable - exerciseWidth - setWidth * SET_COLUMNS;
  const rowHeight = 28;

  for (let sheet = 1; sheet <= PDF_SHEETS; sheet += 1) {
    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(20).fillColor(INK).text('Workout log', MARGIN, MARGIN);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(`Sheet ${sheet} of ${PDF_SHEETS}`, MARGIN, MARGIN + 6, {
        width: usable,
        align: 'right',
      });

    // Header fields: a label and a line to write on.
    const fieldsY = MARGIN + 38;
    const fields = [
      ['Date', 150],
      ['Workout', 240],
      ['Bodyweight', 110],
      ['Unit (kg / lb)', 90],
    ];
    let x = MARGIN;
    for (const [label, fieldWidth] of fields) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(MUTED)
        .text(label, x, fieldsY, { width: fieldWidth });
      doc
        .moveTo(x, fieldsY + 24)
        .lineTo(x + fieldWidth - 12, fieldsY + 24)
        .lineWidth(0.6)
        .strokeColor(RULE)
        .stroke();
      x += fieldWidth;
    }

    // Table header: "Exercise", "Set n" over "Weight | Reps", "Notes".
    const tableY = fieldsY + 42;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(INK);
    doc.text('Exercise', MARGIN + 4, tableY + 14, { width: exerciseWidth });
    for (let set = 0; set < SET_COLUMNS; set += 1) {
      const left = MARGIN + exerciseWidth + set * setWidth;
      doc.text(`Set ${set + 1}`, left, tableY + 2, { width: setWidth, align: 'center' });
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED);
      doc.text('Weight', left, tableY + 15, { width: weightWidth, align: 'center' });
      doc.text('Reps', left + weightWidth, tableY + 15, { width: repsWidth, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(INK);
    }
    doc.text('Notes', MARGIN + exerciseWidth + setWidth * SET_COLUMNS + 6, tableY + 14, {
      width: notesWidth,
    });

    // Grid.
    const gridTop = tableY + 30;
    const gridBottom = gridTop + rowHeight * EXERCISE_ROWS;
    doc.lineWidth(0.6).strokeColor(RULE);
    for (let row = 0; row <= EXERCISE_ROWS; row += 1) {
      const y = gridTop + row * rowHeight;
      doc
        .moveTo(MARGIN, y)
        .lineTo(MARGIN + usable, y)
        .stroke();
    }

    const verticals = [MARGIN, MARGIN + exerciseWidth];
    for (let set = 1; set <= SET_COLUMNS; set += 1) {
      verticals.push(MARGIN + exerciseWidth + set * setWidth);
    }

    verticals.push(MARGIN + usable);
    for (const vx of verticals) {
      doc
        .moveTo(vx, gridTop - 30)
        .lineTo(vx, gridBottom)
        .stroke();
    }

    // The weight | reps split inside each set, lighter than the set borders.
    doc.strokeColor('#cccccc').dash(2, { space: 2 });
    for (let set = 0; set < SET_COLUMNS; set += 1) {
      const vx = MARGIN + exerciseWidth + set * setWidth + weightWidth;
      doc
        .moveTo(vx, gridTop - 15)
        .lineTo(vx, gridBottom)
        .stroke();
    }

    doc.undash();
    doc
      .moveTo(MARGIN, gridTop - 30)
      .lineTo(MARGIN + usable, gridTop - 30)
      .strokeColor(RULE)
      .stroke();

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        'Write the weight and the reps of every set. Use Notes for how hard a set felt and anything that hurt.',
        MARGIN,
        gridBottom + 12,
        { width: usable }
      );
    doc.text(
      'Musclog: a free, open-source workout and nutrition tracker. https://musclog.app',
      MARGIN,
      height - MARGIN - 4,
      {
        width: usable,
        align: 'center',
      }
    );
  }

  doc.end();
  return done;
}

async function generate(outputDir = OUTPUT_DIR) {
  fs.mkdirSync(outputDir, { recursive: true });
  const outputs = {
    [FILES.pdfA4]: await writePdf('a4'),
    [FILES.pdfLetter]: await writePdf('letter'),
    [FILES.xlsx]: buildXlsxBuffer(),
    [FILES.csv]: Buffer.from(buildCsv(), 'utf8'),
  };
  for (const [name, content] of Object.entries(outputs)) {
    fs.writeFileSync(path.join(outputDir, name), content);
  }

  return Object.keys(outputs);
}

module.exports = { FILES, LOG_COLUMNS, EXAMPLE_ROW, PDF_SHEETS, buildCsv, generate, OUTPUT_DIR };

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
