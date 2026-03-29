/* eslint-env node */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow direct imports from theme.ts except in useTheme.ts and theme.ts',
    },
    schema: [],
    messages: {
      noThemeImport:
        'Do not import "theme" directly from theme.ts. Use the "useTheme()" hook instead, or "getTheme()" for non-React files.',
    },
  },
  create(context) {
    const filename = context.getFilename();
    // Allow direct imports in specific files that manage theme
    if (
      filename.endsWith('hooks/useTheme.ts') ||
      filename.endsWith('theme.ts') ||
      filename.endsWith('tailwind.config.js') ||
      filename.endsWith('widgets/SmartCameraWidget.tsx') ||
      filename.endsWith('widgets/NutritionWidget.tsx') ||
      filename.endsWith('services/NotificationService.ts')
    ) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value.endsWith('theme')) {
          const themeSpecifier = node.specifiers.find(
            (spec) =>
              (spec.type === 'ImportSpecifier' && spec.imported.name === 'theme') ||
              (spec.type === 'ImportDefaultSpecifier' && spec.local.name === 'theme')
          );

          if (themeSpecifier) {
            context.report({
              node: themeSpecifier,
              messageId: 'noThemeImport',
            });
          }
        }
      },
    };
  },
};
