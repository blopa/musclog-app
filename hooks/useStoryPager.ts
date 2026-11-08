import { useState } from 'react';

type StoryPager = {
  /** The page shown: the position asked for, held inside the pages there are. */
  current: number;
  isFirst: boolean;
  isLast: boolean;
  back: () => void;
  next: () => void;
};

/** The position in a story of `count` pages. A shrinking story never leaves it past the end. */
export function useStoryPager(count: number): StoryPager {
  const [index, setIndex] = useState(0);
  const last = Math.max(count - 1, 0);
  const current = Math.min(index, last);

  return {
    current,
    isFirst: current === 0,
    isLast: current >= last,
    back: () => setIndex(Math.max(0, current - 1)),
    next: () => setIndex(Math.min(last, current + 1)),
  };
}
