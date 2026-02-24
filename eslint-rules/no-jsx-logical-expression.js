/* eslint-env node */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow using logical `&&` expressions directly inside JSX (use ternary or explicit null fallback).',
    },
    fixable: 'code',
    schema: [],
    messages: {
      avoidLogical:
        'Avoid using `&&` inside JSX expression containers; use conditional (?:) rendering instead.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      'JSXExpressionContainer > LogicalExpression'(node) {
        if (node.operator !== '&&') {
          return;
        }

        context.report({
          node,
          messageId: 'avoidLogical',
          fix(fixer) {
            const leftText = sourceCode.getText(node.left);
            const rightText = sourceCode.getText(node.right);

            // Replace `a && b` with `a ? b : null`
            const replacement = `${leftText} ? ${rightText} : null`;
            return fixer.replaceText(node, replacement);
          },
        });
      },
    };
  },
};
