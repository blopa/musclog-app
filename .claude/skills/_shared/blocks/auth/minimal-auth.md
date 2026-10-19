---
name: minimal-auth
category: auth
dial_compatibility:
  expression: [2, 8]
  motion: [1, 4]
  density: [2, 4]
platforms: [ios, android, web]
when_to_use: "Any email/social sign-in flow. Auth is a utility surface: fast, boring, correct."
not_for: "Apps that can defer auth (browse-first) - defer it; the best auth screen is none."
stack: ["expo-router", "nativewind", "react-native-keyboard-controller"]
---

# Minimal Auth

## Sketch
```
(auth)/sign-in
  [ wordmark, small ]           ← not a hero; auth is not a landing page
  [ Continue with Apple ]       ← social buttons first, official button styles
  [ Continue with Google ]
  ── or ──
  [ email field ]               ← keyboardType="email-address", textContentType="username",
  [ password field ]              autoComplete + textContentType="password" (autofill!)
  [ Continue ]                  ← visible above keyboard (keyboard skeleton)
  Forgot password? · Create account
```

## Route API
`(auth)/` group: `sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`. Group `_layout`
redirects to `(tabs)` when a session exists. Centered vertical composition is CORRECT
here (interstitial exception to the poster-screen rule).

## Code sketch
```tsx
<KeyboardAwareScrollView bottomOffset={16} keyboardShouldPersistTaps="handled"
  contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}>
  <TextInput
    keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
    textContentType="username" autoComplete="email"
    // label ABOVE, inline error BELOW - never placeholder-as-label
  />
  <TextInput secureTextEntry textContentType="password" autoComplete="current-password" />
  <Button loading={isPending} onPress={submit}>Continue</Button>
</KeyboardAwareScrollView>
```

## Platform notes
- Apple sign-in is REQUIRED on iOS if any third-party social login is offered.
- Use official Apple/Google button styles (assets/`expo-apple-authentication`), not
  hand-styled lookalikes.
- Errors inline under the field ("Wrong password") - not Alert.alert (tell #32), not toast.

## Motion variants
MOTION any: none beyond a subtle button loading state. Auth speed IS the design.

## Dark mode
Social button variants per scheme (Apple: white-on-dark / black-on-light).

## Anti-patterns
- Illustration hero above the form pushing fields below the keyboard.
- Missing autofill props (tell #34) - the difference between 5 seconds and 60.
- "Welcome back! 👋" headline (tell #30). Password rules revealed only on error.

## References
Things, Notion mobile, Airbnb (browse-first with deferred auth).
