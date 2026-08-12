import { Children } from 'react';

import ConfettiOverlay from '@/components/ConfettiOverlay';

jest.mock('react-native-fast-confetti', () => ({ Confetti: 'Confetti' }));

describe('ConfettiOverlay', () => {
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
