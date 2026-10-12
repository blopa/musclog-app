/* eslint-disable @typescript-eslint/no-require-imports */
const { Linter } = require('eslint');
const rule = require('../../eslint-rules/require-sub-modal-cleanup');

function lint(hook: string) {
  return new Linter().verify(`
    function TourModal({ visible }) {
      const [active, setActive] = ${hook};
      return <FullScreenModal visible={visible}><ChildModal visible={!!active} /></FullScreenModal>;
    }
  `, [{ files: ['**/*.tsx'], languageOptions: { parser: require('@typescript-eslint/parser'), parserOptions: { ecmaFeatures: { jsx: true } } }, plugins: { local: { rules: { cleanup: rule } } }, rules: { 'local/cleanup': 'error' } }], { filename: 'TourModal.tsx' });
}

test.each(['useSubModalVisibility(visible)', 'useSubModalState(visible, null)', 'hooks.useSubModalState(visible, null)'])('accepts automatic cleanup through %s', (hook) => {
  expect(lint(hook)).toEqual([]);
});
test('still rejects plain state that can leave a child modal behind', () => {
  expect(lint('useState(null)')).toEqual([expect.objectContaining({ ruleId: 'local/cleanup' })]);
});
