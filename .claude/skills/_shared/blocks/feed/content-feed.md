---
name: content-feed
category: feed
dial_compatibility:
  expression: [3, 9]
  motion: [2, 6]
  density: [3, 7]
platforms: [ios, android, web]
when_to_use: "Any scrolling list of user or content items: social feed, inbox, order history, search results."
not_for: "Short fixed lists (< ~15 known items) - plain ScrollView is fine there."
stack: ["expo-router", "nativewind", "flash-list", "expo-image"]
---

# Content Feed

## Sketch
```
[ header (navigator-owned) ]
[ item                     ]   full-bleed rows OR cards - pick by content type:
[ item                     ]   media-led items → cards; text/utility rows → full-bleed
[ item                     ]   with hairline separators. Never card-wrap text rows.
  ... RefreshControl, skeleton first-load, empty state, error+retry, offline banner
```

## Props/route API
`<Feed query={...} renderItem={...} emptyAction={{label, onPress}} />` - the five states
are the component's contract, not the caller's.

## Code sketch
```tsx
const { data, isLoading, isError, refetch, isRefetching } = useFeed();

if (isLoading) return <FeedSkeleton />;              // mirrors real row shapes
if (isError)   return <ErrorState onRetry={refetch} />;
if (!data.length) return <EmptyState action={emptyAction} />; // centered is correct HERE

<FlashList
  data={data}
  keyExtractor={(item) => item.id}
  renderItem={({ item, index }) => <Row item={item} index={index} />}
  refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
  contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
  onEndReached={fetchNextPage}
  onEndReachedThreshold={0.5}
/>

// Row: memoized; expo-image with recyclingKey + blurhash; numberOfLines on all text.
const Row = memo(function Row({ item }: { item: Item }) {
  return (
    <PressableScale onPress={() => router.push(`/post/${item.id}`)} className="min-h-[72px] flex-row items-center gap-3 px-5">
      <Image source={item.avatar} placeholder={{ blurhash: item.blurhash }} recyclingKey={item.id} style={{ width: 44, height: 44, borderRadius: 22 }} />
      <View className="flex-1">
        <Text className="text-body font-medium" numberOfLines={1}>{item.title}</Text>
        <Text className="text-caption text-muted" numberOfLines={2}>{item.excerpt}</Text>
      </View>
    </PressableScale>
  );
});
```

## Platform notes
- Android: `android_ripple` bounded to the row at EXPRESSION <= 5.
- Web: verify FlashList web support (versions.md); constrain content width ~640px.

## Motion variants
- MOTION 1-3: none. 4-6: first-mount stagger on first ~6 rows (index-guarded,
  skeletons.md #5); `itemLayoutAnimation` for insert/remove.
- Reduced motion: instant.

## Dark mode
Separator = hairline of `border` token; never hardcoded `#eee`.

## Anti-patterns
- ScrollView-of-map (tell #13). Card-wrapping text rows (tell #3). Chevron on every row
  (tell #15). Spinner-only first load (tell #37). Missing empty/error/offline (tell #38).
- Entrance animations replaying in recycled cells (skeletons.md #5).

## References
Apple Mail (full-bleed + hairlines), Airbnb Explore (media cards), Linear inbox.
