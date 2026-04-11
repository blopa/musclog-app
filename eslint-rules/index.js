/* eslint-env node */
const noJsxLogical = require('./no-jsx-logical-expression');
const preferReactLazy = require('./prefer-react-lazy');
const noReactLazy = require('./no-react-lazy');
const noThemeImport = require('./no-theme-import');
const requireSubModalCleanup = require('./require-sub-modal-cleanup');

module.exports = {
  meta: {},
  rules: {
    'no-jsx-logical-expression': noJsxLogical,
    'prefer-react-lazy': preferReactLazy,
    'no-react-lazy': noReactLazy,
    'no-theme-import': noThemeImport,
    'require-sub-modal-cleanup': requireSubModalCleanup,
  },
};
