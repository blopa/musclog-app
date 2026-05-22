import confetti from 'canvas-confetti';
import { useEffect } from 'react';

const ConfettiOverlay = () => {
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:999999';
    document.body.appendChild(canvas);

    const myConfetti = confetti.create(canvas, { resize: true });
    myConfetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.4 },
    });

    return () => {
      myConfetti.reset();
      canvas.remove();
    };
  }, []);

  return null;
};

export default ConfettiOverlay;
