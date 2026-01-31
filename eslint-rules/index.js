/* eslint-env node */
const noJsxLogical = require('./no-jsx-logical-expression');
const preferReactLazy = require('./prefer-react-lazy');

module.exports = {
  meta: {},
  rules: {
    'no-jsx-logical-expression': noJsxLogical,
    'prefer-react-lazy': preferReactLazy,
  },
};
