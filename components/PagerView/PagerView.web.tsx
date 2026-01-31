import { animated, config, useSpring } from '@react-spring/web';
import { forwardRef, ReactNode, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';

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
    const previousPageRef = useRef(initialPage);
    const childrenArray = Array.isArray(children) ? children : [children];
    const totalPages = childrenArray.length;

    // Calculate the percentage to translate based on page index and total pages
    const getTranslateX = (pageIndex: number) => -(pageIndex * (100 / totalPages));

    // Animate the translateX transform based on current page
    const [springProps, api] = useSpring(() => ({
      x: getTranslateX(initialPage),
      config: config.gentle,
      onRest: () => {
        // Call onPageSelected after animation completes
        if (onPageSelected && currentPage !== previousPageRef.current) {
          onPageSelected({ nativeEvent: { position: currentPage } });
        }
        previousPageRef.current = currentPage;
      },
    }));

    // Update animation when currentPage changes
    useEffect(() => {
      const translateX = getTranslateX(currentPage);
      api.start({
        x: translateX,
        config: config.gentle,
      });
    }, [currentPage, api, totalPages, getTranslateX]);

    useImperativeHandle(ref, () => ({
      setPage: (page: number) => {
        const validPage = Math.max(0, Math.min(page, totalPages - 1));
        if (validPage !== currentPage) {
          setCurrentPage(validPage);
        }
      },
    }));

    // Call onPageSelected when currentPage changes (for initial page)
    useEffect(() => {
      if (
        onPageSelected &&
        currentPage === initialPage &&
        currentPage === previousPageRef.current
      ) {
        onPageSelected({ nativeEvent: { position: currentPage } });
      }
    }, [currentPage, initialPage, onPageSelected]);

    // Use animated.div for web compatibility with react-spring
    const AnimatedDiv = animated.div;

    return (
      <View
        style={[
          style,
          {
            overflow: 'hidden',
            position: 'relative',
          },
        ]}
      >
        <AnimatedDiv
          style={{
            display: 'flex',
            flexDirection: 'row',
            width: `${totalPages * 100}%`,
            transform: springProps.x.to((x) => `translateX(${x}%)`),
          }}
        >
          {childrenArray.map((child, index) => (
            <View
              key={index}
              style={{
                width: `${100 / totalPages}%`,
                flexShrink: 0,
              }}
            >
              {child}
            </View>
          ))}
        </AnimatedDiv>
      </View>
    );
  }
);
