const chroma = require('chroma-js');

const colors = {
  black: '#000000',
  blackOlive: '#0a0f0d',
  surfaceBlack: '#131314',
  gray900: '#1f1f1f',
  charcoalGreen: '#141a17',
  emerald900: '#064e3b',
  darkViridian: '#2a4d3f',
  hunterGreen: '#254637',
  green800: '#125630',
  pineShadow: '#1a3d2f',
  deepGreen: '#1a3a2a',
  pineDark: '#1a3d35',
  darkTealBg: '#1f4039',
  darkForest: '#0d3520',
  deepJungle: '#0a1f1a',
  darkPine: '#0f251f',
  darkMoss: '#11211a',
  swampGreen: '#15261f',
  darkMint: '#0f2419',
  gunmetalGreenDark: '#1a2520',
  darkSlateGreen: '#1a2e2a',
  gunmetalGreen: '#1a2420',
  jungleCard: '#1a2f2a',
  darkEmerald: '#0f2f27',
  deepAquamarine: '#1a3530',
  darkSeaGreen: '#243d37',
  emerald500: '#10b981',
  jade: '#1aa869',
  emerald300: '#34d399',
  green500: '#22c55e',
  teal500: '#14b8a6',
  teal400: '#2dd4bf',
  gray800: '#1f2937',
  gray700: '#374151',
  gray850: '#303030',
  blue600: '#2563eb',
  indigo500: '#6366f1',
  blue500: '#3b82f6',
  indigo400: '#818cf8',
  gray500: '#6b7280',
  zinc500: '#747775',
  red900: '#7f1d1d',
  rose900: '#9f1239',
  violet500: '#8b5cf6',
  purple500: '#a855f7',
  zinc400: '#8e918f',
  gray400: '#9ca3af',
  gray300: '#d1d5db',
  gray200Tailwind: '#e5e7eb',
  gray200: '#e3e3e3',
  white: '#ffffff',
  rose500: '#da2552',
  rose600: '#e11d48',
  yellow500: '#eab308',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  red500: '#ef4444',
  red400: '#f87171',
  teal600: '#0d9488',
  green600: '#16a34a',
  neonMint: '#29e08e',
  darkRedBg: '#3d1515',
  darkPurpleBg: '#3d3162',
  gray600: '#4b5563',
  indigo600: '#4f46e5',
  violet800: '#5b21b6',
  warmGray: '#8b7d6b',
  sage: '#95c6b0',
  violet300: '#a78bfa',
  emerald200: '#a7f3d0',
  indigo200: '#c7d2fe',
  tan: '#d4b5a0',
  pink500: '#ec4899',
  orange500: '#f97316',
};

function getSimilarity(hex1, hex2) {
  const difference = chroma.deltaE(hex1, hex2);
  return Math.max(0, 100 - difference);
}

// 1. Set up tracking variables
const processedColors = new Set();
const colorGroups = [];
const colorNames = Object.keys(colors);

// 2. Loop through the colors to create groups
for (let i = 0; i < colorNames.length; i++) {
  const baseName = colorNames[i];

  // If this color was already grouped under another color, skip it!
  if (processedColors.has(baseName)) continue;

  const currentGroup = {
    base: baseName,
    hex: colors[baseName],
    similar: [],
  };

  for (let j = i + 1; j < colorNames.length; j++) {
    const compareName = colorNames[j];

    // Skip if the comparison color is already in a group
    if (processedColors.has(compareName)) continue;

    const sim = getSimilarity(colors[baseName], colors[compareName]);

    // 3. If similar, add it to the base color's group
    if (sim >= 90) {
      currentGroup.similar.push({
        name: compareName,
        hex: colors[compareName],
        sim: sim,
      });
      // Mark it as processed so it doesn't become its own base color later
      processedColors.add(compareName);
    }
  }

  // 4. If we found duplicates for this base color, save the group
  if (currentGroup.similar.length > 0) {
    currentGroup.similar.sort((a, b) => b.sim - a.sim); // Sort highest similarity first
    colorGroups.push(currentGroup);
    processedColors.add(baseName);
  }
}

// 5. Print out the cleaned-up report
console.log('\n=== 🧹 COLOR REDUNDANCY GROUPS (>= 90%) 🧹 ===\n');
console.log('Rule of thumb: Keep the Base Color, consider deleting the indented ones.\n');

colorGroups.forEach((group) => {
  console.log(`Base Color: ${group.base} (${group.hex})`);
  group.similar.forEach((match) => {
    let warning = '';
    if (match.sim > 98) warning = ' [CRITICAL: Delete one]';
    else if (match.sim > 95) warning = ' [WARNING: Very similar]';

    console.log(`  ↳ ${match.sim.toFixed(2)}% similar -> ${match.name} (${match.hex})${warning}`);
  });
  console.log('--------------------------------------------------');
});
