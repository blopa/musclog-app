# Forms

Use this for login, signup, checkout, settings, profile editing, search filters, creation flows, payment, and any mobile input-heavy screen.

## Form Principles

- Group fields by user mental model, not database schema.
- Keep labels visible; placeholders are examples, not labels.
- Validate early enough to help, late enough to avoid scolding.
- Preserve user input on error, retry, navigation, and app backgrounding when possible.
- Make the submit state explicit: available, disabled, loading, success, error.
- Design for keyboard, autofill, password managers, and large text from the start.

## Anatomy

Recommended field block:

```tsx
// passwordRef points at the next field. returnKeyType only relabels the
// return key; onSubmitEditing is what actually advances focus.
<View style={styles.field}>
  <Text style={styles.label}>Email</Text>
  <TextInput
    value={email}
    onChangeText={setEmail}
    keyboardType="email-address"
    autoCapitalize="none"
    autoComplete="email"
    textContentType="emailAddress"
    returnKeyType="next"
    submitBehavior="submit"
    onSubmitEditing={() => passwordRef.current?.focus()}
    accessibilityLabel="Email"
    accessibilityHint="Enter the email address for your account"
    style={[styles.input, emailError && styles.inputError]}
  />
  {emailError ? (
    // Live region covers Android. announceForAccessibility (below) covers iOS.
    <Text accessibilityLiveRegion="polite" style={styles.error}>
      {emailError}
    </Text>
  ) : (
    <Text style={styles.helper}>Use the email where you receive receipts.</Text>
  )}
</View>
```

On iOS, `accessibilityLiveRegion` is a no-op, so announce validation results explicitly when they arrive:

```tsx
import { AccessibilityInfo, Platform } from 'react-native';

useEffect(() => {
  if (emailError && Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibility(emailError);
  }
}, [emailError]);
```

## Input Prop Defaults

| Field | Key props |
| --- | --- |
| Email | `keyboardType="email-address"`, `autoCapitalize="none"`, `autoComplete="email"`, `textContentType="emailAddress"` |
| Password | `secureTextEntry`, `autoComplete="current-password"` or `"new-password"`; pair iOS with `textContentType="password"` or `"newPassword"` |
| Phone | `keyboardType="phone-pad"`, `autoComplete="tel"`, region-aware formatting; do not rely on Return to advance on iOS |
| Number | `keyboardType="number-pad"` or `"decimal-pad"`, validate locale/decimal rules |
| Name | `autoComplete="name"`, avoid disabling autocorrect unnecessarily |
| Address | platform autofill fields, multiline only where useful |
| Search | `returnKeyType="search"`, clear button, recent/empty state |
| One-time code | `keyboardType="number-pad"`, `textContentType="oneTimeCode"` (iOS), `autoComplete="sms-otp"` (Android), paste support |

Always check current React Native and platform docs when using newly added autofill values.

## Focus Flow

- `returnKeyType="next"` only relabels the return key. Advance focus with `onSubmitEditing={() => nextRef.current?.focus()}` plus `submitBehavior="submit"` (older RN: `blurOnSubmit={false}`).
- Final field uses `returnKeyType="done"`, `"go"`, `"send"`, or `"search"` based on task.
- On iOS, `keyboardType="phone-pad"` does not fire `onSubmitEditing`. Provide a visible next/continue action or an input accessory control when the user must advance.
- Move focus programmatically only when it helps.
- Scroll the focused input above the keyboard.
- Do not hide the submit button behind the keyboard unless the keyboard submit path is clear.

## Validation

Use three layers:

1. Formatting constraints while typing only when they prevent impossible input.
2. Inline validation on blur or after first submit attempt.
3. Server validation after submit with field-specific messages where possible.

Avoid:

- Red errors before the user has had a chance to finish.
- Clearing fields after a failed submit.
- Generic `Something went wrong` when a field can be identified.
- Disabled submit with no explanation.

## Submit Button

Submit state must communicate:

```tsx
const isUnavailable = !canSubmit || isSubmitting;

<Pressable
  accessibilityRole="button"
  accessibilityState={{ disabled: isUnavailable, busy: isSubmitting }}
  disabled={isUnavailable}
  onPress={submit}
  style={({ pressed }) => [
    styles.submit,
    pressed && !isUnavailable && styles.submitPressed,
    isUnavailable && styles.submitDisabled,
  ]}
>
  <Text style={styles.submitLabel}>
    {isSubmitting ? 'Saving' : 'Save changes'}
  </Text>
</Pressable>
```

Rules:

- Use task-specific labels: `Pay $42.18`, `Create account`, `Save address`.
- Show progress for async submit.
- Prevent duplicate submit.
- On success, either navigate with continuity or show a short confirmation.
- On failure, preserve data and offer retry.

## Checkout Forms

Checkout needs extra trust and recovery:

- Show total cost and what changes it.
- Make shipping, payment, promo, and contact info editable.
- Use native payment sheets when available and appropriate.
- Keep destructive or irreversible actions explicit.
- Show processing state that prevents double payment.
- Preserve cart and entered fields after payment errors.

## Auth Forms

- Support password managers and autofill.
- Do not block paste into password or one-time-code fields.
- Avoid revealing whether an email exists unless product/security policy allows it.
- Rate-limit and error-copy should be calm and specific enough to recover.
- Use secure storage only after successful auth.

## Search and Filter Forms

- Search should show recent, suggested, empty, loading, and no-results states.
- Filters need clear applied state and reset.
- Avoid hiding active filters behind a collapsed sheet without a visible count.
- Submit-on-change is good for small local filters; explicit apply is better for expensive remote filters.

## Form QA

- Keyboard does not cover focused field or primary action.
- Return key flow works: verify on device/simulator that the next-field key advances focus (not just that `returnKeyType` is set).
- Autofill/password manager works.
- Large text does not clip labels/errors.
- VoiceOver/TalkBack reads label, value, error, and state.
- Offline/server error preserves input.
- Submit cannot be triggered twice accidentally.
- Sensitive values are handled securely.
