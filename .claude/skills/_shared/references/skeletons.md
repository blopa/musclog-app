# Canonical Motion & Interaction Skeletons

The patterns LLMs most reliably botch in React Native, with the canonical implementation
and the named failure modes each skeleton exists to prevent. Package versions:
see `versions.md`. Skeletons assume Reanimated is installed; the gesture-based ones
(2, 6) additionally require Gesture Handler with `GestureHandlerRootView` at the app
root. Verify against `package.json` before importing (SKILL.md Section 2).

## Worklet hygiene (applies to every skeleton)

* Never read or write `sharedValue.value` during React render. Shared values are for
  worklets and event handlers.
* Any JS function called from inside a worklet (analytics, navigation, setState) goes
  through `runOnJS(fn)(args)`.
* Create shared values unconditionally at the top level of the component - never inside
  conditions, loops, or list `renderItem`.
* `GestureHandlerRootView` wraps the app ONCE (root layout). A missing root view is the
  #1 "gestures silently don't work" cause.
* Cleanup: `cancelAnimation(sv)` in effect cleanup for infinite loops.

---

## 1. Collapsing / parallax header on scroll

The mobile equivalent of the web skill's GSAP sticky-stack: needed on most detail and
profile screens, and the single most-botched Reanimated pattern.

**LLM failure modes this prevents:**
- `useState` + `onScroll` → re-render every frame (janks at 10-20fps)
- animating `height` (layout prop, JS thread) instead of `transform`
- mixing legacy `Animated` with Reanimated in one component
- no `Extrapolation.CLAMP` → header over-shrinks / inverts past the scroll range
- absolute header with no `paddingTop` compensation → content hides under it

```tsx
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HEADER_MAX = 240;
const HEADER_MIN = 64;

export function CollapsingHeaderScreen({ children, hero }: {
  children: React.ReactNode;
  hero: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const headerMin = HEADER_MIN + insets.top;
  const range = HEADER_MAX - headerMin;

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Collapse by translating, never by animating height (layout prop = JS thread).
  const headerStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(scrollY.value, [0, range], [0, -range], Extrapolation.CLAMP),
    }],
  }));

  // Parallax + slight zoom on the hero as it collapses.
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, range], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [0, range], [0, range * 0.5], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-HEADER_MAX, 0], [1.4, 1], Extrapolation.CLAMP) },
    ],
  }));

  // Compact title crossfades in as the hero fades out.
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [range * 0.6, range], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: HEADER_MAX }} // compensate for absolute header
      >
        {children}
      </Animated.ScrollView>
      <Animated.View
        style={[{ position: "absolute", top: 0, left: 0, right: 0, height: HEADER_MAX, overflow: "hidden" }, headerStyle]}
      >
        <Animated.View style={[{ flex: 1 }, heroStyle]}>{hero}</Animated.View>
        <Animated.View
          style={[{ position: "absolute", left: 0, right: 0, bottom: 0, height: HEADER_MIN, justifyContent: "center" }, titleStyle]}
        >
          {/* compact title row */}
        </Animated.View>
      </Animated.View>
    </>
  );
}
```

---

## 2. Bottom sheet (@gorhom/bottom-sheet)

**LLM failure modes this prevents:**
- hand-rolled Modal + PanResponder sheet (always broken)
- missing `BottomSheetModalProvider` / `GestureHandlerRootView` (silently renders nothing)
- plain `ScrollView`/`FlatList` inside the sheet → gesture conflict, sheet won't drag
- `snapPoints` array literal recreated every render (must be memoized)
- no backdrop; no `keyboardBehavior` on sheets containing inputs

```tsx
// Root layout, once:
// <GestureHandlerRootView style={{ flex: 1 }}>
//   <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
// </GestureHandlerRootView>

import { useCallback, useMemo, useRef } from "react";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView, // ALWAYS the BottomSheet-prefixed scrollables inside
} from "@gorhom/bottom-sheet";

export function useOptionsSheet() {
  const ref = useRef<BottomSheetModal>(null);
  const present = useCallback(() => ref.current?.present(), []);

  const sheet = (
    <BottomSheetModal
      ref={ref}
      snapPoints={useMemo(() => ["40%"], [])} // memoized, or omit for dynamic sizing
      enableDynamicSizing
      keyboardBehavior="interactive" // needed the moment the sheet has a TextInput
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
      )}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* sheet content */}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );

  return { present, sheet };
}
```

Rule from SKILL.md 4.B: the moment a sheet needs its own back stack or a second screen,
it should have been a modal route.

---

## 3. Keyboard handling

The most universally-needed, most-botched interaction in RN.

**LLM failure modes this prevents:**
- `KeyboardAvoidingView behavior="padding"` wrapping the whole screen with no
  `keyboardVerticalOffset` → content jumps by the header height
- wrong nesting order with ScrollView
- missing `keyboardShouldPersistTaps` → first tap dismisses keyboard, second taps button
- chat input pinned with absolute positioning that ignores the keyboard

**Default: `react-native-keyboard-controller`** (see versions.md), which does the right
thing on both platforms:

```tsx
// Form screen
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

<KeyboardAwareScrollView
  bottomOffset={16}                    // gap between focused input and keyboard
  keyboardShouldPersistTaps="handled"  // buttons tappable while keyboard is up
  contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}
>
  {/* label-above inputs; submit button INSIDE the scroll content so it rises */}
</KeyboardAwareScrollView>

// Chat / composer screen: sticky input above the keyboard
import { KeyboardStickyView } from "react-native-keyboard-controller";

<KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
  <Composer />
</KeyboardStickyView>
```

**Fallback (no extra dependency), the correct plain-RN recipe:**

```tsx
import { Platform, KeyboardAvoidingView, ScrollView } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";

const headerHeight = useHeaderHeight();

<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === "ios" ? "padding" : undefined} // Android: let the OS resize
  keyboardVerticalOffset={headerHeight}                     // THE line LLMs omit
>
  <ScrollView keyboardShouldPersistTaps="handled">{/* form */}</ScrollView>
</KeyboardAvoidingView>
```

---

## 4. PressableScale (press feedback)

Tiny skeleton, huge quality delta; used on every interactive element.

**LLM failure modes this prevents:**
- `useState(pressed)` → re-render on every press in/out
- `withTiming` (feels laggy) instead of a spring
- new shared value per list row in a non-memoized component
- feedback still firing on `disabled` elements

```tsx
import { Pressable, type PressableProps } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({ disabled, style, ...props }: PressableProps) {
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }], // ~0.97 at full press
    opacity: 1 - pressed.value * 0.05,
  }));

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      accessibilityRole="button"
      onPressIn={(e) => {
        pressed.value = withSpring(1, { damping: 20, stiffness: 300 });
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, { damping: 20, stiffness: 300 });
        props.onPressOut?.(e);
      }}
      style={[style as any, animatedStyle]}
    />
  );
}
```

Haptics are deliberately NOT baked into the press primitive - firing on every press-in
is exactly the haptic-spam tell (SKILL.md 6.5). Wire haptics at the call site, on the
confirmed action (`onPress` of a meaningful confirmation), per the 6.5 vocabulary.

On Android at `EXPRESSION <= 5`, prefer `android_ripple={{ color: ..., borderless: false }}`
on a plain `Pressable` instead - ripple is the platform's own feedback.

---

## 5. Staggered entrance (and the list-recycling caveat)

**LLM failure modes this prevents:**
- `entering={FadeInDown.delay(i * 50)}` on every FlashList/FlatList row → recycled cells
  replay their entrance mid-scroll (the "popcorn list" tell)
- setTimeout-based stagger
- staggering so long the screen feels slow (> ~400ms total)

```tsx
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

// A) Non-virtualized mount content (headers, hero, a short static column): fine.
<Animated.View entering={FadeInDown.duration(300).delay(i * 60)} />

// B) Virtualized lists: entrance ONLY for the first visible batch, guarded by index.
renderItem={({ item, index }) => (
  <Animated.View entering={index < 6 ? FadeInDown.duration(250).delay(index * 40) : undefined}>
    <Row item={item} />
  </Animated.View>
)}

// C) Insert/remove/reorder: layout transitions on the list, not entrance per cell.
<Animated.FlatList itemLayoutAnimation={LinearTransition.springify()} ... />
```

Reduced motion: entrance/stagger collapses to instant (`useReducedMotion()` guard).

---

## 6. Swipeable row + animated delete

**LLM failure modes this prevents:**
- hand-rolled `PanResponder` swipe
- horizontal pan fighting the list's vertical scroll (missing activation offsets)
- delete with no layout collapse (row vanishes, list jumps)
- swipe as the ONLY path to the action (gesture-discoverability rule)

```tsx
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { LinearTransition, useAnimatedStyle, interpolate } from "react-native-reanimated";

function RightAction({ progress, onDelete }: any) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [80, 0]) }],
  }));
  return (
    <Animated.View style={[{ width: 80 }, style]}>
      <DeleteButton onPress={onDelete} /> {/* visible alternate path must ALSO exist */}
    </Animated.View>
  );
}

// In the list: itemLayoutAnimation collapses the gap when a row is removed.
<Animated.FlatList
  data={items}
  itemLayoutAnimation={LinearTransition.springify()}
  renderItem={({ item }) => (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={(progress) => (
        <RightAction progress={progress} onDelete={() => remove(item.id)} />
      )}
    >
      <Row item={item} />
    </ReanimatedSwipeable>
  )}
/>
```

`ReanimatedSwipeable` (Gesture Handler's maintained swipeable) handles the
scroll-vs-pan activation internally - do not reimplement with raw `Gesture.Pan()` unless
you also set `activeOffsetX` / `failOffsetY`.

---

## 7. Skeleton shimmer (short form)

**Failure modes:** one `withRepeat` loop per placeholder cell (dozens of live loops);
animating gradient width; JS-thread pulse.

Canonical cheap version - ONE shared loop drives every cell via opacity:

```tsx
const pulse = useSharedValue(0.4);
useEffect(() => {
  pulse.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  return () => cancelAnimation(pulse);
}, []);
const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
// Render gray rounded blocks matching the REAL layout's shapes, all using `style`.
```

A translating-gradient shimmer is allowed at `MOTION >= 6`; still one shared value,
`transform: translateX` only.

---

## 8. Onboarding pager with animated dots (short form)

**Failure modes:** `useState(page)` from `onMomentumScrollEnd` (dots lag a full page);
per-dot JS interpolation.

```tsx
const scrollX = useSharedValue(0);
const onScroll = useAnimatedScrollHandler((e) => { scrollX.value = e.contentOffset.x; });
// <Animated.ScrollView horizontal pagingEnabled onScroll={onScroll} scrollEventThrottle={16}>
// Dot i:
const dotStyle = useAnimatedStyle(() => ({
  width: interpolate(scrollX.value, [(i - 1) * W, i * W, (i + 1) * W], [8, 20, 8], Extrapolation.CLAMP),
  opacity: interpolate(scrollX.value, [(i - 1) * W, i * W, (i + 1) * W], [0.4, 1, 0.4], Extrapolation.CLAMP),
}));
```

---

## Anti-skeletons: do NOT attempt

* **Shared-element transitions.** There is no stable RN API (see versions.md). LLMs
  hallucinate dead libraries here. Approximate: push the detail screen with the hero
  image already positioned + a fast fade/scale-in, and label it an approximation.
* **Custom pull-to-refresh.** `<RefreshControl refreshing={...} onRefresh={...} />` is
  the correct answer essentially always. Custom Lottie pull indicators are a slop magnet.
* **Manual tab-switch transitions.** Native navigators own tab transitions. Never fade
  whole tab scenes with opacity.
* **Scroll-hijacking.** Web scrolltelling patterns (pin + scrub) are hostile on mobile.
  The collapsing header (Skeleton 1) is the moral replacement.
