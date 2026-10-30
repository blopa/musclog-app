# Android Platform

Use this for Android-specific interaction, Material 3, edge-to-edge, dynamic color, adaptive layouts, Compose conventions, Android back behavior, and Play-quality polish.

## Material 3 Direction

Material 3 emphasizes:

- Dynamic color and tonal palettes.
- Role-based color schemes.
- Adaptive layouts across phones, tablets, foldables, ChromeOS, and desktop windows.
- Components with built-in accessibility defaults.
- Motion and shape that communicate state, not decoration.

Material guidance changes over time, especially around expressive components, motion, typography, and theming. Check current official docs before using newly released APIs.

## Touch and Accessibility

- Minimum interactive target: 48dp by 48dp.
- Material components often include this by default when interactive.
- Custom controls must add size, semantics, role, and state manually.
- Use content descriptions for meaningful icon-only actions.
- Hide decorative icons from TalkBack.

Compose:

```kotlin
// clickable supplies the Button role and the activation action; declaring
// role = Role.Button without a click action announces a button TalkBack
// cannot activate. Prefer IconButton for standard cases.
Box(
  modifier = Modifier
    .minimumInteractiveComponentSize()
    .clickable(onClick = onOpenMenu)
    .semantics {
      contentDescription = "Open menu"
    }
)
```

## Navigation

- Bottom navigation for 3-5 primary destinations.
- Navigation rail for medium/expanded layouts.
- Drawer for many destinations or secondary/admin areas.
- FAB for one high-emphasis primary action, typically bottom-right.
- Preserve system back and predictive back expectations.

FAB guidance:

- Use only for a single common primary action.
- Do not duplicate a primary bottom CTA and FAB unless their jobs differ clearly.
- Extended FAB can help when an icon alone is unclear.

## Edge-to-Edge and Insets

Edge-to-edge requirements depend on current Android platform and target SDK policy. Check official docs, then design and implement for status bars, navigation bars, display cutouts, IME/keyboard, and system bar contrast.

Rules:

- Backgrounds can draw behind system bars.
- Critical content and controls must be padded by insets.
- Bottom bars and CTAs need navigation bar protection.
- Test gesture nav and three-button nav where possible.
- Material 3 `Scaffold` can reduce inset handling work, but verify actual layout.

## Dynamic Color

Dynamic color is available on Android 12+.

- Use `MaterialTheme.colorScheme` roles.
- Provide fallback light/dark schemes.
- Test contrast and brand fit under generated palettes.
- For strict brand apps, decide whether dynamic color is opt-in, limited, or disabled.

Compose pattern:

```kotlin
val dynamicColor = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
val colors = when {
  dynamicColor && darkTheme -> dynamicDarkColorScheme(LocalContext.current)
  dynamicColor && !darkTheme -> dynamicLightColorScheme(LocalContext.current)
  darkTheme -> DarkColorScheme
  else -> LightColorScheme
}
```

## Adaptive Layout

Design beyond a single phone width:

- Compact: bottom navigation, single-pane flows.
- Medium: navigation rail, wider content, two-pane where useful.
- Expanded: list-detail, supporting pane, permanent navigation, richer density.
- Foldables: avoid hinge-obscured critical content and support posture changes.

## Android Feedback

- Prefer Snackbar with undo for reversible operations.
- Toast is for low-importance transient messages; avoid using it for critical feedback.
- Dialogs are for decisions that require attention.
- Bottom sheets are for contextual choices or short tasks.

## Android QA

- TalkBack traversal and content descriptions.
- Font size and display size largest settings.
- Dark mode and dynamic color.
- Edge-to-edge behavior for the app's target SDK.
- Gesture nav and system back.
- Compact, medium, and expanded widths.
- Low-end performance for long lists and image-heavy screens.
