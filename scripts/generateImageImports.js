const { ESLint } = require('eslint');
const fs = require('fs');
const path = require('path');

const eslintBaseConfig = require('../eslint.config.js');

const DIRNAME = __dirname;

// Directory containing the exercise images
const exercisesDir = path.join(DIRNAME, '..', 'assets/exercises');
const outputFilePath = path.join(DIRNAME, '..', 'utils', 'exerciseImages.ts');

// Read all files in the exercises directory
const files = fs.readdirSync(exercisesDir);

// Generate import statements for each file
const imports = files.map((file, index) => {
    const variableName = `image${index}`;
    const filePath = `../assets/exercises/${file}`;
    return `import ${variableName} from '${filePath}';`;
}).join('\n');

// Generate export statements
const images = files.map((file, index) => {
    const variableName = `image${index}`;
    const fileName = path.basename(file, path.extname(file));
    return `'${fileName}': ${variableName}`;
}).join(',\n');

// Write the generated code to the output file
const output = [
    imports,
    '',
    'const exerciseImages: { [key: string]: string } = {',
    images,
    '};',
    '',
    'export default exerciseImages;',
    '',
].join('\n');

const eslint = new ESLint({
    baseConfig: eslintBaseConfig,
    fix: true,
});

// eslint-disable-next-line promise/catch-or-return
eslint.lintText(output).then((lintResults) => {
    // eslint-disable-next-line promise/always-return
    const lintedOutput = lintResults[0].output || output;

    fs.writeFileSync(outputFilePath, lintedOutput);
    console.log(`Generated ${outputFilePath}`);
});
