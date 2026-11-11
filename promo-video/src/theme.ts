import { loadFont } from '@remotion/google-fonts/Manrope';

// Manrope is the face of the Play listing screenshots and the banner.
export const { fontFamily: FONT } = loadFont('normal', {
  weights: ['500', '600', '700', '800'],
  subsets: ['latin'],
});

// kinetic-depth, the app's default dark theme (theme.registry.js).
export const C = {
  base: '#0d1210',
  card: '#171c19',
  tint: '#0c2419',
  text: '#dce5de',
  textSecondary: '#a3ada9',
  brand: '#29a577',
  brandVivid: '#10b981',
  brandBright: '#34d399',
  brandPale: '#a7f3d0',
  brandSurface: '#064e3b',
  hairline: 'rgba(220, 229, 222, 0.12)',
};

export const FPS = 30;
// The music runs at 120 BPM, so a bar is exactly two seconds.
export const BAR = 60;
