# Motion and Haptics

Use this for animation, micro-interactions, transitions, Reanimated, Gesture Handler, reduced motion, loading transitions, and tactile feedback.

## Motion Purpose

Animation should do at least one job:

- Confirm input.
- Preserve spatial continuity.
- Explain hierarchy changes.
- Reveal progress.
- Draw attention to a state change.
- Add brand character without slowing the task.

If an animation cannot be explained through the user or system state, remove it.

## Intensity

This table mirrors the canonical `MOTION_INTENSITY` definition in `references/design-process.md`; keep the two in sync.

| `MOTION_INTENSITY` | Behavior |
| --- | --- |
| 1-3 | Native transitions, press states, minimal fades |
| 4-6 | Spring press feedback, sheet/list transitions, subtle skeletons |
| 7-8 | Shared element moments, parallax, richer success states |
| 9-10 | Highly choreographed or experimental, only for briefs that call for it |

Always support reduced motion by disabling nonessential transforms, parallax, and looping animations. Keep essential feedback, but make it immediate or use a simple opacity change.

In React Native, check the current preference and subscribe to changes rather than reading it once at app start:

```tsx
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

function useReducedMotion() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setEnabled);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);
    return () => subscription.remove();
  }, []);

  return enabled;
}
```

Use the returned value to remove decorative delays, loops, parallax, and large transforms. Check local Reanimated documentation before choosing its version-specific reduced-motion API.

## Implementation Choice

Use the simplest reliable tool:

- `Pressable` state style for basic press feedback.
- Reanimated for gesture-driven, interruptible, high-frequency, or physics-based motion.
- Gesture Handler for complex gestures beyond basic press/tap.
- Native navigation transitions for screen movement unless custom continuity is important.
- Platform components or mature libraries for bottom sheets, pull-to-refresh, and swipe actions unless custom behavior is required.

## Performance Rules

Prefer animating:

- `transform`
- `opacity`

Be cautious with layout properties such as width, height, top, left, margin, padding, and border radius. They may be acceptable for small, measured, non-scroll-critical transitions, but do not use them in high-frequency gestures or large lists without profiling.

Avoid:

- Animations triggered during render.
- Infinite loops on large lists or many repeated components.
- JS-thread scroll listeners for continuous effects.
- Haptic calls inside high-frequency gesture updates.
- Animating hidden content without updating accessibility visibility.

## Press Feedback

Use `Pressable` state styles for ordinary controls. Use Reanimated when press feedback interacts with gesture state, shared layout, or complex visual elements. Keep feedback fast: opacity/scale changes should appear within roughly 100ms.

## Spring Presets

Treat presets as starting points:

```ts
export const spring = {
  snappy: { mass: 1, damping: 20, stiffness: 300 },
  gentle: { mass: 1, damping: 26, stiffness: 140 },
  playful: { mass: 1, damping: 12, stiffness: 210 },
  structural: { mass: 1, damping: 32, stiffness: 380, overshootClamping: true },
};
```

Choose by weight:

- Button/icon: snappy.
- Card/sheet/content: gentle or structural.
- Celebration/social reaction: playful.
- Safety-critical confirmation: structural and restrained.

## Loading Motion

Use skeletons when they preserve layout and help users understand what is loading. Use spinners/progress indicators when the content shape is unknown or the wait is short and localized.

Skeleton rules:

- Match final content dimensions.
- Do not shimmer aggressively.
- Pause or simplify when reduced motion is enabled.
- Avoid dozens of independent looping placeholders.

## List Motion

Entry animation is optional. Use it when content appearing needs continuity or polish, not on every list by default.

Rules:

- Cap stagger to the first visible items.
- Keep delays short.
- Preserve stable keys.
- Avoid re-animating items on ordinary parent renders.

## Navigation and Shared Transitions

- Let platform navigation do ordinary push/pop and modal movement.
- Use custom transitions when the content itself logically transforms.
- Do not make all screens share the same flashy transition.
- Preserve back gesture and Android back behavior.

## Haptic Pairing

Pair haptics with discrete state changes. Do not fire haptics on passive scrolling, background updates, or every frame of a gesture.

## Motion QA

- Press feedback appears within roughly 100ms.
- Important animations are interruptible.
- Reduced Motion path is acceptable.
- No layout animation jank in scroll-critical areas.
- No infinite motion that distracts from the task.
- Haptics are meaningful and not repeated rapidly.
