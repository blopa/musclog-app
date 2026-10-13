const { Linter } = require('eslint');
const eslintConfig = require('../../eslint.config');

const ruleName = 'padding-line-between-statements';
const configuredRules = Object.assign({}, ...eslintConfig.map((entry: any) => entry.rules));
const config = { rules: { [ruleName]: configuredRules[ruleName] } };
const linter = new Linter();

describe('ESLint statement padding', () => {
  it.each([
    'if (ready) { work(); }',
    'if (ready) work();',
    'if (ready) { work(); } else { wait(); }',
    'function run() { work(); }',
    'export function run() { work(); }',
    'const run = () => { work(); };',
    'const run = function () { work(); };',
    'while (ready) { work(); }',
  ])('reports and fixes missing padding after %s', (statement) => {
    const source = `${statement}\nnext();`;
    expect(linter.verify(source, config)).toEqual([
      expect.objectContaining({ ruleId: ruleName, severity: 1 }),
    ]);
    expect(linter.verifyAndFix(source, config)).toEqual({
      fixed: true,
      messages: [],
      output: `${statement}\n\nnext();`,
    });
  });

  it.each([
    'if (ready) { work(); }\n\nnext();',
    'if (ready) { work(); } else if (waiting) { wait(); } else { stop(); }',
    'function run() {\n  if (ready) { work(); }\n}',
    'const first = 1;\nconst second = 2;',
    'const settings = { enabled: true };\nnext();',
  ])('preserves valid spacing: %s', (source) => {
    expect(linter.verifyAndFix(source, config)).toEqual({
      fixed: false,
      messages: [],
      output: source,
    });
  });
});
