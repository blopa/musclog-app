---
name: composed-empty-state
category: empty-states
dial_compatibility:
  expression: [2, 9]
  motion: [1, 5]
  density: [1, 3]
platforms: [ios, android, web]
when_to_use: "Every data surface's zero state: first-run, post-filter, post-search, error, offline."
not_for: "Loading (that's skeletons) - an empty state shown while data is in flight is a bug."
stack: ["expo-router", "nativewind"]
---

# Composed Empty State

## Sketch
```
        [ glyph or small product-true visual ]   ← one icon from the app's family at ~48-64,
                                                    NOT a giant illustration, NOT emoji
        No workouts yet                          ← states the fact, plainly
        Your completed workouts will show        ← one line: what appears here and how
        up here.
        [ Start a workout ]                      ← THE action that populates it (when one exists)
```
Centered vertically - the interstitial exception where centering is correct.

## Props API
`<EmptyState icon label body action={{label, onPress}} />` with variants:
`first-run` (action-forward), `filtered` ("Clear filters" action), `search`
("No results for 'x'"), `error` (retry), `offline` (cached note + retry).

## Code sketch
```tsx
<View className="flex-1 items-center justify-center px-8 gap-2">
  <Icon name="barbell" size={56} className="text-muted mb-2" />
  <Text className="text-title text-center">{label}</Text>
  <Text className="text-body text-muted text-center">{body}</Text>
  {action && <Button className="mt-4" onPress={action.onPress}>{action.label}</Button>}
</View>
```

## Platform notes
None significant - this is the most portable block. On web, cap width (~400px).

## Motion variants
MOTION 4+: single gentle mount fade/rise (200-300ms). Never a looping animation begging
for attention on a screen the user will leave.

## Dark mode
Muted glyph color from tokens; verify the glyph doesn't disappear on dark surface.

## Anti-patterns
- Emoji as the visual (tell #1). A paragraph of copy. "Nothing here yet! 🎉" voice (6.7).
- An action-less first-run state when an obvious populate-action exists.
- Reusing the identical empty component for error and offline (different jobs: error
  needs retry, offline needs status).

## References
Things (empty projects), Apple Photos search, Linear mobile filtered views.
