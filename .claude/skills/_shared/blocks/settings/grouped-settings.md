---
name: grouped-settings
category: settings
dial_compatibility:
  expression: [1, 6]
  motion: [1, 3]
  density: [4, 6]
platforms: [ios, android]
when_to_use: "Any settings/preferences screen. The default; deviate only above EXPRESSION 7."
not_for: "Single-toggle screens (put the toggle where the feature is instead)."
stack: ["expo-router", "nativewind"]
---

# Grouped Settings

## Sketch
```
ACCOUNT                      ← section header: caption, muted, uppercase optional
[ Profile              > ]   ← chevron ONLY on rows that push
[ Notifications        > ]
[ Email            a@b.c ]   ← value rows: right-aligned muted value
PREFERENCES
[ Dark mode          (⊙) ]   ← toggle rows: switch, NO chevron
[ Units          Metric > ]
──────
[ Sign out               ]   ← destructive group last, red text, confirm via ActionSheet
[ Delete account         ]
v1.4.2 (build/version info: allowed on a settings screen, banned elsewhere)
```

## Route API
`settings.tsx` pushed from Profile (never a tab). Sub-settings push
(`settings/notifications.tsx`).

## Code sketch
```tsx
<ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
  <SectionHeader>Account</SectionHeader>
  <Group>  {/* iOS: inset-grouped card; Android: full-bleed with hairlines */}
    <SettingsRow label="Profile" onPress={() => router.push("/settings/profile")} />
    <SettingsRow label="Email" value={user.email} />
    <SettingsRow label="Dark mode" control={<Switch value={dark} onValueChange={setDark} />} />
  </Group>
  <Group destructive>
    <SettingsRow label="Sign out" destructive onPress={confirmSignOut} />
  </Group>
</ScrollView>
```
`SettingsRow`: min-height 48, chevron rendered ONLY when the row pushes a screen
(explicit `pushes` prop) - a row can press without pushing (cycle a value, open an
external link) and gets no chevron, per tell #15.

## Platform notes
- iOS: inset-grouped visual (rounded group card on system background); system Switch.
- Android: full-bleed rows, hairline dividers within groups, Material switch; ripple.
- Sign-out confirm: iOS ActionSheet, Android Material dialog (`Alert.alert` acceptable
  here - it IS a destructive confirm).

## Motion variants
Settings is a MOTION 1-2 surface at any app dial. Navigation transitions only.

## Dark mode
Group surfaces use the `surface` token over `background`; verify hairlines visible in dark.

## Anti-patterns
- Flat undifferentiated text list, or every setting its own shadowed card (tell #21).
- Chevron on toggle rows (tell #15). Settings as a tab (tell #25).
- Icon chips in front of every row (tell #4) - settings rows don't need leading icons
  unless the app has 20+ rows needing scannability.

## References
iOS Settings (inset-grouped), Android system settings, Things preferences.
