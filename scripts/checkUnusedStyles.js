const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// eslint-disable-next-line no-undef
const DIRNAME = __dirname;

// Adjust the project root as needed
const projectRoot = path.resolve(DIRNAME, '..');

function getAllTsxFiles(dir) {
    let results = [];
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            results = results.concat(getAllTsxFiles(filePath));
        } else if (filePath.endsWith('.tsx')) {
            results.push(filePath);
        }
    });

    return results;
}

function checkUnusedStyles(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);

    let stylesProperties = [];
    let declaredLines = {};
    let stylesIdentifierName = null;

    // First pass: Find the styles object and extract its properties
    function findStylesDeclaration(node) {
        // Look for: const styles = makeStyles(...)
        if (
            ts.isVariableDeclaration(node)
            && ts.isIdentifier(node.name)
            && node.initializer
            && ts.isCallExpression(node.initializer)
        ) {
            const variableName = node.name.text;
            const callExpression = node.initializer;

            // Check if the function called is 'makeStyles'
            if (
                ts.isIdentifier(callExpression.expression)
                && callExpression.expression.text === 'makeStyles'
            ) {
                stylesIdentifierName = variableName;

                // Extract the styles object passed to StyleSheet.create
                const args = callExpression.arguments;
                if (args.length > 0) {
                    const arg = args[0];
                    extractStyleProperties(arg);
                }
            }
        }

        ts.forEachChild(node, findStylesDeclaration);
    }

    function extractStyleProperties(node) {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
            // Handle StyleSheet.create({...})
            const methodName = node.expression.name.text;
            if (methodName === 'create') {
                const args = node.arguments;
                if (args.length > 0 && ts.isObjectLiteralExpression(args[0])) {
                    const objectLiteral = args[0];
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
        } else if (ts.isObjectLiteralExpression(node)) {
            // Handle direct object literals
            node.properties.forEach((prop) => {
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                    const propertyName = prop.name.text;
                    stylesProperties.push(propertyName);

                    const { line } = sourceFile.getLineAndCharacterOfPosition(prop.name.pos);
                    declaredLines[propertyName] = line + 1;
                }
            });
        }
    }

    // Second pass: Find usages of the styles properties
    function findStylesUsages(node) {
        if (
            ts.isPropertyAccessExpression(node)
            && ts.isIdentifier(node.expression)
            && node.expression.text === stylesIdentifierName
            && ts.isIdentifier(node.name)
        ) {
            const propertyName = node.name.text;
            // Remove the property from stylesProperties if found
            const index = stylesProperties.indexOf(propertyName);
            if (index > -1) {
                stylesProperties.splice(index, 1);
            }
        }

        ts.forEachChild(node, findStylesUsages);
    }

    // Run the passes
    findStylesDeclaration(sourceFile);

    if (stylesIdentifierName) {
        findStylesUsages(sourceFile);

        // Any remaining properties in stylesProperties are unused
        if (stylesProperties.length > 0) {
            console.log(`\nFile: ${filePath}`);
            stylesProperties.forEach((property) => {
                console.log(`Unused property: "${property}" (declared at line ${declaredLines[property]})`);
            });
        }
    }
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
