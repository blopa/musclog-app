const chroma = require('chroma-js');

const colors = {
  black: '#000000',
  emerald900: '#064e3b',
  blackOlive: '#0a0f0d',
  deepJungle: '#0a1f1a',
  darkForest: '#0d3520',
  teal600: '#0d9488',
  darkMint: '#0f2419',
  darkPine: '#0f251f',
  darkEmerald: '#0f2f27',
  emerald500: '#10b981',
  darkMoss: '#11211a',
  green800: '#125630',
  surfaceBlack: '#131314',
  charcoalGreen: '#141a17',
  teal500: '#14b8a6',
  swampGreen: '#15261f',
  green600: '#16a34a',
  gunmetalGreen: '#1a2420',
  gunmetalGreenDark: '#1a2520',
  darkSlateGreen: '#1a2e2a',
  jungleCard: '#1a2f2a',
  deepAquamarine: '#1a3530',
  deepGreen: '#1a3a2a',
  pineShadow: '#1a3d2f',
  pineDark: '#1a3d35',
  jade: '#1aa869',
  gray900: '#1f1f1f',
  gray800: '#1f2937',
  darkTealBg: '#1f4039',
  green500: '#22c55e',
  darkSeaGreen: '#243d37',
  hunterGreen: '#254637',
  blue600: '#2563eb',
  neonMint: '#29e08e',
  darkViridian: '#2a4d3f',
  teal400: '#2dd4bf',
  gray850: '#303030',
  emerald300: '#34d399',
  gray700: '#374151',
  blue500: '#3b82f6',
  darkRedBg: '#3d1515',
  darkPurpleBg: '#3d3162',
  gray600: '#4b5563',
  indigo600: '#4f46e5',
  violet800: '#5b21b6',
  indigo500: '#6366f1',
  gray500: '#6b7280',
  zinc500: '#747775',
  red900: '#7f1d1d',
  indigo400: '#818cf8',
  violet500: '#8b5cf6',
  warmGray: '#8b7d6b',
  zinc400: '#8e918f',
  sage: '#95c6b0',
  gray400: '#9ca3af',
  rose900: '#9f1239',
  violet300: '#a78bfa',
  emerald200: '#a7f3d0',
  purple500: '#a855f7',
  indigo200: '#c7d2fe',
  gray300: '#d1d5db',
  tan: '#d4b5a0',
  rose500: '#da2552',
  rose600: '#e11d48',
  gray200: '#e3e3e3',
  gray200Tailwind: '#e5e7eb',
  yellow500: '#eab308',
  pink500: '#ec4899',
  red500: '#ef4444',
  amber500: '#f59e0b',
  red400: '#f87171',
  orange500: '#f97316',
  amber400: '#fbbf24',
  white: '#ffffff',
};

function getSimilarity(hex1, hex2) {
  const difference = chroma.deltaE(hex1, hex2);
  return Math.max(0, 100 - difference);
}

// 1. Create an array to hold our findings
const report = [];
const colorNames = Object.keys(colors);

// 2. Loop through every color...
for (let i = 0; i < colorNames.length; i++) {
  // ...and compare it to every *subsequent* color
  // (to avoid duplicate reverse comparisons like A vs B and B vs A)
  for (let j = i + 1; j < colorNames.length; j++) {
    const name1 = colorNames[i];
    const name2 = colorNames[j];

    const sim = getSimilarity(colors[name1], colors[name2]);

    // 3. Only keep pairs that are highly similar (90%+)
    if (sim >= 90) {
      report.push({
        name1,
        hex1: colors[name1],
        name2,
        hex2: colors[name2],
        sim,
      });
    }
  }
}

// 4. Sort the report from highest similarity to lowest
report.sort((a, b) => b.sim - a.sim);

// 5. Print out the results nicely
console.log('\n=== 🚨 HIGHLY SIMILAR COLOR REPORT (>= 90%) 🚨 ===\n');
report.forEach((item) => {
  let warning = '';
  if (item.sim > 98) warning = ' [CRITICAL: Basically Identical]';
  else if (item.sim > 95) warning = ' [WARNING: Very Similar]';

  console.log(
    `${item.sim.toFixed(2)}% | ${item.name1} (${item.hex1}) <---> ${item.name2} (${item.hex2})${warning}`
  );
});
console.log(`\nFound ${report.length} potentially redundant color pairs.`);
