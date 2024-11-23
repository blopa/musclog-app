const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const DIRNAME = __dirname;
const projectRoot = path.resolve(DIRNAME, '..');

/**
 * Parse the `.tsx` file and find unused styles properties.
 */
function checkUnusedStyles(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.ESNext, true);

    let stylesProperties = [];
    let declaredLines = {};

    function visit(node) {
        // Detect `StyleSheet.create` call
        if (
            ts.isCallExpression(node)
            && ts.isPropertyAccessExpression(node.expression)
            && ts.isIdentifier(node.expression.expression)
            && node.expression.expression.escapedText === 'StyleSheet'
            && ts.isIdentifier(node.expression.name)
            && node.expression.name.escapedText === 'create'
            && node.arguments.length > 0
        ) {
            const arg = node.arguments[0];
            if (ts.isObjectLiteralExpression(arg)) {
                extractStyleProperties(arg);
            }
        }

        ts.forEachChild(node, visit);
    }

    function extractStyleProperties(objectLiteral) {
        if (ts.isObjectLiteralExpression(objectLiteral)) {
            objectLiteral.properties.forEach((prop) => {
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                    const propertyName = prop.name.text;
                    stylesProperties.push(propertyName);

                    const { line } = sourceFile.getLineAndCharacterOfPosition(prop.name.pos);
                    declaredLines[propertyName] = line + 1; // Line numbers are 0-indexed
                }
            });
        }
    }

    visit(sourceFile);

    // Check for unused properties
    const unusedProperties = stylesProperties.filter((property) => {
        const regex = new RegExp(`\\bstyles\\.(${property})\\b`);
        return !regex.test(fileContent);
    });

    // Log unused properties
    if (unusedProperties.length > 0) {
        console.log(`\nFile: ${filePath}`);
        unusedProperties.forEach((property) => {
            console.log(
                `Unused property: "${property}" (declared at ${filePath}:${declaredLines[property] + 1})`
            );
        });
    }
}

function getAllTsxFiles(dir) {
    let results = [];
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (file === 'node_modules') {
                return;
            }

            results = results.concat(getAllTsxFiles(filePath));
        } else if (filePath.endsWith('.tsx')) {
            results.push(filePath);
        }
    });

    return results;
}

/**
 * Main function to run the script.
 */
function main() {
    const tsxFiles = getAllTsxFiles(projectRoot);

    if (tsxFiles.length === 0) {
        console.log('No .tsx files found.');
        return;
    }

    console.log(`Checking ${tsxFiles.length} .tsx files for unused styles...\n`);

    tsxFiles.forEach(checkUnusedStyles);

    console.log('\nDone!');
}

main();
