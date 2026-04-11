/* eslint-env node */
/**
 * require-sub-modal-cleanup
 *
 * In React Native, each <Modal visible={true}> creates a native window layer that
 * intercepts touch events at the OS level. If a sub-modal inside a parent modal is
 * left visible=true when the parent closes, it becomes a ghost window that blocks all
 * touches on the next open — even though the React tree looks correct.
 *
 * This rule enforces that any *Modal.tsx file which renders <*Modal sub-components
 * must implement the cleanup pattern via one of:
 *
 *   1. `useSubModalVisibility(visible)` — the dedicated hook that auto-resets on
 *      parent close.
 *
 *   2. A cleanup useEffect:
 *        useEffect(() => { if (!visible) { setX(false); ... } }, [visible]);
 *      The effect must reference `visible` in its dependency array AND call at least
 *      one setter (anything named set* or matching /false/ assignment) in its body
 *      under a `if (!visible)` / `if (visible === false)` guard.
 *
 * The rule only fires when the file actually renders at least one JSX element whose
 * name ends in "Modal" (case-sensitive suffix match on the opening tag name).
 */

/**
 * Modal components that serve as container/wrapper primitives for a *Modal.tsx file.
 * They are the file's own outer shell, not sub-modals that need cleanup.
 * All others (e.g. <DatePickerModal>, <ConfirmationModal>) are treated as sub-modals.
 */
const CONTAINER_MODALS = new Set(['FullScreenModal', 'CenteredModal', 'BaseModal', 'RNModal']);

/** @param {string} name */
function isSubModalComponent(name) {
  // Must end in "Modal" but must NOT be one of the known container wrappers.
  return (
    typeof name === 'string' &&
    name.endsWith('Modal') &&
    name.length > 5 &&
    !CONTAINER_MODALS.has(name)
  );
}

/** Returns true if a CallExpression node is a call to `useSubModalVisibility`. */
function isUseSubModalVisibilityCall(node) {
  if (node.type !== 'CallExpression') {
    return false;
  }

  const callee = node.callee;
  return (
    (callee.type === 'Identifier' && callee.name === 'useSubModalVisibility') ||
    (callee.type === 'MemberExpression' &&
      callee.property.type === 'Identifier' &&
      callee.property.name === 'useSubModalVisibility')
  );
}

/**
 * Returns true if a useEffect call looks like a cleanup effect:
 *   useEffect(() => { if (!visible) { ... } }, [visible])
 *
 * We check:
 *   - callee is `useEffect`
 *   - second argument is an array containing an Identifier named `visible`
 *   - callback body contains an IfStatement whose test is `!visible` or `visible === false`
 *     or `false === visible`
 */
function isCleanupEffect(node) {
  if (node.type !== 'CallExpression') {
    return false;
  }

  const callee = node.callee;
  if (
    !(
      (callee.type === 'Identifier' && callee.name === 'useEffect') ||
      (callee.type === 'MemberExpression' &&
        callee.property.type === 'Identifier' &&
        callee.property.name === 'useEffect')
    )
  ) {
    return false;
  }

  const args = node.arguments;
  if (args.length < 2) {
    return false;
  }

  // Second arg must be an array that contains the identifier `visible`
  const depsArg = args[1];
  if (depsArg.type !== 'ArrayExpression') {
    return false;
  }

  const hasVisibleInDeps = depsArg.elements.some(
    (el) => el && el.type === 'Identifier' && el.name === 'visible'
  );

  if (!hasVisibleInDeps) {
    return false;
  }

  // First arg is the callback — get its body
  const callbackArg = args[0];
  let body = null;
  if (callbackArg.type === 'ArrowFunctionExpression' || callbackArg.type === 'FunctionExpression') {
    body = callbackArg.body;
  }

  if (!body || body.type !== 'BlockStatement') {
    return false;
  }

  // Look for an if-statement that checks `!visible` or `visible === false`
  return body.body.some((stmt) => {
    if (stmt.type !== 'IfStatement') {
      return false;
    }

    const test = stmt.test;
    // !visible
    if (
      test.type === 'UnaryExpression' &&
      test.operator === '!' &&
      test.argument.type === 'Identifier' &&
      test.argument.name === 'visible'
    ) {
      return true;
    }

    // visible === false  or  false === visible
    if (test.type === 'BinaryExpression' && (test.operator === '===' || test.operator === '==')) {
      const { left, right } = test;
      if (
        (left.type === 'Identifier' &&
          left.name === 'visible' &&
          right.type === 'Literal' &&
          right.value === false) ||
        (right.type === 'Identifier' &&
          right.name === 'visible' &&
          left.type === 'Literal' &&
          left.value === false)
      ) {
        return true;
      }
    }

    return false;
  });
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Modal files that render sub-modals must implement a cleanup pattern to avoid ghost native windows that block touches.',
    },
    schema: [],
    messages: {
      missingCleanup:
        'This modal renders <{{subModal}}> but has no sub-modal cleanup. ' +
        'Use `useSubModalVisibility(visible)` instead of `useState(false)` for the controlling ' +
        'state, or add a cleanup useEffect:\n' +
        '  useEffect(() => { if (!visible) { setX(false); /* all sub-modal states */ } }, [visible]);',
    },
  },

  create(context) {
    // Only run on *Modal.tsx / *Modal.ts files
    const filename = context.getFilename();
    if (!filename.match(/Modal\.[jt]sx?$/)) {
      return {};
    }

    // Collect sub-modal JSX usages found in this file
    const subModalUsages = [];
    // Whether we've found the cleanup hook or effect
    let hasSubModalVisibilityHook = false;
    let hasCleanupEffect = false;

    return {
      // Detect <SomeModal ...> elements
      JSXOpeningElement(node) {
        const nameNode = node.name;
        let name = null;

        if (nameNode.type === 'JSXIdentifier') {
          name = nameNode.name;
        } else if (nameNode.type === 'JSXMemberExpression') {
          // e.g. <Foo.Modal> — take property
          name = nameNode.property.name;
        }

        if (name && isSubModalComponent(name)) {
          subModalUsages.push({ node, name });
        }
      },

      // Detect useSubModalVisibility(...) calls
      CallExpression(node) {
        if (isUseSubModalVisibilityCall(node)) {
          hasSubModalVisibilityHook = true;
        }

        if (isCleanupEffect(node)) {
          hasCleanupEffect = true;
        }
      },

      // After traversal — report if needed
      'Program:exit'() {
        if (subModalUsages.length === 0) {
          return;
        }

        if (hasSubModalVisibilityHook || hasCleanupEffect) {
          return;
        }

        // Report on the first sub-modal usage
        const first = subModalUsages[0];
        context.report({
          node: first.node,
          messageId: 'missingCleanup',
          data: { subModal: first.name },
        });
      },
    };
  },
};
