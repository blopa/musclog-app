# Typography and Color

Use this for text hierarchy, Dynamic Type/font scaling, custom fonts, semantic colors, contrast, and color accessibility.

## Typography Principles

- System fonts are the safest default: SF Pro on iOS, Roboto on Android.
- Custom fonts should earn their cost through brand voice, editorial identity, or cross-platform consistency.
- Mobile body text should generally land around 15-17pt/sp for primary reading.
- Captions can be smaller, but avoid making important controls depend on tiny text.
- Set line height deliberately and test with larger font settings.
- Avoid fixed-height text containers that clip at large accessibility sizes.

## Platform Typography

iOS:

- Prefer semantic text styles in native code: large title, title, headline, body, callout, subheadline, footnote, caption.
- Dynamic Type should be supported unless a narrow control requires a justified cap.
- In React Native, `Text` scales by default through `allowFontScaling`.

Android:

- Use Material type roles in Compose.
- Use `sp` for text and `dp` for layout.
- Test the largest user font setting and display size setting.

React Native:

```tsx
import { Platform, StyleSheet } from 'react-native';

export const type = StyleSheet.create({
  title: {
    fontSize: 28,
    lineHeight: 34,
    // On Android, weight lives in the family name; pairing `sans-serif-medium`
    // with fontWeight '700' makes the family choice dead config and synthesizes
    // bold. Pick one axis: `sans-serif` + '700', or `sans-serif-medium` + '500'.
    ...Platform.select({
      ios: { fontFamily: 'System', fontWeight: '700' },
      android: { fontFamily: 'sans-serif', fontWeight: '700' },
    }),
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '400',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'sans-serif' },
    }),
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
});
```

Use `maxFontSizeMultiplier` only when a control would otherwise break beyond repair, and prefer responsive layout changes first.

## Type Direction

| Vibe | Good choices | Caution |
| --- | --- | --- |
| Platform-native | SF Pro / Roboto | Do not force custom fonts for novelty |
| Premium modern | Satoshi, Geist, Neue Montreal, GT America-like sans | Avoid generic use of Inter if it erases identity |
| Editorial | One expressive display face plus readable system/body face | Serif body text is risky on small screens |
| Playful | Rounded sans, friendly weights | Do not sacrifice legibility |
| Technical | System sans plus mono for data/code | Mono body text becomes tiring |

These are direction examples, not free-to-use assets. Several (for example Neue Montreal, GT America, Satoshi) are commercial or license-restricted; verify licensing before bundling any font with `expo-font`.

## Font Loading

For Expo custom fonts, use `expo-font`, keep the splash visible until critical fonts load, subset font files when possible, include fallback behavior, and avoid layout shifts from late font swaps.

## Color Roles

Prefer roles over raw colors: background, surface, elevated, text, textMuted, border, accent, onAccent, danger, success, and warning. Define light and dark values for every role.

## Platform Color

iOS:

- Prefer semantic system colors for native UI: label, secondaryLabel, systemBackground, secondarySystemBackground, separator, tint.
- Use asset catalog colors for custom adaptive brand colors.

Android:

- Prefer Material 3 `ColorScheme` roles.
- Dynamic color is available on Android 12+ and should be tested because user wallpaper can change role values.
- Edge-to-edge layouts mean status/nav bar contrast and system bar protection are part of color design.

React Native:

```tsx
import { useColorScheme } from 'react-native';

export function useTheme() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}
```

## Contrast and Meaning

WCAG AA minimums:

| Element | Minimum |
| --- | --- |
| Normal text | 4.5:1 |
| Large text | 3:1 |
| UI components/icons | 3:1 |

Rules:

- Do not communicate status by color alone; add icon, text, pattern, or position.
- Check disabled states. Low contrast can be acceptable only if the control is visibly disabled and not needed to understand content.
- Test grayscale and common color vision deficiency simulations for critical flows.
- Verify text-on-image after real image crops load.

## Typography and Color QA

- Large text enabled: no clipping, overlap, or inaccessible truncation.
- Long localized strings fit or wrap cleanly.
- Dark mode has intentional surfaces, not just inverted colors.
- Dynamic color or brand colors preserve contrast.
- Font loading does not flash blank UI longer than necessary.
- Numeric/data displays use tabular or mono treatment where comparison matters.
