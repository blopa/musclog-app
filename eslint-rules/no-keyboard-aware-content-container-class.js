/**
 * `KeyboardAwareScrollView` silently drops `contentContainerClassName`.
 *
 * NativeWind maps that prop only for the components `react-native-css-interop` registers — RN's
 * `ScrollView`, `FlatList`, `VirtualizedList` and `KeyboardAvoidingView`. `react-native-keyboard-controller`'s
 * `KeyboardAwareScrollView` is not one of them, so the classes vanish with no warning and no type
 * error: `CreateEditPlanModal` shipped with `contentContainerClassName="gap-5 px-4 pb-32 pt-6"` and
 * rendered edge to edge with its last row hidden under the footer.
 *
 * Put the padding/gap classes on an inner `View` instead.
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow contentContainerClassName on KeyboardAwareScrollView, where NativeWind drops it',
    },
    schema: [],
    messages: {
      unsupported:
        'NativeWind does not map `contentContainerClassName` for KeyboardAwareScrollView, so these classes are silently dropped. Put them on an inner <View> instead.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'KeyboardAwareScrollView') {
          return;
        }

        for (const attribute of node.attributes) {
          if (
            attribute.type === 'JSXAttribute' &&
            attribute.name.type === 'JSXIdentifier' &&
            attribute.name.name === 'contentContainerClassName'
          ) {
            context.report({ node: attribute, messageId: 'unsupported' });
          }
        }
      },
    };
  },
};
