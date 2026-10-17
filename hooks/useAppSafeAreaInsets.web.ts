import { useSyncExternalStore } from 'react';

const emptyInsets = { top: 0, right: 0, bottom: 0, left: 0 };
let insets = emptyInsets;
const listeners = new Set<() => void>();
let stopMeasuring: (() => void) | undefined;

function startMeasuring() {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)';
  document.body.appendChild(probe);
  const measure = () => {
    const style = getComputedStyle(probe);
    const next = {
      top: parseFloat(style.paddingTop) || 0,
      right: parseFloat(style.paddingRight) || 0,
      bottom: parseFloat(style.paddingBottom) || 0,
      left: parseFloat(style.paddingLeft) || 0,
    };
    if (
      Object.keys(next).some(
        (key) => next[key as keyof typeof next] !== insets[key as keyof typeof insets]
      )
    ) {
      insets = next;
      listeners.forEach((notify) => notify());
    }
  };

  measure();
  window.addEventListener('resize', measure);
  window.visualViewport?.addEventListener('resize', measure);
  return () => {
    window.removeEventListener('resize', measure);
    window.visualViewport?.removeEventListener('resize', measure);
    probe.remove();
  };
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  stopMeasuring ??= startMeasuring();
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      stopMeasuring?.();
      stopMeasuring = undefined;
    }
  };
}

export function useAppSafeAreaInsets() {
  return useSyncExternalStore(
    subscribe,
    () => insets,
    () => emptyInsets
  );
}
