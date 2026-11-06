import { Children } from 'react';

import ConfettiOverlay from '@/components/ConfettiOverlay';

jest.mock('react-native-fast-confetti', () => ({ Confetti: 'Confetti' }));
// Reanimated is ESM-only and the cameo is not under test here; its own suite covers the timing.
jest.mock('@/components/LoggyCameo', () => ({ LoggyCameo: 'LoggyCameo' }));

describe('ConfettiOverlay', () => {
  it('drops the confetti entirely under reduced motion, where the library only halves it', () => {
    const overlay = ConfettiOverlay({});
    const [confetti] = Children.toArray(overlay.props.children) as any[];

    expect(confetti.props.reduceMotion).toEqual({ mode: 'system', factor: 1 });
  });

  it('uses gentler gravity for the native animation', () => {
    const overlay = ConfettiOverlay({});
    const [confetti] = Children.toArray(overlay.props.children) as any[];

    expect(confetti).toMatchObject({
      props: {
        autoplay: true,
        gravity: 0.5,
      },
    });
  });

  it('brings Loggy with the confetti by default, because confetti is only for firsts', () => {
    const children = Children.toArray(ConfettiOverlay({}).props.children) as any[];

    expect(children.map((child) => child.type)).toEqual(['Confetti', 'LoggyCameo']);
  });

  it('leaves Loggy out for a screen that already shows him', () => {
    const children = Children.toArray(
      ConfettiOverlay({ withLoggy: false }).props.children
    ) as any[];

    expect(children.map((child) => child.type)).toEqual(['Confetti']);
  });
});
