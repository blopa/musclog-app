import confetti from 'canvas-confetti';
import React, { useEffect } from 'react';

const ConfettiOverlay = () => {
  useEffect(() => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.4 },
    });

    return () => {
      confetti.reset();
    };
  }, []);

  return null;
};

export default ConfettiOverlay;
