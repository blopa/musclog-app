/**
 * generate-manual.js
 * Generates a retro-style, square Game Boy GBC instruction booklet PDF for "Musclog GB".
 *
 * Dimensions: 4.75 x 4.75 inches (342 x 342 points)
 * Margins: 20 points uniform
 * Printable area: x: 20 to 322, y: 20 to 322 (width: 302, height: 302)
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Paths
const OUTPUT_FILE = path.join(__dirname, '../../musclog-manual.pdf');
const SCREENSHOT_DIR = path.join(__dirname, '../screenshots');
const CARTRIDGE_LABEL_IMAGE = path.join(__dirname, '../assets/musclog-gbc-label.png');

// Initialize PDF Document
const doc = new PDFDocument({
  size: [342, 342],
  margins: { top: 20, bottom: 20, left: 20, right: 20 },
  autoFirstPage: false, // Handle page creation manually to control layout/borders
});

// Pipe PDF document to file
const writeStream = fs.createWriteStream(OUTPUT_FILE);
doc.pipe(writeStream);

// Helper constants for positions
const PAGE_SIZE = 342;
const MARGIN = 20;
const PRINTABLE_WIDTH = PAGE_SIZE - MARGIN * 2; // 302
const PRINTABLE_HEIGHT = PAGE_SIZE - MARGIN * 2; // 302

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
      .text('MUSCLOG GB', MARGIN + 10, MARGIN + 10, { width: PRINTABLE_WIDTH - 20, align: 'left' });

    // Thin horizontal divider below header
    doc
      .lineWidth(0.5)
      .strokeColor('#000000')
      .moveTo(MARGIN + 10, MARGIN + 22)
      .lineTo(MARGIN + PRINTABLE_WIDTH - 10, MARGIN + 22)
      .stroke();
  }

  // 3. Draw running footer with page number (if applicable)
  if (hasFooter) {
    doc
      .font('Courier')
      .fontSize(8)
      .fillColor('#000000')
      .text(String(pageIndex), MARGIN + 10, MARGIN + PRINTABLE_HEIGHT - 18, {
        width: PRINTABLE_WIDTH - 20,
        align: 'center',
      });
  }
}

// ==========================================
// PAGE 1: COVER PAGE (No headers/footers)
// ==========================================
setupPage(1, false, false);

// Decorative double lines at top
doc
  .lineWidth(2)
  .strokeColor('#000000')
  .moveTo(MARGIN + 15, MARGIN + 25)
  .lineTo(MARGIN + PRINTABLE_WIDTH - 15, MARGIN + 25)
  .stroke();

doc
  .lineWidth(0.5)
  .strokeColor('#000000')
  .moveTo(MARGIN + 15, MARGIN + 30)
  .lineTo(MARGIN + PRINTABLE_WIDTH - 15, MARGIN + 30)
  .stroke();

// Title
doc
  .font('Courier-Bold')
  .fontSize(24)
  .fillColor('#000000')
  .text('MUSCLOG GB', MARGIN + 15, MARGIN + 42, { width: PRINTABLE_WIDTH - 30, align: 'center' });

// Subtitle
doc
  .font('Courier')
  .fontSize(10)
  .text('INSTRUCTION BOOKLET', MARGIN + 15, MARGIN + 70, {
    width: PRINTABLE_WIDTH - 30,
    align: 'center',
    characterSpacing: 1,
  });

// Cartridge label or default placeholder box
const artBoxX = MARGIN + 51; // Centered (302 - 200) / 2 = 51
const artBoxY = MARGIN + 95;
const artBoxW = 200;
const artBoxH = 150;

if (fs.existsSync(CARTRIDGE_LABEL_IMAGE)) {
  try {
    doc.image(CARTRIDGE_LABEL_IMAGE, artBoxX, artBoxY, {
      fit: [artBoxW, artBoxH],
      align: 'center',
      valign: 'center',
    });
    // Draw fine border around cover art
    doc.lineWidth(1).strokeColor('#000000').rect(artBoxX, artBoxY, artBoxW, artBoxH).stroke();
  } catch (err) {
    console.error('Error drawing cartridge label image:', err);
    drawFallbackCoverBox();
  }
} else {
  drawFallbackCoverBox();
}

function drawFallbackCoverBox() {
  doc.lineWidth(1).strokeColor('#000000').rect(artBoxX, artBoxY, artBoxW, artBoxH).stroke();

  doc
    .font('Courier-Bold')
    .fontSize(12)
    .text('MUSCLOG GB ART', artBoxX + 10, artBoxY + 65, { width: artBoxW - 20, align: 'center' });
}

// Bottom text: Retro publisher feel
doc
  .font('Courier-Bold')
  .fontSize(8)
  .fillColor('#000000')
  .text('LICENSED BY', MARGIN + 15, MARGIN + PRINTABLE_HEIGHT - 36, {
    width: PRINTABLE_WIDTH - 30,
    align: 'center',
  })
  .font('Courier')
  .text('NINTENDO', MARGIN + 15, MARGIN + PRINTABLE_HEIGHT - 26, {
    width: PRINTABLE_WIDTH - 30,
    align: 'center',
    characterSpacing: 2,
  });

// ==========================================
// PAGE 2: TABLE OF CONTENTS & WARNING
// ==========================================
setupPage(2, true, true);

// Header / Title
doc
  .font('Courier-Bold')
  .fontSize(14)
  .text('PRECAUTIONS & TOC', MARGIN + 15, MARGIN + 32, { align: 'center' });

// WARNINGS / PRECAUTIONS
const warningBoxY = MARGIN + 55;
doc
  .lineWidth(1)
  .strokeColor('#000000')
  .rect(MARGIN + 15, warningBoxY, PRINTABLE_WIDTH - 30, 75)
  .stroke();

doc
  .font('Courier-Bold')
  .fontSize(8)
  .text('★ WARNING: READ BEFORE PLAYING ★', MARGIN + 20, warningBoxY + 8, {
    width: PRINTABLE_WIDTH - 40,
    align: 'center',
  })
  .font('Courier')
  .fontSize(7)
  .text(
    'Take a 10 to 15 minute break every hour, even if you do not think you need it. Avoid playing if you are tired. If your hands, wrists, or arms become tired or sore, stop playing immediately and rest.',
    MARGIN + 25,
    warningBoxY + 22,
    {
      width: PRINTABLE_WIDTH - 50,
      align: 'justify',
      lineGap: 1.5,
    }
  );

// TABLE OF CONTENTS (Using Dot-leaders)
const tocY = MARGIN + 145;
doc
  .font('Courier-Bold')
  .fontSize(10)
  .text('TABLE OF CONTENTS', MARGIN + 15, tocY);

const tocItems = [
  { name: 'THE LEGEND OF MUSCLOG', page: '3' },
  { name: 'CONTROLS', page: '4' },
  { name: 'HOW TO PLAY - BASICS', page: '5' },
  { name: 'HOW TO PLAY - WORKOUTS', page: '6' },
  { name: 'MEMO / PASSWORD NOTES', page: '7' },
];

let itemY = tocY + 18;
doc.font('Courier').fontSize(8);

tocItems.forEach((item) => {
  const dotsCount = 42 - item.name.length;
  const dots = '.'.repeat(Math.max(3, dotsCount));

  doc.text(item.name, MARGIN + 15, itemY);
  // Align page number on the right
  doc.text(item.page, MARGIN + PRINTABLE_WIDTH - 25, itemY, { width: 15, align: 'right' });
  // Add leaders
  const textWidth = doc.widthOfString(item.name);
  doc.text(dots, MARGIN + 15 + textWidth + 3, itemY);

  itemY += 16;
});

// ==========================================
// PAGE 3: THE LEGEND (LORE)
// ==========================================
setupPage(3, true, true);

doc
  .font('Courier-Bold')
  .fontSize(14)
  .text('THE LEGEND', MARGIN + 15, MARGIN + 32, { align: 'center' });

doc
  .font('Courier-Bold')
  .fontSize(10)
  .text('A Muscle Journey Begins...', MARGIN + 15, MARGIN + 52);

doc
  .font('Courier')
  .fontSize(8.5)
  .text(
    'In a world where physical gains and nutrient balances have been forgotten, a lone lifter stands strong against the decay of stamina and iron.\n\n' +
      'Equipped with the legendary "Musclog" cartridge, your mission is to log daily foods, calculate calories, track body-weight trends, and complete intense free workouts.\n\n' +
      'The path to ultimate fitness is fraught with heavy sets and calorie math. Lift carefully, watch your macros, and write your name in the Hall of Iron!',
    MARGIN + 15,
    MARGIN + 72,
    {
      width: PRINTABLE_WIDTH - 30,
      align: 'justify',
      lineGap: 3,
    }
  );

// Graphic element at the bottom (retro barbell)
const barbellY = MARGIN + PRINTABLE_HEIGHT - 45;
doc
  .lineWidth(2)
  .strokeColor('#000000')
  .moveTo(MARGIN + 60, barbellY)
  .lineTo(MARGIN + PRINTABLE_WIDTH - 60, barbellY)
  .stroke();
// Plates left
doc.rect(MARGIN + 50, barbellY - 6, 10, 12).fill('#000000');
doc.rect(MARGIN + 44, barbellY - 10, 6, 20).fill('#000000');
// Plates right
doc.rect(MARGIN + PRINTABLE_WIDTH - 60, barbellY - 6, 10, 12).fill('#000000');
doc.rect(MARGIN + PRINTABLE_WIDTH - 50, barbellY - 10, 6, 20).fill('#000000');

// ==========================================
// PAGE 4: CONTROLS
// ==========================================
setupPage(4, true, true);

doc
  .font('Courier-Bold')
  .fontSize(14)
  .text('CONTROLS', MARGIN + 15, MARGIN + 32, { align: 'center' });

// Draw simple retro Game Boy controller overlay outline
const dpadX = MARGIN + 25;
const dpadY = MARGIN + 58;

// D-PAD drawing
doc.lineWidth(1.5).strokeColor('#000000');
// Vertical bar
doc.rect(dpadX + 8, dpadY, 8, 24).stroke();
// Horizontal bar
doc.rect(dpadX, dpadY + 8, 24, 8).stroke();
// Fill center intersection to look like a D-Pad
doc.rect(dpadX + 8, dpadY + 8, 8, 8).fill('#000000');

// Buttons A and B
const btnX = MARGIN + PRINTABLE_WIDTH - 70;
const btnY = MARGIN + 64;
// B Button
doc.circle(btnX, btnY, 6).stroke();
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
const selStartX = MARGIN + 90;
const selStartY = MARGIN + 80;
// Select
doc.lineWidth(1).rect(selStartX, selStartY, 14, 4).stroke();
// Start
doc.rect(selStartX + 22, selStartY, 14, 4).stroke();

// Descriptions
doc.font('Courier-Bold').fontSize(8).fillColor('#000000');
let controlY = MARGIN + 105;

const controlsList = [
  { btn: 'D-PAD', desc: 'Move cursor, scroll lists, and adjust spinners.' },
  { btn: 'A BUTTON', desc: 'Confirm selections, save set, or add a character.' },
  { btn: 'B BUTTON', desc: 'Go back, cancel actions, or delete characters.' },
  { btn: 'START', desc: 'Alternate confirm button (represented as "ST").' },
  { btn: 'SELECT', desc: 'Open menu for current active screen.' },
];

controlsList.forEach((item) => {
  doc.font('Courier-Bold').text(item.btn, MARGIN + 15, controlY, { width: 65 });
  doc
    .font('Courier')
    .text(item.desc, MARGIN + 85, controlY, { width: PRINTABLE_WIDTH - 100, align: 'left' });
  controlY += 34;
});

// ==========================================
// HELPER FOR HOW TO PLAY PAGES (DYNAMIC IMAGES)
// ==========================================
function getScreenshotPath(filename) {
  const fullPath = path.join(SCREENSHOT_DIR, filename);
  return fs.existsSync(fullPath) ? fullPath : null;
}

// ==========================================
// PAGE 5: HOW TO PLAY - BASICS
// ==========================================
setupPage(5, true, true);

doc
  .font('Courier-Bold')
  .fontSize(14)
  .text('HOW TO PLAY', MARGIN + 15, MARGIN + 32, { align: 'center' });

// First screen: Home Dashboard
const screen1 = getScreenshotPath('home-screen.png');
const screen2 = getScreenshotPath('track-food.png') || getScreenshotPath('nutrition.png');

const imgWidth = 100;
const imgHeight = 90; // Approx Game Boy resolution ratio

// Left section (Screen 1)
const col1X = MARGIN + 15;
const col2X = MARGIN + PRINTABLE_WIDTH - 15 - imgWidth;
const screensY = MARGIN + 55;

if (screen1) {
  doc.image(screen1, col1X, screensY, { width: imgWidth, height: imgHeight });
  doc.lineWidth(1).strokeColor('#000000').rect(col1X, screensY, imgWidth, imgHeight).stroke();
} else {
  // Fallback box
  doc.lineWidth(1).strokeColor('#000000').rect(col1X, screensY, imgWidth, imgHeight).stroke();
  doc
    .font('Courier-Bold')
    .fontSize(8)
    .text('HOME SCREEN', col1X + 10, screensY + 40, { width: imgWidth - 20, align: 'center' });
}

// Right section (Screen 2)
if (screen2) {
  doc.image(screen2, col2X, screensY, { width: imgWidth, height: imgHeight });
  doc.lineWidth(1).strokeColor('#000000').rect(col2X, screensY, imgWidth, imgHeight).stroke();
} else {
  doc.lineWidth(1).strokeColor('#000000').rect(col2X, screensY, imgWidth, imgHeight).stroke();
  doc
    .font('Courier-Bold')
    .fontSize(8)
    .text('TRACK DIARY', col2X + 10, screensY + 40, { width: imgWidth - 20, align: 'center' });
}

// Captions
doc
  .font('Courier-Bold')
  .fontSize(9)
  .text('1. Home Dashboard', col1X, screensY + imgHeight + 8);
doc
  .font('Courier')
  .fontSize(7.5)
  .text(
    'Monitor your daily calorie and macronutrient budgets directly on the home interface.',
    col1X,
    screensY + imgHeight + 20,
    { width: 125, align: 'justify' }
  );

doc
  .font('Courier-Bold')
  .fontSize(9)
  .text('2. Macro Logging', col2X, screensY + imgHeight + 8);
doc
  .font('Courier')
  .fontSize(7.5)
  .text(
    'Log pre-bundled foods or create custom entries easily. Keep your progress steady!',
    col2X,
    screensY + imgHeight + 20,
    { width: 125, align: 'justify' }
  );

// ==========================================
// PAGE 6: HOW TO PLAY - WORKOUTS
// ==========================================
setupPage(6, true, true);

doc
  .font('Courier-Bold')
  .fontSize(14)
  .text('WORKOUTS & PROGRESS', MARGIN + 15, MARGIN + 32, { align: 'center' });

const screen3 = getScreenshotPath('workout-session.png') || getScreenshotPath('workouts.png');
const screen4 = getScreenshotPath('progress.png');

if (screen3) {
  doc.image(screen3, col1X, screensY, { width: imgWidth, height: imgHeight });
  doc.lineWidth(1).strokeColor('#000000').rect(col1X, screensY, imgWidth, imgHeight).stroke();
} else {
  doc.lineWidth(1).strokeColor('#000000').rect(col1X, screensY, imgWidth, imgHeight).stroke();
  doc
    .font('Courier-Bold')
    .fontSize(8)
    .text('WORKOUT', col1X + 10, screensY + 40, { width: imgWidth - 20, align: 'center' });
}

if (screen4) {
  doc.image(screen4, col2X, screensY, { width: imgWidth, height: imgHeight });
  doc.lineWidth(1).strokeColor('#000000').rect(col2X, screensY, imgWidth, imgHeight).stroke();
} else {
  doc.lineWidth(1).strokeColor('#000000').rect(col2X, screensY, imgWidth, imgHeight).stroke();
  doc
    .font('Courier-Bold')
    .fontSize(8)
    .text('PROGRESS', col2X + 10, screensY + 40, { width: imgWidth - 20, align: 'center' });
}

// Captions
doc
  .font('Courier-Bold')
  .fontSize(9)
  .text('3. Workout Logging', col1X, screensY + imgHeight + 8);
doc
  .font('Courier')
  .fontSize(7.5)
  .text(
    'Log sets, reps, and load metrically. A 60-second rest timer keeps you focused.',
    col1X,
    screensY + imgHeight + 20,
    { width: 125, align: 'justify' }
  );

doc
  .font('Courier-Bold')
  .fontSize(9)
  .text('4. Progress Graphs', col2X, screensY + imgHeight + 8);
doc
  .font('Courier')
  .fontSize(7.5)
  .text(
    'Track body weight and calories on built-in charts. Press Up/Down to toggle views.',
    col2X,
    screensY + imgHeight + 20,
    { width: 125, align: 'justify' }
  );

// ==========================================
// PAGE 7: MEMO
// ==========================================
setupPage(7, true, true);

doc
  .font('Courier-Bold')
  .fontSize(14)
  .text('MEMO / PASSWORDS', MARGIN + 15, MARGIN + 32, { align: 'center' });

doc
  .font('Courier')
  .fontSize(8)
  .text(
    'Use this section to record high scores, custom food IDs, or passwords.',
    MARGIN + 15,
    MARGIN + 52,
    { width: PRINTABLE_WIDTH - 30, align: 'center' }
  );

// Draw writing lines (dotted/solid lines)
let lineY = MARGIN + 74;
doc.lineWidth(0.5).strokeColor('#555555');

for (let i = 0; i < 11; i++) {
  doc
    .moveTo(MARGIN + 15, lineY)
    .lineTo(MARGIN + PRINTABLE_WIDTH - 15, lineY)
    .stroke();
  lineY += 19;
}

// End & Save Document
doc.end();

writeStream.on('finish', () => {
  console.log(`PDF successfully generated at: ${OUTPUT_FILE}`);
});
