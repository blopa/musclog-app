import { forwardRef } from 'react';
import * as RNPagerView from 'react-native-pager-view';

import type { PagerViewRef } from './types';

export type PagerViewProps = RNPagerView.PagerViewProps;

export type { PagerViewRef };

export const PagerView = forwardRef<PagerViewRef, PagerViewProps>((props, ref) => {
  // Cast the native ref to our shared interface type
  return <RNPagerView.default ref={ref as any} {...props} />;
});
