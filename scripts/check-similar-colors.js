const chroma = require('chroma-js');

// 1. Your original colors object (truncated here for brevity, paste your full list!)
const colors = {
  black: '#000000',
  darkForest: '#0d3520',
  teal600: '#0d9488',
  charcoalGreen: '#141a17',
  teal500: '#14b8a6',
  swampGreen: '#15261f',
  green600: '#16a34a',
  jungleCard: '#1a2f2a',
  deepAquamarine: '#1a3530',
  pineShadow: '#1a3d2f',
  gray800: '#1f2937',
  green500: '#22c55e',
  darkSeaGreen: '#243d37',
  hunterGreen: '#254637',
  blue600: '#2563eb',
  neonMint: '#29e08e',
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
  purple500: '#8b5cf6',
  warmGray: '#8b7d6b',
  zinc400: '#8e918f',
  sage: '#95c6b0',
  gray400: '#9ca3af',
  rose900: '#9f1239',
  violet300: '#a78bfa',
  emerald200: '#a7f3d0',
  indigo200: '#c7d2fe',
  tan: '#d4b5a0',
  rose600: '#da2552',
  gray200Tailwind: '#e5e7eb',
  pink500: '#ec4899',
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

const processedColors = new Set();
const colorGroups = [];
const colorNames = Object.keys(colors);

// 2. Group the colors (same as before)
for (let i = 0; i < colorNames.length; i++) {
  const baseName = colorNames[i];
  if (processedColors.has(baseName)) {
    continue;
  }

  const currentGroup = {
    base: baseName,
    similar: [],
  };

  for (let j = i + 1; j < colorNames.length; j++) {
    const compareName = colorNames[j];
    if (processedColors.has(compareName)) {
      continue;
    }

    const sim = getSimilarity(colors[baseName], colors[compareName]);

    if (sim >= 90) {
      currentGroup.similar.push({ name: compareName, sim: sim });
      processedColors.add(compareName);
    }
  }

  if (currentGroup.similar.length > 0) {
    currentGroup.similar.sort((a, b) => b.sim - a.sim);
    colorGroups.push(currentGroup);
    processedColors.add(baseName);
  }
}

// 3. Build the new sorted object
const sortedColors = {};

// First, insert the clustered groups
colorGroups.forEach((group) => {
  // Add the base color
  sortedColors[group.base] = colors[group.base];

  // Immediately follow it with its similar matches
  group.similar.forEach((match) => {
    sortedColors[match.name] = colors[match.name];
  });
});

// Finally, add any colors that had no similarities >= 90%
colorNames.forEach((name) => {
  if (!sortedColors.hasOwnProperty(name)) {
    sortedColors[name] = colors[name];
  }
});

// 4. Print the newly formatted object for copy-pasting
console.log('\n// === COPY AND PASTE THIS INTO YOUR CODE ===\n');
console.log('const baseColors = {');

for (const [key, value] of Object.entries(sortedColors)) {
  console.log(`  ${key}: '${value}',`);
}

console.log('};\n');
