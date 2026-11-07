import type { ComponentProps } from 'react';
import { Text } from 'react-native';

import { useMeasuredWidth } from '@/hooks/useMeasuredWidth';
import { fitLabelFontSize } from '@/utils/fitText';

type Props = Omit<ComponentProps<typeof Text>, 'children' | 'style'> & {
  children: string;
  /** The size the class asks for. Used whenever the longest word already fits the width. */
  size: number;
  /** The smallest size worth drawing; below it a word overflows rather than shrinks further. */
  minSize: number;
};

/**
 * Text whose size drops only when its longest word would otherwise break across lines. A
 * compound such as "Oefeningsbeperkingen" cannot wrap, so the width it is given decides the size.
 * The width is measured after layout, so the first frame draws `size` and the correction follows.
 */
export function WhatsNewText({ children, size, minSize, ...props }: Props) {
  const { width, fontScale, onLayout } = useMeasuredWidth();
  const fontSize = fitLabelFontSize(children, width, { maxSize: size, minSize, fontScale });

  return (
    <Text {...props} onLayout={onLayout} style={{ fontSize }}>
      {children}
    </Text>
  );
}
