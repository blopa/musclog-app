const chroma = require('chroma-js');

const colors = {
  black: '#000000',
  emerald900: '#064e3b',
  blackOlive: '#0a0f0d',
  darkForest: '#0d3520',
  teal600: '#0d9488',
  darkMint: '#0f2419',
  darkPine: '#0f251f',
  darkEmerald: '#0f2f27',
  emerald500: '#10b981',
  green800: '#125630',
  surfaceBlack: '#131314',
  charcoalGreen: '#141a17',
  teal500: '#14b8a6',
  swampGreen: '#15261f',
  green600: '#16a34a',
  gunmetalGreenDark: '#1a2520',
  jungleCard: '#1a2f2a',
  deepAquamarine: '#1a3530',
  pineShadow: '#1a3d2f',
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
  rose600: '#da2552',
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

// 1. Set up tracking variables
const processedColors = new Set();
const colorGroups = [];
const colorNames = Object.keys(colors);

// 2. Loop through the colors to create groups
for (let i = 0; i < colorNames.length; i++) {
  const baseName = colorNames[i];

  // If this color was already grouped under another color, skip it!
  if (processedColors.has(baseName)) {
    continue;
  }

  const currentGroup = {
    base: baseName,
    hex: colors[baseName],
    similar: [],
  };

  for (let j = i + 1; j < colorNames.length; j++) {
    const compareName = colorNames[j];

    // Skip if the comparison color is already in a group
    if (processedColors.has(compareName)) {
      continue;
    }

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
    if (match.sim > 98) {
      warning = ' [CRITICAL: Delete one]';
    } else if (match.sim > 95) {
      warning = ' [WARNING: Very similar]';
    }

    console.log(`  ↳ ${match.sim.toFixed(2)}% similar -> ${match.name} (${match.hex})${warning}`);
  });
  console.log('--------------------------------------------------');
});
