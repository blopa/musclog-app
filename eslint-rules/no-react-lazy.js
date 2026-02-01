/* eslint-env node */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallows React.lazy() and converts lazy imports back to regular imports',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noReactLazy:
        'Do not use React.lazy(). Import "{{ componentName }}" directly instead for better reliability.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const lazyImports = [];

    return {
      // Detect: const ComponentName = lazy(() => import('...'))
      VariableDeclarator(node) {
        // Check if it's a lazy call
        if (
          node.init &&
          node.init.type === 'CallExpression' &&
          node.init.callee.type === 'Identifier' &&
          node.init.callee.name === 'lazy' &&
          node.id.type === 'Identifier'
        ) {
          const componentName = node.id.name;
          const lazyCall = node.init;

          // Extract the import path from lazy(() => import('path'))
          if (
            lazyCall.arguments.length > 0 &&
            lazyCall.arguments[0].type === 'ArrowFunctionExpression'
          ) {
            const arrowFunc = lazyCall.arguments[0];
            let importPath = null;
            let isNamedExport = false;

            // Check if it's: () => import('path')
            if (
              arrowFunc.body.type === 'ImportExpression' ||
              (arrowFunc.body.type === 'CallExpression' && arrowFunc.body.callee.type === 'Import')
            ) {
              const importCall =
                arrowFunc.body.type === 'ImportExpression' ? arrowFunc.body : arrowFunc.body;
              importPath = importCall.arguments?.[0]?.value || importCall.source?.value;
              isNamedExport = false;
            }
            // Check if it's: () => import('path').then(({ Name }) => ({ default: Name }))
            else if (
              arrowFunc.body.type === 'CallExpression' &&
              arrowFunc.body.callee.type === 'MemberExpression' &&
              arrowFunc.body.callee.property.name === 'then'
            ) {
              const importCall = arrowFunc.body.callee.object;
              if (
                importCall.type === 'ImportExpression' ||
                (importCall.type === 'CallExpression' && importCall.callee.type === 'Import')
              ) {
                importPath = importCall.arguments?.[0]?.value || importCall.source?.value;
                isNamedExport = true;
              }
            }

            if (importPath) {
              lazyImports.push({
                node,
                componentName,
                importPath,
                isNamedExport,
                variableDeclaration: node.parent,
              });
            }
          }
        }
      },

      'Program:exit'() {
        lazyImports.forEach(
          ({ node, componentName, importPath, isNamedExport, variableDeclaration }) => {
            context.report({
              node,
              messageId: 'noReactLazy',
              data: { componentName },
              fix(fixer) {
                const fixes = [];

                // Step 1: Remove the lazy variable declaration
                // Check if this is the only variable in the declaration
                const declarations = variableDeclaration.declarations;
                if (declarations.length === 1) {
                  // Remove entire variable declaration statement
                  fixes.push(fixer.remove(variableDeclaration));
                } else {
                  // Multiple declarations, remove just this one
                  fixes.push(fixer.remove(node));
                  // Handle comma removal
                  const nodeIndex = declarations.indexOf(node);
                  if (nodeIndex < declarations.length - 1) {
                    // Not last, remove trailing comma
                    const nextToken = sourceCode.getTokenAfter(node);
                    if (nextToken && nextToken.value === ',') {
                      fixes.push(fixer.remove(nextToken));
                    }
                  } else if (nodeIndex > 0) {
                    // Last one, remove preceding comma
                    const prevToken = sourceCode.getTokenBefore(node);
                    if (prevToken && prevToken.value === ',') {
                      fixes.push(fixer.remove(prevToken));
                    }
                  }
                }

                // Step 2: Add regular import at the top
                // Find the last import statement
                const lastImport = sourceCode.ast.body
                  .filter((stmt) => stmt.type === 'ImportDeclaration')
                  .pop();

                const importStatement = isNamedExport
                  ? `import { ${componentName} } from '${importPath}';\n`
                  : `import ${componentName} from '${importPath}';\n`;

                if (lastImport) {
                  fixes.push(fixer.insertTextAfter(lastImport, importStatement));
                } else {
                  // No imports yet, add at the beginning
                  const firstNode = sourceCode.ast.body[0];
                  if (firstNode) {
                    fixes.push(fixer.insertTextBefore(firstNode, importStatement));
                  }
                }

                // Step 3: Remove lazy from react imports if no longer used
                // Check if there are other lazy calls
                const otherLazyCalls = lazyImports.filter(
                  (item) => item.componentName !== componentName
                );

                if (otherLazyCalls.length === 0) {
                  // Find and remove lazy from react import
                  const reactImport = sourceCode.ast.body.find(
                    (stmt) => stmt.type === 'ImportDeclaration' && stmt.source.value === 'react'
                  );

                  if (reactImport) {
                    const lazySpecifier = reactImport.specifiers.find(
                      (spec) => spec.type === 'ImportSpecifier' && spec.imported.name === 'lazy'
                    );

                    if (lazySpecifier) {
                      const otherSpecifiers = reactImport.specifiers.filter(
                        (spec) => spec !== lazySpecifier
                      );

                      if (otherSpecifiers.length === 0) {
                        // Only lazy, remove entire import
                        fixes.push(fixer.remove(reactImport));
                      } else {
                        // Multiple specifiers, remove just lazy
                        fixes.push(fixer.remove(lazySpecifier));
                        // Handle comma
                        const specIndex = reactImport.specifiers.indexOf(lazySpecifier);
                        if (specIndex < reactImport.specifiers.length - 1) {
                          const nextToken = sourceCode.getTokenAfter(lazySpecifier);
                          if (nextToken && nextToken.value === ',') {
                            fixes.push(fixer.remove(nextToken));
                          }
                        } else if (specIndex > 0) {
                          const prevToken = sourceCode.getTokenBefore(lazySpecifier);
                          if (prevToken && prevToken.value === ',') {
                            fixes.push(fixer.remove(prevToken));
                          }
                        }
                      }
                    }
                  }
                }

                return fixes;
              },
            });
          }
        );
      },
    };
  },
};
