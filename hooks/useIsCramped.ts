import { useWindowDimensions } from 'react-native';

import { isCrampedLayout } from '@/utils/crampedLayout';

/** Whether the layout is cramped for its text, so decoration beside a label should give way. */
export function useIsCramped(): boolean {
  const { width, fontScale } = useWindowDimensions();

  return isCrampedLayout(width, fontScale);
}
