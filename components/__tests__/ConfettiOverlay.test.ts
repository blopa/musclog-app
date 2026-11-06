import { Children } from 'react';

import ConfettiOverlay from '@/components/ConfettiOverlay';

jest.mock('react-native-fast-confetti', () => ({ Confetti: 'Confetti' }));

describe('ConfettiOverlay', () => {
  it('drops the confetti entirely under reduced motion, where the library only halves it', () => {
    const overlay = ConfettiOverlay();
    const confetti = Children.only(overlay.props.children);

    expect(confetti.props.reduceMotion).toEqual({ mode: 'system', factor: 1 });
  });

  it('uses gentler gravity for the native animation', () => {
    const overlay = ConfettiOverlay();
    const confetti = Children.only(overlay.props.children);

    expect(confetti).toMatchObject({
      props: {
        autoplay: true,
        gravity: 0.5,
      },
    });
  });
});
