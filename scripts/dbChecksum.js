const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const DIRNAME = __dirname;

// Function to get exported functions from a TypeScript file in the order they appear
function getOrderedExportedFunctions(filePath) {
    const sourceCode = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest);

    const exportedFunctions = [];

    ts.forEachChild(sourceFile, (node) => {
        if (ts.isFunctionDeclaration(node) && node.modifiers) {
            const isExported = node.modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
            if (isExported && node.name) {
                exportedFunctions.push(node.name.text);
            }
        } else if (ts.isVariableStatement(node) && node.modifiers) {
            const isExported = node.modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
            if (isExported) {
                node.declarationList.declarations.forEach((declaration) => {
                    if (ts.isFunctionExpression(declaration.initializer) || ts.isArrowFunction(declaration.initializer)) {
                        if (declaration.name && ts.isIdentifier(declaration.name)) {
                            exportedFunctions.push(declaration.name.text);
                        }
                    }
                });
            }
        }
    });

    return exportedFunctions;
}

// Load and parse both files
const functionsInDatabase = getOrderedExportedFunctions(path.resolve(DIRNAME, '..', 'utils', 'database.ts'));
const functionsInDatabaseWeb = getOrderedExportedFunctions(path.resolve(DIRNAME, '..', 'utils', 'database.web.ts'));

// Compare the functions by presence
const functionsSetInDatabase = new Set(functionsInDatabase);
const functionsSetInDatabaseWeb = new Set(functionsInDatabaseWeb);

const missingInDatabase = functionsInDatabaseWeb.filter((fn) => !functionsSetInDatabase.has(fn));
const missingInDatabaseWeb = functionsInDatabase.filter((fn) => !functionsSetInDatabaseWeb.has(fn));

console.log('Comparison of exported functions between database.ts and database.web.ts:\n');

if (missingInDatabase.length === 0 && missingInDatabaseWeb.length === 0) {
    console.log('Both files have the same exported functions.');
} else {
    if (missingInDatabase.length > 0) {
        console.log('Functions missing in database.ts:', missingInDatabase.join(', '));
    } else {
        console.log('No functions missing in database.ts');
    }

    if (missingInDatabaseWeb.length > 0) {
        console.log('Functions missing in database.web.ts:', missingInDatabaseWeb.join(', '));
    } else {
        console.log('No functions missing in database.web.ts');
    }
}

// Check if the functions are in the same order
const inSameOrder = JSON.stringify(functionsInDatabase) === JSON.stringify(functionsInDatabaseWeb);

if (inSameOrder) {
    console.log('\nThe functions are in the same order in both files.');
} else {
    console.log('\nThe functions are NOT in the same order in both files.');

    // Find where the order differs
    const maxLength = Math.max(functionsInDatabase.length, functionsInDatabaseWeb.length);
    for (let i = 0; i < maxLength; i++) {
        if (functionsInDatabase[i] !== functionsInDatabaseWeb[i]) {
            console.log(`Difference found at position ${i + 1}:`);
            console.log(`  database.ts: ${functionsInDatabase[i] || 'N/A'}`);
            console.log(`  database.web.ts: ${functionsInDatabaseWeb[i] || 'N/A'}`);
            break;
        }
    }
}
