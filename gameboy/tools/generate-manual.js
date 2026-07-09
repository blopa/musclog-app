/**
 * generate-manual.js
 * Generates a retro-style Game Boy GBC instruction booklet PDF for "Musclog GB".
 *
 * Dimensions: 4.5 x 3.25 inches landscape (324 x 234 points) — matches real
 *   GBC/GBA instruction booklets (4 1/2" long by 3 1/4" tall).
 * Margins: 20 points uniform
 * Printable area: x: 20 to 304, y: 20 to 214 (width: 284, height: 194)
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Paths
const OUTPUT_FILE = path.join(__dirname, '../../musclog-manual.pdf');
const SCREENSHOT_DIR = path.join(__dirname, '../screenshots');
const CARTRIDGE_LABEL_IMAGE = path.join(__dirname, '../assets/gameboy-cover.png');

// Page geometry (landscape: wider than tall)
const PAGE_WIDTH = 324; // 4.5"
const PAGE_HEIGHT = 234; // 3.25"
const MARGIN = 20;
const PRINTABLE_WIDTH = PAGE_WIDTH - MARGIN * 2; // 284
const PRINTABLE_HEIGHT = PAGE_HEIGHT - MARGIN * 2; // 194
const RIGHT = MARGIN + PRINTABLE_WIDTH; // 304
const BOTTOM = MARGIN + PRINTABLE_HEIGHT; // 214
const INNER_LEFT = MARGIN + 15; // 35
const INNER_RIGHT = RIGHT - 15; // 289

// Initialize PDF Document
const doc = new PDFDocument({
  size: [PAGE_WIDTH, PAGE_HEIGHT],
  margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
  autoFirstPage: false, // Handle page creation manually to control layout/borders
});

// Pipe PDF document to file
const writeStream = fs.createWriteStream(OUTPUT_FILE);
doc.pipe(writeStream);

// Common styles & drawings
function setupPage(pageIndex, hasHeader = true, hasFooter = true) {
  doc.addPage();

  // 1. Draw page border (2-point thick black border around printable area)
  doc
    .lineWidth(2)
    .strokeColor('#000000')
    .rect(MARGIN, MARGIN, PRINTABLE_WIDTH, PRINTABLE_HEIGHT)
    .stroke();

  // 2. Draw running header (if applicable)
  if (hasHeader) {
    doc
      .font('Courier-Bold')
      .fontSize(8)
      .fillColor('#000000')
      .text('MUSCLOG GB', MARGIN + 10, MARGIN + 8, { width: PRINTABLE_WIDTH - 20, align: 'left' });

    // Thin horizontal divider below header
    doc
      .lineWidth(0.5)
      .strokeColor('#000000')
      .moveTo(MARGIN + 10, MARGIN + 20)
      .lineTo(RIGHT - 10, MARGIN + 20)
      .stroke();
  }

  // 3. Draw running footer with page number (if applicable)
  if (hasFooter) {
    doc
      .font('Courier')
      .fontSize(8)
      .fillColor('#000000')
      .text(String(pageIndex), MARGIN + 10, BOTTOM - 16, {
        width: PRINTABLE_WIDTH - 20,
        align: 'center',
      });
  }
}

// ==========================================
// PAGE 1: COVER PAGE (No headers/footers)
// Knockout title banner (top) + framed hero art (left) + type block (right)
// ==========================================
setupPage(1, false, false);

// Inner decorative frame for a double-border "boxed manual" look
doc
  .lineWidth(0.75)
  .strokeColor('#000000')
  .rect(MARGIN + 6, MARGIN + 6, PRINTABLE_WIDTH - 12, PRINTABLE_HEIGHT - 12)
  .stroke();

// --- Title banner: white knockout text on a solid black bar ---
const bannerX = MARGIN + 14; // 34
const bannerY = MARGIN + 14; // 34
const bannerW = PRINTABLE_WIDTH - 28; // 256
const bannerH = 30;
doc.rect(bannerX, bannerY, bannerW, bannerH).fill('#000000');

// Small pixel accents flanking the title (retro touch)
const pixMid = bannerY + bannerH / 2 - 3;
doc.fillColor('#FFFFFF').rect(bannerX + 12, pixMid, 6, 6).fill('#FFFFFF');
doc.rect(bannerX + bannerW - 18, pixMid, 6, 6).fill('#FFFFFF');

doc
  .font('Courier-Bold')
  .fontSize(20)
  .fillColor('#FFFFFF')
  .text('MUSCLOG GB', bannerX, bannerY + 8, {
    width: bannerW,
    align: 'center',
    characterSpacing: 2,
  });

// --- Hero art (left), framed with a drop shadow for depth ---
// Box matches the source image aspect ratio (2100x1850 ~= 1.135) so it fills
// the frame exactly with no letterboxing.
const artW = 114;
const artH = 100;
const artX = MARGIN + 18; // 38
const artY = MARGIN + 64; // 84

function drawFallbackCoverBox() {
  doc
    .font('Courier-Bold')
    .fontSize(12)
    .fillColor('#000000')
    .text('MUSCLOG GB', artX + 8, artY + artH / 2 - 11, { width: artW - 16, align: 'center' })
    .fontSize(8)
    .text('ART', artX + 8, artY + artH / 2 + 4, { width: artW - 16, align: 'center' });
}

// Drop shadow behind the art (offset down-right)
doc.fillColor('#000000').rect(artX + 4, artY + 4, artW, artH).fill('#000000');
// White mask so any residual gap reads as clean white, never the shadow
doc.fillColor('#FFFFFF').rect(artX, artY, artW, artH).fill('#FFFFFF');

if (fs.existsSync(CARTRIDGE_LABEL_IMAGE)) {
  try {
    doc.image(CARTRIDGE_LABEL_IMAGE, artX, artY, {
      fit: [artW, artH],
      align: 'center',
      valign: 'center',
    });
  } catch (err) {
    console.error('Error drawing cartridge label image:', err);
    drawFallbackCoverBox();
  }
} else {
  drawFallbackCoverBox();
}
// Clean frame around the art
doc.lineWidth(1.5).strokeColor('#000000').rect(artX, artY, artW, artH).stroke();

// --- Type block (right column), vertically balanced against the art ---
const colX = artX + artW + 18; // 170
const colW = INNER_RIGHT - colX; // ~119

doc
  .font('Courier-Bold')
  .fontSize(15)
  .fillColor('#000000')
  .text('INSTRUCTION', colX, MARGIN + 70, { width: colW })
  .text('BOOKLET', colX, MARGIN + 88, { width: colW });

// Divider rule
doc
  .lineWidth(1)
  .strokeColor('#000000')
  .moveTo(colX, MARGIN + 114)
  .lineTo(colX + 104, MARGIN + 114)
  .stroke();

doc
  .font('Courier-Bold')
  .fontSize(7)
  .text('DEVELOPED BY', colX, MARGIN + 124, { width: colW, characterSpacing: 1 })
  .font('Courier-Bold')
  .fontSize(13)
  .text('BLOPA', colX, MARGIN + 134, { width: colW, characterSpacing: 3 });

// ==========================================
// PAGE 2: TABLE OF CONTENTS & WARNING
// Two columns: warning box (left) + TOC (right)
// ==========================================
setupPage(2, true, true);

doc
  .font('Courier-Bold')
  .fontSize(12)
  .text('PRECAUTIONS & TOC', MARGIN + 15, MARGIN + 26, {
    width: PRINTABLE_WIDTH - 30,
    align: 'center',
  });

// WARNINGS / PRECAUTIONS (left column)
const warnX = INNER_LEFT;
const warnY = MARGIN + 46;
const warnW = 122;
const warnH = 124;
doc.lineWidth(1).strokeColor('#000000').rect(warnX, warnY, warnW, warnH).stroke();

doc
  .font('Courier-Bold')
  .fontSize(7)
  .text('** WARNING **', warnX + 6, warnY + 8, { width: warnW - 12, align: 'center' })
  .font('Courier-Bold')
  .fontSize(6)
  .text('READ BEFORE PLAYING', warnX + 6, warnY + 20, { width: warnW - 12, align: 'center' })
  .font('Courier')
  .fontSize(6)
  .text(
    'Take a 10 to 15 minute break every hour, even if you do not think you need it. Avoid playing if you are tired. If your hands, wrists, or arms become sore, stop and rest.',
    warnX + 8,
    warnY + 36,
    {
      width: warnW - 16,
      align: 'justify',
      lineGap: 1.5,
    }
  );

// TABLE OF CONTENTS (right column, with dot-leaders)
const tocX = warnX + warnW + 14; // ~171
const tocRight = INNER_RIGHT;
const tocW = tocRight - tocX;

doc.font('Courier-Bold').fontSize(9).text('TABLE OF CONTENTS', tocX, MARGIN + 46, { width: tocW });

const tocItems = [
  { name: 'THE LEGEND', page: '3' },
  { name: 'CONTROLS', page: '4' },
  { name: 'HOW TO PLAY', page: '5' },
  { name: 'WORKOUTS', page: '6' },
  { name: 'MEMO / NOTES', page: '7' },
];

let itemY = MARGIN + 66;
doc.font('Courier').fontSize(7.5);
const dotWidth = doc.widthOfString('.');

tocItems.forEach((item) => {
  const nameWidth = doc.widthOfString(item.name);
  const pageWidth = doc.widthOfString(item.page);

  // Name on the left, page number pinned to the right edge
  doc.text(item.name, tocX, itemY, { lineBreak: false });
  doc.text(item.page, tocRight - pageWidth, itemY, { lineBreak: false });

  // Dot leaders filling the gap between them
  const dotsStart = tocX + nameWidth + 3;
  const dotsEnd = tocRight - pageWidth - 3;
  const dotsCount = Math.max(0, Math.floor((dotsEnd - dotsStart) / dotWidth));
  if (dotsCount > 0) {
    doc.text('.'.repeat(dotsCount), dotsStart, itemY, { lineBreak: false });
  }

  itemY += 18;
});

// ==========================================
// PAGE 3: THE LEGEND (LORE)
// ==========================================
setupPage(3, true, true);

doc
  .font('Courier-Bold')
  .fontSize(12)
  .text('THE LEGEND', MARGIN + 15, MARGIN + 26, { width: PRINTABLE_WIDTH - 30, align: 'center' });

doc
  .font('Courier-Bold')
  .fontSize(9)
  .text('A Muscle Journey Begins...', INNER_LEFT, MARGIN + 42);

doc
  .font('Courier')
  .fontSize(7)
  .text(
    'In a world where physical gains and nutrient balances have been forgotten, a lone lifter stands strong against the decay of stamina and iron.\n\n' +
      'Equipped with the legendary "Musclog" cartridge, your mission is to log daily foods, calculate calories, track body-weight trends, and complete intense free workouts.\n\n' +
      'The path to ultimate fitness is fraught with heavy sets and calorie math. Lift carefully, watch your macros, and write your name in the Hall of Iron!',
    INNER_LEFT,
    MARGIN + 56,
    {
      width: PRINTABLE_WIDTH - 30,
      align: 'justify',
      lineGap: 2,
    }
  );

// Graphic element at the bottom (retro barbell)
const barbellY = BOTTOM - 24;
const barLeft = MARGIN + 90;
const barRight = RIGHT - 90;
doc.lineWidth(2).strokeColor('#000000').moveTo(barLeft, barbellY).lineTo(barRight, barbellY).stroke();
// Plates left
doc.rect(barLeft - 10, barbellY - 6, 10, 12).fill('#000000');
doc.rect(barLeft - 16, barbellY - 10, 6, 20).fill('#000000');
// Plates right
doc.rect(barRight, barbellY - 6, 10, 12).fill('#000000');
doc.rect(barRight + 10, barbellY - 10, 6, 20).fill('#000000');

// ==========================================
// PAGE 4: CONTROLS
// Two columns: controller diagram (left) + descriptions (right)
// ==========================================
setupPage(4, true, true);

doc
  .font('Courier-Bold')
  .fontSize(12)
  .fillColor('#000000')
  .text('CONTROLS', MARGIN + 15, MARGIN + 26, { width: PRINTABLE_WIDTH - 30, align: 'center' });

// --- Controller diagram (left column) ---
const dpadX = MARGIN + 22;
const dpadY = MARGIN + 52;

doc.lineWidth(1.5).strokeColor('#000000');
// Vertical bar
doc.rect(dpadX + 8, dpadY, 8, 24).stroke();
// Horizontal bar
doc.rect(dpadX, dpadY + 8, 24, 8).stroke();
// Fill center intersection to look like a D-Pad
doc.rect(dpadX + 8, dpadY + 8, 8, 8).fill('#000000');

// Buttons A and B
const btnX = MARGIN + 66;
const btnY = MARGIN + 60;
// B Button
doc.lineWidth(1.5).strokeColor('#000000').circle(btnX, btnY, 6).stroke();
doc
  .font('Courier-Bold')
  .fontSize(7)
  .text('B', btnX - 2, btnY - 3);
// A Button
doc.circle(btnX + 18, btnY - 4, 6).stroke();
doc
  .font('Courier-Bold')
  .fontSize(7)
  .text('A', btnX + 16, btnY - 7);

// SELECT / START
const selStartX = MARGIN + 34;
const selStartY = MARGIN + 92;
doc.lineWidth(1).rect(selStartX, selStartY, 14, 4).stroke();
doc.rect(selStartX + 22, selStartY, 14, 4).stroke();
doc
  .font('Courier')
  .fontSize(5.5)
  .text('SEL', selStartX, selStartY + 6, { width: 14, align: 'center' })
  .text('ST', selStartX + 22, selStartY + 6, { width: 14, align: 'center' });

// --- Descriptions (right column) ---
const ctrlX = MARGIN + 118; // ~138
const ctrlW = INNER_RIGHT - ctrlX;
let controlY = MARGIN + 44;

const controlsList = [
  { btn: 'D-PAD', desc: 'Move cursor, scroll lists, adjust spinners.' },
  { btn: 'A BUTTON', desc: 'Confirm, save set, or add a character.' },
  { btn: 'B BUTTON', desc: 'Back, cancel, or delete characters.' },
  { btn: 'START', desc: 'Alternate confirm ("ST").' },
  { btn: 'SELECT', desc: 'Open menu for the active screen.' },
];

controlsList.forEach((item) => {
  doc.font('Courier-Bold').fontSize(7).fillColor('#000000').text(item.btn, ctrlX, controlY, { width: ctrlW });
  doc
    .font('Courier')
    .fontSize(6.5)
    .text(item.desc, ctrlX, controlY + 9, { width: ctrlW, align: 'left' });
  controlY += 26;
});

// ==========================================
// HELPER FOR HOW TO PLAY PAGES (DYNAMIC IMAGES)
// ==========================================
function getScreenshotPath(filename) {
  const fullPath = path.join(SCREENSHOT_DIR, filename);
  return fs.existsSync(fullPath) ? fullPath : null;
}

// Shared screenshot layout (two side-by-side screens)
const imgWidth = 108;
const imgHeight = 84;
const col1X = INNER_LEFT; // 35
const col2X = INNER_RIGHT - imgWidth; // 181
const screensY = MARGIN + 38; // 58

function drawScreen(imagePath, x, fallbackLabel) {
  if (imagePath) {
    doc.image(imagePath, x, screensY, { width: imgWidth, height: imgHeight });
    doc.lineWidth(1).strokeColor('#000000').rect(x, screensY, imgWidth, imgHeight).stroke();
  } else {
    doc.lineWidth(1).strokeColor('#000000').rect(x, screensY, imgWidth, imgHeight).stroke();
    doc
      .font('Courier-Bold')
      .fontSize(8)
      .fillColor('#000000')
      .text(fallbackLabel, x + 8, screensY + imgHeight / 2 - 4, {
        width: imgWidth - 16,
        align: 'center',
      });
  }
}

function drawCaption(x, title, body) {
  doc.font('Courier-Bold').fontSize(8).fillColor('#000000').text(title, x, screensY + imgHeight + 6);
  doc
    .font('Courier')
    .fontSize(6.5)
    .text(body, x, screensY + imgHeight + 17, { width: imgWidth, align: 'justify' });
}

// ==========================================
// PAGE 5: HOW TO PLAY - BASICS
// ==========================================
setupPage(5, true, true);

doc
  .font('Courier-Bold')
  .fontSize(12)
  .text('HOW TO PLAY', MARGIN + 15, MARGIN + 26, { width: PRINTABLE_WIDTH - 30, align: 'center' });

const screen1 = getScreenshotPath('home-screen.png');
const screen2 = getScreenshotPath('track-food.png') || getScreenshotPath('nutrition.png');

drawScreen(screen1, col1X, 'HOME SCREEN');
drawScreen(screen2, col2X, 'TRACK DIARY');

drawCaption(
  col1X,
  '1. Home Dashboard',
  'Monitor your daily calorie and macronutrient budgets on the home interface.'
);
drawCaption(
  col2X,
  '2. Macro Logging',
  'Log pre-bundled foods or create custom entries. Keep your progress steady!'
);

// ==========================================
// PAGE 6: HOW TO PLAY - WORKOUTS
// ==========================================
setupPage(6, true, true);

doc
  .font('Courier-Bold')
  .fontSize(12)
  .text('WORKOUTS & PROGRESS', MARGIN + 15, MARGIN + 26, {
    width: PRINTABLE_WIDTH - 30,
    align: 'center',
  });

const screen3 = getScreenshotPath('workout-session.png') || getScreenshotPath('workouts.png');
const screen4 = getScreenshotPath('progress.png');

drawScreen(screen3, col1X, 'WORKOUT');
drawScreen(screen4, col2X, 'PROGRESS');

drawCaption(
  col1X,
  '3. Workout Logging',
  'Log sets, reps, and load. A 60-second rest timer keeps you focused.'
);
drawCaption(
  col2X,
  '4. Progress Graphs',
  'Track body weight and calories on charts. Press Up/Down to toggle views.'
);

// ==========================================
// PAGE 7: MEMO
// ==========================================
setupPage(7, true, true);

doc
  .font('Courier-Bold')
  .fontSize(12)
  .text('MEMO / PASSWORDS', MARGIN + 15, MARGIN + 26, {
    width: PRINTABLE_WIDTH - 30,
    align: 'center',
  });

doc
  .font('Courier')
  .fontSize(7.5)
  .text('Record high scores, custom food IDs, or passwords.', MARGIN + 15, MARGIN + 44, {
    width: PRINTABLE_WIDTH - 30,
    align: 'center',
  });

// Draw writing lines
let lineY = MARGIN + 62;
doc.lineWidth(0.5).strokeColor('#555555');

while (lineY <= BOTTOM - 24) {
  doc.moveTo(INNER_LEFT, lineY).lineTo(INNER_RIGHT, lineY).stroke();
  lineY += 17;
}

// End & Save Document
doc.end();

writeStream.on('finish', () => {
  console.log(`PDF successfully generated at: ${OUTPUT_FILE}`);
});
