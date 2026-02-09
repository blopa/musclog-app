const fs = require('fs');
const path = require('path');

// ---- CONFIG ----
const ROOT_DIR = path.join(__dirname); // scan current folder
const IGNORED_DIRS = ['node_modules', '.git', 'dist', 'build'];
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
// ----------------

// Regex to match hex colors (#fff, #ffffff) or rgb/rgba
const COLOR_REGEX =
  /#(?:[0-9a-fA-F]{3}){1,2}\b|rgb(a)?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0?\.\d+|1(?:\.0)?))?\s*\)/g;

function scanDir(dir) {
  let results = [];

  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    if (IGNORED_DIRS.includes(file.name)) continue;

    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      results = results.concat(scanDir(fullPath));
    } else if (FILE_EXTENSIONS.includes(path.extname(file.name))) {
      results.push(fullPath);
    }
  }

  return results;
}

function findColorsInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.match(COLOR_REGEX);
  if (matches) {
    return { file: filePath, colors: [...new Set(matches)] }; // unique colors
  }
  return null;
}

// --- MAIN ---
const allFiles = scanDir(ROOT_DIR);
const colorOccurrences = [];

for (const file of allFiles) {
  const result = findColorsInFile(file);
  if (result) colorOccurrences.push(result);
}

// --- REPORT ---
if (colorOccurrences.length === 0) {
  console.log('✅ No hardcoded colors found!');
} else {
  console.log(`🎨 Found hardcoded colors in ${colorOccurrences.length} files:\n`);
  colorOccurrences.forEach(({ file, colors }) => {
    console.log(file);
    console.log('  ', colors.join(', '), '\n');
  });
}
