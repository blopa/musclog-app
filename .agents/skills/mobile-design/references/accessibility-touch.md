# Accessibility and Touch

Use this for touch targets, gestures, screen reader behavior, haptics, focus, motor accessibility, and cognitive load.

## Touch Targets

Minimum interactive hit areas:

- iOS: 44pt by 44pt.
- Android: 48dp by 48dp.
- Leave enough spacing between adjacent actions, especially destructive and primary actions.

The visible icon may be 20-24pt; the hit area still needs to meet the minimum through padding, layout, or `hitSlop`. Size the expanded area against the larger 48dp Android minimum, not just 44pt iOS. With a 24pt icon, 12 per edge reaches 48; smaller icons need more.

```tsx
<Pressable
  accessibilityRole="button"
  accessibilityLabel="Delete item"
  // 24pt icon + 12 per edge = 48x48, meets both iOS (44) and Android (48).
  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
  style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
  onPress={onDelete}
>
  <TrashIcon width={24} height={24} />
</Pressable>
```

## Affordance

Interactive elements should look interactive. Use at least one clear signal: button treatment, row chevron, standard platform component, control placement, visible label, or established icon convention.

Avoid making tappable cards and non-tappable cards visually identical. Icon-only actions need accessible labels and should be obvious from context.

## Thumb Zones

Use reachability as a design input:

- Repeated primary actions: lower half of the screen.
- Tab/navigation controls: bottom navigation is usually best for phones.
- Destructive actions: require confirmation or place outside accidental reach.
- Search and settings may live higher, but provide reachable paths for frequent use.

Design for left-handed and right-handed use. Avoid putting all important controls in one corner.

## Gestures

Gestures are invisible. Use them when they are expected, reversible, and supported by visible affordances.

Good patterns:

- Pull to refresh on scrollable lists.
- Swipe row actions with visible revealed buttons.
- Pinch to zoom on media/maps.
- Long press for contextual actions.
- Sheet drag handles for dismiss/resize.

Avoid:

- Full-screen horizontal swipes that conflict with system back gestures.
- Bottom-edge gestures that fight home/navigation gestures.
- Critical gesture-only actions without a button alternative.
- Custom gestures where a native component already solves the job.

## Screen Readers

Every interactive element needs:

- Accessible name.
- Role.
- State when relevant: selected, disabled, expanded, checked, busy.
- Hint only when the result is not obvious.

Group related non-interactive children into one meaningful element when scanning individual labels would be noisy.

```tsx
<Pressable
  accessibilityRole="button"
  accessibilityLabel={`Open ${product.name}, ${product.price}`}
  accessibilityHint="Shows product details"
  onPress={openProduct}
>
  <ProductRow product={product} />
</Pressable>
```

Decorative icons and images should be hidden from accessibility APIs.

## Focus and Dynamic Content

- When a modal opens, move focus into it.
- When it closes, return focus to the trigger.
- Announce async success/error results. Use `accessibilityLiveRegion` for Android and `AccessibilityInfo.announceForAccessibility` for iOS; neither alone covers both platforms.
- Put validation messages near the fields they describe.
- Use logical reading order: top to bottom, leading to trailing.

React Native examples:

```tsx
// accessibilityLiveRegion is Android-only. On iOS, VoiceOver needs an
// explicit announcement when the message changes.
<Text accessibilityLiveRegion="polite">{statusMessage}</Text>;

useEffect(() => {
  if (statusMessage && Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibility(statusMessage);
  }
}, [statusMessage]);

<Pressable
  accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
  disabled={isSubmitting}
>
  <Text>{isSubmitting ? 'Submitting' : 'Submit'}</Text>
</Pressable>
```

## Motor Accessibility

- Avoid overlapping touch regions.
- Do not require rapid repeated taps.
- Provide undo for destructive actions where possible.
- Support Switch Control / Switch Access through clear focus order.
- Do not make scrollable nested regions fight each other.

## Haptics and Load

Use haptics only for meaningful state changes, and never as the only feedback. For motion/haptic timing, read `references/motion-haptics.md`.

Reduce cognitive load by showing the next best action, hiding advanced actions until needed, preventing errors before recovery, and using concrete labels such as `Pay $48.20`, `Save draft`, or `Retry upload`.

## Touch QA

- Every target meets platform minimum hit area.
- Tappable elements are visually distinguishable from static content.
- Important gestures have visible alternatives.
- Screen reader labels are meaningful and not duplicated.
- Focus order matches visual order.
- Error messages are announced and recoverable.
- Primary action remains reachable with keyboard open.
