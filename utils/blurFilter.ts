import { Platform } from 'react-native';

/**
 * Returns a cross-platform `filter` style object that blurs the element.
 * - Web:            CSS string `filter: 'blur(Npx)'`
 * - iOS / Android:  RN array  `filter: [{ blur: N }]`
 */
export const blurFilter = (px: number): object =>
  Platform.OS === 'web' ? { filter: `blur(${px}px)` } : { filter: [{ blur: px }] };
