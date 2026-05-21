import confetti from 'canvas-confetti';
import React, { useEffect } from 'react';

interface ConfettiOverlayProps {
  onAnimationEnd: () => void;
}

const ConfettiOverlay = ({ onAnimationEnd }: ConfettiOverlayProps) => {
  useEffect(() => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.4 },
    });

    const timer = setTimeout(onAnimationEnd, 3000);
    return () => {
      clearTimeout(timer);
      confetti.reset();
    };
  }, [onAnimationEnd]);

  return null;
};

export default ConfettiOverlay;
