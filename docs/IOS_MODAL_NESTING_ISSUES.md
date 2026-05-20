# iOS Nested Modal Issues and Solutions

## Problem Overview

In React Native and Expo applications, you may encounter an issue on iOS where opening a modal from within another modal fails to display the second modal correctly. Typically, the second modal only appears after the first one is closed, or it may not appear at all (UI freeze).

This behavior is primarily due to the way iOS handles `UIViewController` presentations. A `UIViewController` that is already presenting another view controller cannot present a new one on top of the currently presented one.

## Common Symptoms

- **Modal B doesn't open**: Pressing a button in Modal A that should open Modal B does nothing.
- **Delayed opening**: Modal B only appears _after_ Modal A is dismissed.
- **UI Freeze**: The application becomes unresponsive because a native layer is waiting for an action that is obscured.

---

## Recommended Solutions

### 1. Sequential Modal Management (The "Close-then-Open" Pattern)

Instead of nesting modals, ensure that the first modal is completely closed before the second one is triggered.

#### How to implement:

Use a small delay or a callback that fires when the first modal has finished its closing animation.

```tsx
const [isModalAVisible, setIsModalAVisible] = useState(false);
const [isModalBVisible, setIsModalBVisible] = useState(false);

const openModalB = () => {
  // 1. Close Modal A
  setIsModalAVisible(false);

  // 2. Open Modal B after Modal A's transition is complete
  // On iOS, a small timeout or requestAnimationFrame is often necessary
  setTimeout(() => {
    setIsModalBVisible(true);
  }, 300); // 300ms is usually enough for the default slide animation
};
```

### 2. Using `onDismiss` (Native Callback)

React Native's `Modal` component has an `onDismiss` prop (iOS only) that is called when the modal has been dismissed.

```tsx
const [isModalAVisible, setIsModalAVisible] = useState(false);
const [shouldOpenModalB, setShouldOpenModalB] = useState(false);

const handleCloseAAndOpenB = () => {
  setShouldOpenModalB(true);
  setIsModalAVisible(false);
};

return (
  <>
    <Modal
      visible={isModalAVisible}
      onDismiss={() => {
        if (shouldOpenModalB) {
          setIsModalBVisible(true);
          setShouldOpenModalB(false);
        }
      }}
    >
      <Button title="Open B" onPress={handleCloseAAndOpenB} />
    </Modal>

    <Modal visible={isModalBVisible}>{/* Content for Modal B */}</Modal>
  </>
);
```

### 3. Navigation-Based Modals (Recommended for complex flows)

If your UX involves multiple screens within a flow, consider using a **Stack Navigator** inside a single Full-Screen Modal rather than multiple separate `Modal` components.

- **Pros**: Handles transitions smoothly, provides a "Back" button automatically, and avoids native nesting issues.
- **Cons**: Requires setting up a navigator.

### 4. Custom View-Based Modals

Instead of using the native `Modal` component from `react-native`, you can use absolute-positioned `View` components with `z-index`.

- **Pros**: No native limitations; you can stack as many as you want.
- **Cons**: You must handle the hardware back button (Android) and status bar behavior manually. Libraries like `react-native-modal` often provide a middle ground, but they still rely on the native `Modal` by default.

---

## Best Practices for Musclog

In this codebase, we use `CenteredModal` and `FullScreenModal` wrappers. To ensure compatibility:

1. **Avoid direct nesting**: Try not to render a `<Modal>` inside the `children` of another `<Modal>`. Instead, lift the state up and render them as siblings.
2. **Use `setTimeout` for transitions**: When transitioning between two different modals, always use a small delay if you are closing one and opening another.
3. **Queue actions**: If a button needs to close a modal and then navigate or open another modal, use the "Queued Action" pattern where you set a state variable and execute the action after the modal is hidden.

## Technical References

- [React Native Modal Documentation](https://reactnative.dev/docs/modal)
- [iOS UIViewController Presentation Contexts](https://developer.apple.com/documentation/uikit/uiviewcontroller/1621380-presentviewcontroller)
- [GitHub Issue: Multiple Modals on iOS](https://github.com/facebook/react-native/issues/29455)
