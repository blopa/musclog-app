import { useCallback, useState } from 'react';
import { type LayoutChangeEvent, useWindowDimensions } from 'react-native';

/**
 * What every text-fitting component needs to size its text to the room it got (`utils/fitText.ts`):
 * the width of the box once it has been laid out (`null` on the first frame, which the fitting
 * functions treat as "draw the design") and the OS text scale. Spread `onLayout` onto the box.
 */
export function useMeasuredWidth() {
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState<number | null>(null);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width),
    []
  );

  return { width, fontScale, onLayout };
}
