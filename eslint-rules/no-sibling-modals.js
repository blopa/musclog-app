/* eslint-env node */
/**
 * no-sibling-modals
 *
 * On iOS, when Modal A is presented, React Native creates a dedicated UIViewController
 * for it. The original host controller becomes inactive. If Modal B is rendered as a
 * *sibling* of Modal A (same parent in the React tree), iOS tries to present it from
 * the now-inactive host controller and silently drops it — state updates correctly, but
 * the modal never appears.
 *
 * The fix: render follow-up modals *inside* the active modal's children tree, not as
 * siblings. They don't need to be visually nested — they just need to live under the
 * active modal in the React tree so React Native presents them from the correct
 * native controller.
 *
 * See docs/modals-problem-on-ios.md for the full explanation and fixed examples.
 *
 * This rule flags any JSX parent (fragment or non-modal element) that has 2+ direct
 * modal-like children — the structural pattern that triggers the iOS bug.
 *
 * Modal-like = component name ending in "Modal", or BottomPopUp / BottomPopUpMenu.
 *
 * Safe pattern (children inside active modal):
 *   <FullScreenModal visible={visible}>
 *     <ConfirmationModal visible={confirmVisible} />
 *     <DatePickerModal visible={dateVisible} />
 *   </FullScreenModal>
 *
 * Unsafe pattern (siblings — iOS may drop the second modal):
 *   <>
 *     <FullScreenModal visible={visible} />
 *     <ConfirmationModal visible={confirmVisible} />   ← flagged
 *   </>
 *
 * Note: The rule flags based on tree structure, not on the `visible` prop. Even when
 * only one modal is ever open at a time, sibling placement is still risky because iOS
 * checks the presenter hierarchy at mount time. The rule may produce false positives
 * for top-level screens that open multiple independent modals — in those cases, verify
 * that the modals are never opened while another is active, then suppress with:
 *   // eslint-disable-next-line local/no-sibling-modals
 */

/** Extra non-Modal-suffixed components that use React Native's Modal internally. */
const EXTRA_MODAL_LIKE = new Set(['BottomPopUp', 'BottomPopUpMenu']);

/** Returns the component name string from a JSX name node, or null. */
function getJSXName(nameNode) {
  if (!nameNode) {
    return null;
  }
  if (nameNode.type === 'JSXIdentifier') {
    return nameNode.name;
  }
  if (nameNode.type === 'JSXMemberExpression') {
    return nameNode.property.name;
  }
  return null;
}

/** Returns true if a JSX name node refers to a modal-like component. */
function isModalLike(nameNode) {
  const name = getJSXName(nameNode);
  if (!name) {
    return false;
  }
  return name.endsWith('Modal') || EXTRA_MODAL_LIKE.has(name);
}

/**
 * Scan a JSX children array and return all modal-like elements found as direct
 * children. Handles:
 *   - <SomeModal />                          (direct JSXElement)
 *   - {cond ? <SomeModal /> : null}          (ConditionalExpression consequent)
 *   - {cond ? null : <SomeModal />}          (ConditionalExpression alternate)
 *
 * Each entry is { reportNode: JSXOpeningElement, name: string }.
 */
function collectDirectModalChildren(children) {
  const found = [];

  for (const child of children) {
    if (child.type === 'JSXElement' && isModalLike(child.openingElement.name)) {
      found.push({
        reportNode: child.openingElement,
        name: getJSXName(child.openingElement.name),
      });
      continue;
    }

    if (child.type === 'JSXExpressionContainer') {
      const expr = child.expression;
      if (!expr || expr.type !== 'ConditionalExpression') {
        continue;
      }

      // consequent branch: {cond ? <Modal /> : ...}
      if (
        expr.consequent.type === 'JSXElement' &&
        isModalLike(expr.consequent.openingElement.name)
      ) {
        found.push({
          reportNode: expr.consequent.openingElement,
          name: getJSXName(expr.consequent.openingElement.name),
        });
      }

      // alternate branch: {cond ? ... : <Modal />}
      if (expr.alternate.type === 'JSXElement' && isModalLike(expr.alternate.openingElement.name)) {
        found.push({
          reportNode: expr.alternate.openingElement,
          name: getJSXName(expr.alternate.openingElement.name),
        });
      }
    }
  }

  return found;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow modal-like components as JSX siblings. On iOS, sibling modals cause a ' +
        'UIViewController hierarchy issue where the follow-up modal is silently dropped. ' +
        "Move follow-up modals inside the active modal's children tree instead.",
    },
    schema: [],
    messages: {
      siblingModal:
        '<{{name}}> is a sibling of another modal component. ' +
        'On iOS this triggers a UIViewController hierarchy bug: the second modal is silently ' +
        'dropped because the original host controller is no longer the active presenter. ' +
        "Move <{{name}}> inside the first modal's children tree. " +
        'See docs/modals-problem-on-ios.md for the correct pattern.',
    },
  },

  create(context) {
    /**
     * Check a JSX parent node (JSXElement or JSXFragment) for sibling modals.
     * If the parent is itself modal-like, its children are already inside an active
     * modal's tree — that is the correct pattern, so we skip it.
     */
    function checkNode(node) {
      // Children inside a modal container are safe — skip.
      if (node.type === 'JSXElement' && isModalLike(node.openingElement.name)) {
        return;
      }

      const children = node.children;
      if (!children || children.length < 2) {
        return;
      }

      const modalChildren = collectDirectModalChildren(children);
      if (modalChildren.length < 2) {
        return;
      }

      // The first modal in the sibling list is considered the "outer" / active one.
      // Flag all subsequent siblings — they should be moved inside the first.
      for (let i = 1; i < modalChildren.length; i++) {
        const { reportNode, name } = modalChildren[i];
        context.report({
          node: reportNode,
          messageId: 'siblingModal',
          data: { name: name ?? 'Modal' },
        });
      }
    }

    return {
      JSXFragment: checkNode,
      JSXElement: checkNode,
    };
  },
};
