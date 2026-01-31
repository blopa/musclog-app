/* eslint-env node */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Requires that components imported and used in conditional JSX be imported using React.lazy()',
    },
    fixable: 'code',
    schema: [],
    messages: {
      useReactLazy:
        'Component "{{ componentName }}" is conditionally rendered. Import it using React.lazy() for better code splitting.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const importedComponents = new Map();
    const conditionalUses = new Set();

    return {
      // Track component imports
      'ImportDeclaration > ImportSpecifier'(node) {
        const importDecl = node.parent;
        const source = importDecl.source.value;

        // Only track local imports (relative paths)
        if (source.startsWith('./') || source.startsWith('../')) {
          importedComponents.set(node.local.name, {
            source,
            isDefault: false,
            importNode: importDecl,
            specifier: node,
          });
        }
      },

      'ImportDeclaration > ImportDefaultSpecifier'(node) {
        const importDecl = node.parent;
        const source = importDecl.source.value;

        // Only track local imports (relative paths)
        if (source.startsWith('./') || source.startsWith('../')) {
          importedComponents.set(node.local.name, {
            source,
            isDefault: true,
            importNode: importDecl,
            specifier: node,
          });
        }
      },

      // Find JSX elements inside conditionals
      JSXElement(node) {
        // Walk up the tree to check if this JSX is inside a ConditionalExpression
        let parent = node.parent;
        let isConditional = false;

        while (parent) {
          if (parent.type === 'ConditionalExpression') {
            isConditional = true;
            break;
          }
          // Stop if we hit something that breaks the chain
          if (parent.type === 'FunctionDeclaration' || parent.type === 'ArrowFunctionExpression') {
            break;
          }
          parent = parent.parent;
        }

        if (isConditional && node.openingElement && node.openingElement.name) {
          const componentName = sourceCode.getText(node.openingElement.name);
          // Only flag if it's a PascalCase identifier (component name)
          if (/^[A-Z]/.test(componentName)) {
            conditionalUses.add(componentName);
          }
        }
      },

      'Program:exit'() {
        conditionalUses.forEach((componentName) => {
          const importInfo = importedComponents.get(componentName);
          if (importInfo) {
            context.report({
              node: importInfo.importNode,
              messageId: 'useReactLazy',
              data: { componentName },
              fix(fixer) {
                const { source, isDefault, importNode, specifier } = importInfo;
                const fixes = [];

                // Step 1: Check and add lazy import from react if needed
                let hasLazyImport = false;
                let reactImportNode = null;
                sourceCode.ast.body.forEach((stmt) => {
                  if (stmt.type === 'ImportDeclaration' && stmt.source.value === 'react') {
                    reactImportNode = stmt;
                    hasLazyImport = stmt.specifiers.some(
                      (spec) => spec.type === 'ImportSpecifier' && spec.imported.name === 'lazy'
                    );
                  }
                });

                if (!hasLazyImport) {
                  if (reactImportNode) {
                    // Add lazy to existing react import
                    const lastSpec =
                      reactImportNode.specifiers[reactImportNode.specifiers.length - 1];
                    fixes.push(fixer.insertTextAfter(lastSpec, ', lazy'));
                  } else {
                    // Create new react import with lazy
                    const firstStmt = sourceCode.ast.body[0];
                    if (firstStmt) {
                      fixes.push(
                        fixer.insertTextBefore(firstStmt, "import { lazy } from 'react';\n")
                      );
                    }
                  }
                }

                // Step 2: Remove the import specifier
                const otherSpecifiers = importNode.specifiers.filter(
                  (spec) => spec.local.name !== componentName
                );

                if (otherSpecifiers.length === 0) {
                  // Only import, remove entire line
                  fixes.push(fixer.remove(importNode));
                } else {
                  // Multiple imports, remove just this one
                  fixes.push(fixer.remove(specifier));
                  // Remove trailing comma if it exists
                  const nextChar = sourceCode.getText().charAt(specifier.range[1]);
                  if (nextChar === ',') {
                    fixes.push(fixer.removeRange([specifier.range[1], specifier.range[1] + 1]));
                  }
                }

                // Step 3: Add lazy const after imports
                const lastImport = sourceCode.ast.body
                  .reverse()
                  .find((stmt) => stmt.type === 'ImportDeclaration');

                if (lastImport) {
                  const lazyCode = isDefault
                    ? `const ${componentName} = lazy(() => import('${source}'));\n`
                    : `const ${componentName} = lazy(() => import('${source}').then(({ ${componentName} }) => ({ default: ${componentName} })));\n`;

                  fixes.push(fixer.insertTextAfter(lastImport, lazyCode));
                }

                return fixes;
              },
            });
          }
        });
      },
    };
  },
};
