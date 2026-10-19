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
 *
 * The same holds for spacing classes on `className` itself: `AddUserMetricEntryModal`
 * (`px-4 pb-12`), `ExercisesModal` (`px-4 pb-32`) and `DataLogModal` (`px-4 gap-3`) shipped with
 * them and rendered edge to edge. Only layout classes such as `flex-1` are safe there.
 */
const SPACING_CLASS =
  /(^|\s)(?:[a-z0-9-]+:)*-?(?:p|m)[xytblrse]?-|(^|\s)(?:[a-z0-9-]+:)*gap(?:-[xy])?-/;

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
      spacing:
        'Padding, margin and gap classes on a KeyboardAwareScrollView `className` do not lay out its content. Put them on an inner <View> instead.',
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

          if (
            attribute.type === 'JSXAttribute' &&
            attribute.name.type === 'JSXIdentifier' &&
            attribute.name.name === 'className' &&
            attribute.value?.type === 'Literal' &&
            typeof attribute.value.value === 'string' &&
            SPACING_CLASS.test(attribute.value.value)
          ) {
            context.report({ node: attribute, messageId: 'spacing' });
          }
        }
      },
    };
  },
};
