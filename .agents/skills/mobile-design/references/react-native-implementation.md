# React Native Implementation

Use this reference for concrete React Native and Expo implementation. For SwiftUI or Jetpack Compose code, inspect the native project and current framework documentation first; do not translate React Native props or Expo modules directly into native APIs.

Use this for React Native and Expo component architecture, tokens, state coverage, lists, images, storage, forms, package checks, and implementation review.

## Inspect Before Importing

Before adding imports:

- Check `package.json`.
- Match the repo's existing routing, styling, state, animation, and icon systems.
- Use `npx expo install` for Expo SDK-managed packages.
- Do not add a UI library when local primitives already solve the task.

## Component Architecture

Keep structure practical:

- Primitive components: Button, Text, Icon, Input, Avatar, Divider.
- Composed components: ListRow, ProductCard, SearchBar, FormField.
- Screen sections: Header, Feed, FilterSheet, CheckoutSummary.
- Containers/screens: data fetching, permissions, navigation, async state.

Atomic Design is useful vocabulary, not a law. Do not split components just to satisfy a taxonomy. Split when it improves reuse, testing, readability, or state ownership.

## State Completeness

Every user-facing workflow should handle:

- Default.
- Pressed/focused.
- Loading/submitting.
- Disabled/unavailable.
- Success.
- Error with recovery.
- Empty state when no data exists.
- Permission denied where relevant.
- Offline/slow network where relevant.

Container example:

```tsx
function ProductListScreen() {
  const { data, isLoading, error, refetch } = useProducts();

  if (isLoading) return <ProductListSkeleton />;
  if (error) return <ErrorState message="Products did not load" onRetry={refetch} />;
  if (!data?.length) return <EmptyState title="No products yet" actionLabel="Browse catalog" />;

  return <ProductList products={data} onRefresh={refetch} />;
}
```

## Design Tokens

Prefer tokens over one-off values:

```ts
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
};
```

Use a 4pt rhythm for most spacing. Small exceptions are fine for optical alignment when deliberate.

## Buttons and Controls

Use `Pressable` for most custom controls:

```tsx
const isUnavailable = disabled || loading;

<Pressable
  accessibilityRole="button"
  accessibilityLabel={label}
  accessibilityState={{ disabled: isUnavailable, busy: loading }}
  disabled={isUnavailable}
  style={({ pressed }) => [
    styles.button,
    pressed && !isUnavailable && styles.buttonPressed,
    isUnavailable && styles.buttonDisabled,
  ]}
  onPress={onPress}
>
  {loading ? <ActivityIndicator /> : <Text style={styles.label}>{label}</Text>}
</Pressable>
```

Do not wrap every button in Gesture Handler/Reanimated unless interaction complexity requires it.

## Component Contracts

When creating or changing a reusable primitive, document its purpose, anatomy, variants, and supported states before adding props. Keep variant names semantic (`primary`, `danger`, `quiet`) rather than visual (`blue`, `rounded`).

Every interactive component needs a tested contract for default, pressed, focused, disabled, loading, selected/checked when applicable, error, accessible name/role/state, and long or scaled text. Prefer composition and local primitives over boolean-prop accumulation or a new UI library.

## Lists

Use `FlatList` or a measured alternative for long lists. Use `ScrollView` only for small bounded content.

```tsx
const renderItem = ({ item }: { item: Product }) => (
  <ProductRow product={item} />
);

<FlatList
  data={products}
  keyExtractor={(item) => item.id}
  renderItem={renderItem}
  ListEmptyComponent={<EmptyState title="No results" />}
  onRefresh={refetch}
  refreshing={isRefreshing}
/>
```

Performance guidance:

- `getItemLayout` helps fixed-height rows; do not fake it for variable-height content.
- `removeClippedSubviews` may improve large-list performance but can cause missing content; use with testing.
- Memoize list rows when parent rerenders are causing measurable cost.
- Use stable callbacks for memoized children.
- Consider FlashList for very large or image-heavy lists after checking installed packages and measuring.
- Avoid heavy shadows, blur, and infinite animations inside long lists.

## Images

For Expo, prefer `expo-image` when available:

- Disk/memory caching.
- BlurHash/ThumbHash placeholders.
- Content fit/position.
- Transitions without flicker.

Always set dimensions or aspect ratio to avoid layout shift.

```tsx
<Image
  source={{ uri: imageUrl }}
  placeholder={{ blurhash }}
  placeholderContentFit="cover"
  contentFit="cover"
  transition={180}
  style={{ width: '100%', aspectRatio: 16 / 9 }}
  accessibilityLabel={description}
/>
```

## Storage

Use the least risky storage:

| Data | Storage |
| --- | --- |
| Auth tokens/secrets | `expo-secure-store`, Keychain/Keystore-backed solution |
| Preferences/UI settings | AsyncStorage or local settings store |
| Structured local app data | SQLite/MMKV/WatermelonDB depending on needs |
| Cache | query/cache library or filesystem cache |

Do not treat secure storage as an irreplaceable backup; platform behavior differs across uninstall/reinstall and biometric changes.

## Styling

Match the repo:

- StyleSheet, NativeWind, Tamagui, Restyle, Paper, Gluestack, or custom tokens.
- Do not mix UI libraries without a clear boundary.
- Centralize tokens.
- Audit dark mode, long strings, large fonts, and RTL if relevant.

## Implementation QA

- Package imports exist.
- TypeScript passes if present.
- Touch targets and labels are correct.
- Loading/error/empty/disabled states are implemented.
- Lists use stable keys and appropriate virtualization.
- Images have dimensions and loading/error behavior.
- Secrets are not stored in AsyncStorage.
- Platform divergences use clear `Platform.select` or separate components.
