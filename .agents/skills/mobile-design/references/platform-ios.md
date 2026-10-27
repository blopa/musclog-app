# iOS Platform

Use this for iOS-specific interaction, visual conventions, HIG alignment, SF Symbols, safe areas, Dynamic Type, sheets, and Apple ecosystem surfaces.

## HIG Principles

Use these as practical checks. Apple's current HIG foundations emphasize hierarchy, harmony, and consistency, expressed through the Liquid Glass material system introduced in the 2025 redesign (iOS 26). The older Clarity / Deference / Depth trio is still a useful heuristic lens but is no longer Apple's stated framing.

- Hierarchy: text, icons, and controls make the important thing obvious first.
- Harmony: layout, materials, and motion align with the platform rather than fighting it.
- Consistency: controls, gestures, and terminology match system expectations.
- Clarity / Deference / Depth (legacy heuristics): keep content readable, let UI support content, and use layering to communicate navigation and focus.

Verify the current HIG framing and any material/version-specific names against Apple's docs before citing them in a review.

## Typography

- Prefer SF Pro and semantic text styles in native code.
- Support Dynamic Type.
- Avoid fixed-height containers that clip larger text.
- Use SF Mono for code or aligned technical data.
- Use custom fonts only when brand value outweighs platform familiarity and loading cost.

## Controls and Touch

- Minimum hit area: 44pt by 44pt.
- Use native-feeling controls when possible: buttons, toggles, segmented controls, pickers, sheets, context menus.
- Icons should usually be SF Symbols for iOS-native work.
- Use haptics sparingly for meaningful state changes.

## Navigation

- Bottom tab bars work well for 3-5 top-level destinations.
- Root screens can use large titles; pushed detail screens often use compact titles.
- Preserve edge-swipe back.
- Do not place critical controls behind the home indicator, Dynamic Island, notch, or keyboard.

## Sheets and Modality

- Use sheets for focused supplementary tasks.
- Use detents when partial height improves context.
- Use full-screen only for immersive or high-commitment flows.
- Provide visible close/done actions.
- Confirm before discarding user work.

## Safe Areas

React Native:

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();

<View style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
  {children}
</View>
```

Rules:

- Backgrounds may extend behind safe areas.
- Text and interactive controls should not.
- Bottom CTAs need home-indicator clearance.
- Keyboard-aware forms must preserve focused input and submit actions.

## Color and Materials

- Prefer semantic system colors for native iOS UI.
- Use adaptive asset catalog colors for brand tokens in native code.
- Blur is appropriate for transient or layered surfaces, not generic repeated cards.
- On iOS 26+, prefer the system Liquid Glass materials for floating and layered surfaces over hand-rolled blur so the treatment stays consistent with the platform; check current SDK/RN support before relying on it.
- Test Increase Contrast and dark mode.

## Apple Ecosystem Surfaces

Use only when relevant to the product:

- Live Activities and Dynamic Island for time-sensitive ongoing tasks.
- Widgets for glanceable, repeat-use information.
- App Intents/Shortcuts for actions users repeat outside the app.
- Share sheets, context menus, and system pickers for platform-native tasks.

## iOS QA

- Dynamic Type at large sizes.
- VoiceOver labels, order, and modal focus.
- Reduce Motion.
- Increase Contrast.
- Dark mode.
- Safe areas on small, large, and Dynamic Island devices.
- Keyboard form behavior.
- Edge-swipe back and modal dismissal.
