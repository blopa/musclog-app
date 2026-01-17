import { View } from 'react-native';
import { forwardRef, useImperativeHandle, useState, useEffect, ReactNode } from 'react';
import type { PagerViewRef } from './types';

export interface PagerViewProps {
  children: ReactNode;
  initialPage?: number;
  onPageSelected?: (e: { nativeEvent: { position: number } }) => void;
  scrollEnabled?: boolean;
  overdrag?: boolean;
  style?: any;
}

export type { PagerViewRef };

export const PagerView = forwardRef<PagerViewRef, PagerViewProps>(
  ({ children, initialPage = 0, onPageSelected, style }, ref) => {
    const [currentPage, setCurrentPage] = useState(initialPage);

    useImperativeHandle(ref, () => ({
      setPage: (page: number) => {
        setCurrentPage(page);
        // Call onPageSelected callback to sync state
        if (onPageSelected) {
          onPageSelected({ nativeEvent: { position: page } });
        }
      },
    }));

    // Call onPageSelected when currentPage changes (for initial page)
    useEffect(() => {
      if (onPageSelected && currentPage === initialPage) {
        onPageSelected({ nativeEvent: { position: currentPage } });
      }
    }, [currentPage, initialPage, onPageSelected]);

    // On web, just render the current page's child
    // This means swiping won't work on web, but buttons will still work
    const childrenArray = Array.isArray(children) ? children : [children];
    const currentChild = childrenArray[currentPage] || childrenArray[0];

    return <View style={style}>{currentChild}</View>;
  }
);
