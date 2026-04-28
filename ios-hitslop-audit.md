# iOS Tap Target Audit — Negative Margin + hitSlop

On iOS, touches outside a parent view's bounds are silently dropped. Negative margins shift elements
outside their parent, shrinking or destroying the effective tap area. `hitSlop` makes it worse by
extending the tap area further into the clipped region.

**Rule:** Never combine a negative margin on (or wrapping) a tappable element with `hitSlop`. Use
`padding` to grow the tap area instead, keeping the element within parent bounds.

---

## Issues Found

### 1. `components/modals/FullScreenModal.tsx`

#### 1a. Close button — negative `marginLeft` + `hitSlop` (partially fixed)

```tsx
// line 107–113
<Pressable
  style={{ marginLeft: -4, padding: 12, borderRadius: 9999 }}
  onPress={onClose}
  hitSlop={12}
>
  <ArrowLeft ... />
</Pressable>
```

**Status:** Improved (was `marginLeft: -8`), but still has `marginLeft: -4`. The left portion of
the tap area (including part of `hitSlop`) is outside the `LinearGradient`'s bounds and will be
clipped on iOS. Remove `marginLeft` entirely, or absorb it into the parent's `paddingHorizontal`.

#### 1b. `headerRight` wrapper — negative `marginRight`

```tsx
// line 121
{
  headerRight ? <View style={{ marginRight: -8 }}>{headerRight}</View> : null;
}
```

**Status:** `headerRight` is often a `Pressable` (e.g. an icon button). Wrapping it in a
`marginRight: -8` View shifts it outside the `LinearGradient`'s right edge, clipping any `hitSlop`
on the child on iOS. Remove the negative margin; adjust visual alignment with parent `paddingRight`
instead.

---

### 2. `components/modals/FoodSearchModal.tsx`

#### 2a. Section header action button — negative margin on `Pressable`, no `hitSlop`

```tsx
// line 201
<Pressable onPress={rightAction.onPress} className="-m-2 p-2">
  <Text ...>{rightAction.label}</Text>
</Pressable>
```

**Status:** `-m-2` shifts this `Pressable` 8px outside its parent on all sides. No `hitSlop` here,
but the negative margin alone shrinks the iOS-visible tap area. Replace `-m-2 p-2` with just `p-2`
(or increase padding further) so the button stays within parent bounds.

#### 2b. Barcode scan button — `hitSlop` with absolute positioning near edge

```tsx
// line 971–978
<Pressable
  className="absolute inset-y-0 right-0 items-center justify-center pr-2"
  onPress={onBarcodeScanPress}
  hitSlop={8}
>
```

**Status:** No negative margin, but the button is absolutely positioned flush to the right edge of
its container. The `hitSlop={8}` extends 8px to the right, outside the container. On iOS this
extended area will be clipped. Either remove `hitSlop` and increase `pr-2` to `pr-4`, or ensure the
parent does not clip overflow.

---

## Summary

| File                  | Line(s) | Element                    | Issue                                       | Priority |
| --------------------- | ------- | -------------------------- | ------------------------------------------- | -------- |
| `FullScreenModal.tsx` | 108     | Close `Pressable`          | `marginLeft: -4` + `hitSlop`                | Medium   |
| `FullScreenModal.tsx` | 121     | `headerRight` wrapper      | `marginRight: -8` wrapping tappable         | High     |
| `FoodSearchModal.tsx` | 201     | Section action `Pressable` | `-m-2` on tappable                          | High     |
| `FoodSearchModal.tsx` | 971     | Barcode scan `Pressable`   | `hitSlop` extends past container right edge | Low      |

## Recommended Fix Pattern

```tsx
// Instead of:
<Pressable style={{ marginLeft: -8 }} hitSlop={10}>...</Pressable>

// Do:
<Pressable style={{ padding: 14 }}>...</Pressable>
// padding expands the tap area from within bounds — always safe on iOS
```
