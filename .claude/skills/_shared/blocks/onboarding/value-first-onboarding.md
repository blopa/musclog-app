---
name: value-first-onboarding
category: onboarding
dial_compatibility:
  expression: [3, 8]
  motion: [3, 7]
  density: [2, 5]
platforms: [ios, android]
when_to_use: "Consumer apps where each onboarding screen collects a real input or shows the actual product. Replaces the three-slide illustrated carousel."
not_for: "Pro tools (skip onboarding entirely); apps where signup is legally required first."
stack: ["expo-router", "nativewind", "reanimated"]
---

# Value-First Onboarding

## Sketch
```
(onboarding)/goal        "What are you here to do?"  → 3-5 large option rows (real input)
(onboarding)/preview     the actual product, pre-filled from their answer (not an illustration)
(onboarding)/notify      permission prime WITH context → system prompt only on accept
→ (tabs)
```
Rule: every screen either collects an input that changes the app, or shows the real
product. A screen that only asserts value ("Stay motivated!") is cut.

## Route API
Route group `(onboarding)/` with a stack `_layout.tsx`; completion writes a flag and
`router.replace("/(tabs)")`. Progress = thin bar in the header, not dots.

## Code sketch
```tsx
// (onboarding)/goal.tsx - option rows, not a carousel
<View className="flex-1 px-5 pt-4">
  <Text className="text-title mb-1">What brings you here?</Text>
  <Text className="text-body text-muted mb-6">This shapes your home screen.</Text>
  {GOALS.map((g) => (
    <PressableScale
      key={g.id}
      className="min-h-[56px] rounded-xl border border-border px-4 mb-3 justify-center"
      onPress={() => { setGoal(g.id); router.push("/(onboarding)/preview"); }}
    >
      <Text className="text-body">{g.label}</Text>
    </PressableScale>
  ))}
</View>
```

## Platform notes
- iOS: no header back on the first screen; subsequent steps get native back.
- Android: hardware back pops steps normally; on the first step it exits (no trap).

## Motion variants
- MOTION 1-3: none beyond navigation transitions.
- MOTION 4-7: option rows stagger in (first mount only, <= 400ms total); selected row
  spring-scales briefly before push.
- Reduced motion: instant.

## Dark mode
Token-driven; the preview screen must render in the user's system scheme (showing light
product shots to a dark-mode user reads as a template).

## Anti-patterns
- Three near-identical illustration slides with dots and Skip (tell #31).
- Requesting notifications on mount (6.6) - the prime screen explains, then asks.
- "Let's get started! 🎉" voice (6.7).
- A Skip button on screens that collect required inputs - if it can be skipped, it
  should not exist.

## References
Duolingo (personalization-first), Headspace (single question per screen), Linear mobile
(straight to product).
