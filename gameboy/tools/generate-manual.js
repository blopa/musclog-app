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
doc
  .fillColor('#FFFFFF')
  .rect(bannerX + 12, pixMid, 6, 6)
  .fill('#FFFFFF');
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
doc
  .fillColor('#000000')
  .rect(artX + 4, artY + 4, artW, artH)
  .fill('#000000');
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
// FEATURE CHAPTERS
// One manual page per feature. Defined here so the Table of Contents and the
// feature pages are generated from the same source and never drift apart.
// ==========================================
const featureChapters = [
  {
    tocName: 'GETTING STARTED',
    title: 'GETTING STARTED',
    screenshot: 'onboarding.png',
    fallback: 'ONBOARDING',
    heading: 'CREATE YOUR LIFTER',
    body:
      'On first boot the cartridge guides you through setup: unit system, gender, ' +
      'activity level, age, height, weight, lifting experience, fitness focus, and ' +
      'weight goal. Your answers forge a training profile that powers every screen.',
  },
  {
    tocName: 'MACRO GOALS',
    title: 'MACRO GOALS',
    screenshot: 'macro-goals-overview.png',
    fallback: 'MACRO GOALS',
    heading: 'YOUR DAILY GOALS',
    body:
      'From your profile the game calculates daily targets for calories, protein, ' +
      'carbs, fat, and fiber. Review them on the overview screen and fine-tune any ' +
      'value before saving. Change your mind later? Edit them from Settings.',
  },
  {
    tocName: 'SET THE CLOCK',
    title: 'SET THE CLOCK',
    screenshot: 'set-date.png',
    fallback: 'DATE SETUP',
    heading: 'SET THE CLOCK',
    body:
      'Musclog GB keeps a real-time clock so every log carries a true calendar date. ' +
      'Set the date and time once; the battery-backed cartridge remembers it through ' +
      'power-offs. With no clock set, your journey begins on 2026-01-01.',
  },
  {
    tocName: 'HOME DASHBOARD',
    title: 'HOME DASHBOARD',
    screenshot: 'home-screen.png',
    fallback: 'HOME',
    heading: 'THE DASHBOARD',
    body:
      "Your base camp. Today's calories, protein, digestible carbs, fat, and fiber are " +
      'shown against your goals at a glance. Press SELECT to open the menu and travel to ' +
      'nutrition, workouts, body weight, progress, or settings.',
  },
  {
    tocName: 'LOGGING FOOD',
    title: 'LOGGING FOOD',
    screenshot: 'track-food.png',
    fallback: 'TRACK FOOD',
    heading: 'LOG YOUR FOOD',
    body:
      'Choose a date, search by name, and log a serving in grams or ounces. 517 foods ' +
      'are built into the ROM: 215 USDA foundation foods and 302 everyday staples. Open ' +
      'a food to inspect its macros, or delete an entry logged by mistake.',
  },
  {
    tocName: 'CUSTOM FOODS',
    title: 'CUSTOM FOODS',
    screenshot: 'food-filter.png',
    fallback: 'FOOD SEARCH',
    heading: 'SEARCH & CREATE',
    body:
      "Prefix search finds foods fast. Can't find yours? Create up to 100 custom foods " +
      'on-cart with calories, carbs, fiber, fat, and protein per 100 g. Custom foods ' +
      'appear first in results and are marked with a star (*).',
  },
  {
    tocName: 'NUTRITION DIARY',
    title: 'NUTRITION DIARY',
    screenshot: 'nutrition.png',
    fallback: 'DIARY',
    heading: 'THE DIARY',
    body:
      'Every meal logged for the day, totaled and measured against your goals. The carbs ' +
      'bar shows digestible carbs (carbs minus fiber) while fiber earns its own bar, so ' +
      'nothing is double-counted. Review, inspect, or remove entries.',
  },
  {
    tocName: 'PROGRESS',
    title: 'PROGRESS & CHARTS',
    screenshot: 'progress.png',
    fallback: 'PROGRESS',
    heading: 'TRACK YOUR GAINS',
    body:
      'The progress dashboard pages through charts over a rolling 7- or 30-day window ' +
      '(toggle with Up/Down): muscle groups hit, workout counts, days logged, average ' +
      'macros, per-day bar charts, and your body-weight trend. Left/Right cycle pages.',
  },
  {
    tocName: 'FREE WORKOUTS',
    title: 'FREE WORKOUTS',
    screenshot: 'workout-session.png',
    fallback: 'WORKOUT',
    heading: 'FREE WORKOUTS',
    body:
      'Start a free session, filter exercises by muscle group, and lift. The game ' +
      'suggests starting weights; you edit sets, weights, and reps as you go. 198 ' +
      'exercises across 9 muscle groups are built in. Finished sessions are saved.',
  },
  {
    tocName: 'REST TIMER',
    title: 'REST TIMER',
    screenshot: 'rest-timer.png',
    fallback: 'REST TIMER',
    heading: 'CATCH YOUR BREATH',
    body:
      'Between sets a 60-second rest timer keeps you honest and focused. Recover, then ' +
      'jump back in for the next set without losing your place in the session.',
  },
  {
    tocName: 'WORKOUT HISTORY',
    title: 'WORKOUT HISTORY',
    screenshot: 'workouts.png',
    fallback: 'HISTORY',
    heading: 'HALL OF IRON',
    body:
      'Every completed session is battery-saved with its full set data. Revisit past ' +
      'workouts to see what you lifted, track your consistency, and prove your progress ' +
      'over time.',
  },
  {
    tocName: 'SETTINGS',
    title: 'SETTINGS',
    screenshot: 'settings.png',
    fallback: 'SETTINGS',
    heading: 'SETTINGS',
    body:
      'Update your profile, macro goals, and unit system whenever your journey changes. ' +
      'Toggle sound effects and the soundtrack, or reset all saved data to begin a new ' +
      'legend from scratch.',
  },
];

const FEATURES_START = 5; // page number of the first feature page
const memoPage = FEATURES_START + featureChapters.length;

// ==========================================
// PAGE 2: TABLE OF CONTENTS (full page, two columns)
// ==========================================
setupPage(2, true, true);

doc
  .font('Courier-Bold')
  .fontSize(13)
  .fillColor('#000000')
  .text('TABLE OF CONTENTS', MARGIN + 15, MARGIN + 24, {
    width: PRINTABLE_WIDTH - 30,
    align: 'center',
  });

doc
  .lineWidth(1)
  .strokeColor('#000000')
  .moveTo(MARGIN + 60, MARGIN + 40)
  .lineTo(RIGHT - 60, MARGIN + 40)
  .stroke();

const tocEntries = [
  { name: 'THE LEGEND', page: 3 },
  { name: 'CONTROLS', page: 4 },
  ...featureChapters.map((chapter, i) => ({ name: chapter.tocName, page: FEATURES_START + i })),
  { name: 'MEMO / NOTES', page: memoPage },
];

const tocTop = MARGIN + 50; // 70
const tocRowH = 15;
const tocPerCol = Math.ceil(tocEntries.length / 2);
const tocColLeftX = INNER_LEFT; // 35
const tocColLeftRight = 153;
const tocColRightX = 171;
const tocColRightRight = INNER_RIGHT; // 289

doc.font('Courier').fontSize(8).fillColor('#000000');
const tocDotWidth = doc.widthOfString('.');

tocEntries.forEach((item, i) => {
  const col = Math.floor(i / tocPerCol);
  const row = i % tocPerCol;
  const colX = col === 0 ? tocColLeftX : tocColRightX;
  const colRight = col === 0 ? tocColLeftRight : tocColRightRight;
  const y = tocTop + row * tocRowH;

  const pageStr = String(item.page);
  const nameWidth = doc.widthOfString(item.name);
  const pageWidth = doc.widthOfString(pageStr);

  // Name on the left, page number pinned to the right edge, dots between
  doc.text(item.name, colX, y, { lineBreak: false });
  doc.text(pageStr, colRight - pageWidth, y, { lineBreak: false });

  const dotsStart = colX + nameWidth + 3;
  const dotsEnd = colRight - pageWidth - 3;
  const dotsCount = Math.max(0, Math.floor((dotsEnd - dotsStart) / tocDotWidth));
  if (dotsCount > 0) {
    doc.text('.'.repeat(dotsCount), dotsStart, y, { lineBreak: false });
  }
});

// ==========================================
// PAGE 3: THE LEGEND + PRECAUTIONS
// Lore (left column) + warning box (right column)
// ==========================================
setupPage(3, true, true);

doc
  .font('Courier-Bold')
  .fontSize(12)
  .fillColor('#000000')
  .text('THE LEGEND', MARGIN + 15, MARGIN + 26, { width: PRINTABLE_WIDTH - 30, align: 'center' });

// --- Lore (left column) ---
const loreX = INNER_LEFT;
const loreW = 150;

doc
  .font('Courier-Bold')
  .fontSize(8)
  .text('A Muscle Journey Begins...', loreX, MARGIN + 42, { width: loreW });

doc
  .font('Courier')
  .fontSize(6.5)
  .text(
    'The world has forgotten the balance of iron and nutrients. One lone lifter still stands against the decay of strength.\n\n' +
      'Armed with the legendary Musclog cartridge, your quest: log foods, master your macros, track your weight, and conquer free workouts.\n\n' +
      'Lift with care, mind your macros, and carve your name into the Hall of Iron!',
    loreX,
    MARGIN + 54,
    {
      width: loreW,
      align: 'justify',
      lineGap: 1.5,
    }
  );

// Small barbell flourish under the lore
const barbellY = BOTTOM - 28;
const barLeft = loreX + 42;
const barRight = loreX + loreW - 42;
doc
  .lineWidth(2)
  .strokeColor('#000000')
  .moveTo(barLeft, barbellY)
  .lineTo(barRight, barbellY)
  .stroke();
doc
  .fillColor('#000000')
  .rect(barLeft - 8, barbellY - 5, 8, 10)
  .fill('#000000');
doc.rect(barLeft - 13, barbellY - 8, 5, 16).fill('#000000');
doc.rect(barRight, barbellY - 5, 8, 10).fill('#000000');
doc.rect(barRight + 8, barbellY - 8, 5, 16).fill('#000000');

// --- Precautions (right column) ---
const warnX = loreX + loreW + 16; // 201
const warnW = INNER_RIGHT - warnX; // ~88
const warnY = MARGIN + 44;
const warnH = 122;
doc.lineWidth(1).strokeColor('#000000').rect(warnX, warnY, warnW, warnH).stroke();

doc
  .font('Courier-Bold')
  .fontSize(7)
  .fillColor('#000000')
  .text('** WARNING **', warnX + 5, warnY + 8, { width: warnW - 10, align: 'center' })
  .font('Courier-Bold')
  .fontSize(5.5)
  .text('READ BEFORE PLAYING', warnX + 5, warnY + 19, { width: warnW - 10, align: 'center' })
  .font('Courier')
  .fontSize(6)
  .text(
    'Take a 10 to 15 minute break every hour, even if you do not think you need it. Avoid playing if you are tired. If your hands, wrists, or arms become sore, stop and rest.',
    warnX + 7,
    warnY + 34,
    {
      width: warnW - 14,
      align: 'justify',
      lineGap: 1.5,
    }
  );

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
  doc
    .font('Courier-Bold')
    .fontSize(7)
    .fillColor('#000000')
    .text(item.btn, ctrlX, controlY, { width: ctrlW });
  doc
    .font('Courier')
    .fontSize(6.5)
    .text(item.desc, ctrlX, controlY + 9, { width: ctrlW, align: 'left' });
  controlY += 26;
});

// ==========================================
// FEATURE PAGES (one framed screenshot + description each)
// ==========================================
function getScreenshotPath(filename) {
  const fullPath = path.join(SCREENSHOT_DIR, filename);
  return fs.existsSync(fullPath) ? fullPath : null;
}

// Screenshot box preserves the 160x144 Game Boy screen ratio (~1.111)
const FEAT_SHOT_W = 120;
const FEAT_SHOT_H = 108;
const FEAT_SHOT_Y = MARGIN + 42; // 62

function featurePage(pageNo, chapter, index) {
  setupPage(pageNo, true, true);

  // Page title
  doc
    .font('Courier-Bold')
    .fontSize(12)
    .fillColor('#000000')
    .text(chapter.title, MARGIN + 15, MARGIN + 26, {
      width: PRINTABLE_WIDTH - 30,
      align: 'center',
    });

  // Alternate the screenshot side page to page for visual variety
  const imageLeft = index % 2 === 0;
  const shotX = imageLeft ? INNER_LEFT : INNER_RIGHT - FEAT_SHOT_W;

  // Drop shadow + white mask so the framed screenshot reads cleanly
  doc
    .fillColor('#000000')
    .rect(shotX + 3, FEAT_SHOT_Y + 3, FEAT_SHOT_W, FEAT_SHOT_H)
    .fill('#000000');
  doc.fillColor('#FFFFFF').rect(shotX, FEAT_SHOT_Y, FEAT_SHOT_W, FEAT_SHOT_H).fill('#FFFFFF');

  const shot = getScreenshotPath(chapter.screenshot);
  if (shot) {
    doc.image(shot, shotX, FEAT_SHOT_Y, {
      fit: [FEAT_SHOT_W, FEAT_SHOT_H],
      align: 'center',
      valign: 'center',
    });
  } else {
    doc
      .font('Courier-Bold')
      .fontSize(9)
      .fillColor('#000000')
      .text(chapter.fallback || 'SCREEN', shotX + 8, FEAT_SHOT_Y + FEAT_SHOT_H / 2 - 5, {
        width: FEAT_SHOT_W - 16,
        align: 'center',
      });
  }
  doc
    .lineWidth(1.5)
    .strokeColor('#000000')
    .rect(shotX, FEAT_SHOT_Y, FEAT_SHOT_W, FEAT_SHOT_H)
    .stroke();

  // Description column on the opposite side
  const textX = imageLeft ? shotX + FEAT_SHOT_W + 16 : INNER_LEFT;
  const textRight = imageLeft ? INNER_RIGHT : shotX - 16;
  const textW = textRight - textX;
  const headingY = FEAT_SHOT_Y;

  doc
    .font('Courier-Bold')
    .fontSize(10)
    .fillColor('#000000')
    .text(chapter.heading, textX, headingY, { width: textW });

  doc
    .lineWidth(1)
    .strokeColor('#000000')
    .moveTo(textX, headingY + 16)
    .lineTo(textX + Math.min(textW, 96), headingY + 16)
    .stroke();

  doc
    .font('Courier')
    .fontSize(7.5)
    .fillColor('#000000')
    .text(chapter.body, textX, headingY + 24, { width: textW, align: 'justify', lineGap: 1.5 });
}

featureChapters.forEach((chapter, i) => {
  featurePage(FEATURES_START + i, chapter, i);
});

// ==========================================
// MEMO PAGE (writing lines)
// ==========================================
setupPage(memoPage, true, true);

doc
  .font('Courier-Bold')
  .fontSize(12)
  .fillColor('#000000')
  .text('MEMO / NOTES', MARGIN + 15, MARGIN + 26, {
    width: PRINTABLE_WIDTH - 30,
    align: 'center',
  });

doc
  .font('Courier')
  .fontSize(7.5)
  .text('Record custom food IDs, personal bests, or reminders.', MARGIN + 15, MARGIN + 44, {
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
