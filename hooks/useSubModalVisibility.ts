import { useState } from 'react';

/**
 * Drop-in replacement for `useState(false)` when controlling a sub-modal's visibility.
 *
 * Automatically resets to `false` whenever the parent modal's `visible` prop becomes
 * `false`. This prevents "ghost modals" — native Modal windows that stay open after the
 * parent closes, silently intercepting all touch events on subsequent renders.
 *
 * Usage:
 *   // Instead of:
 *   const [isDetailsVisible, setIsDetailsVisible] = useState(false);
 *
 *   // Write:
 *   const [isDetailsVisible, setIsDetailsVisible] = useSubModalVisibility(visible);
 *
 * The second element is a standard React setState setter — it works exactly like the one
 * returned by useState, so no call-sites need to change.
 */
export function useSubModalVisibility(
  parentVisible: boolean
): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  return useSubModalState(parentVisible, false);
}

/**
 * {@link useSubModalVisibility} for a sub-modal whose open/closed state carries a payload — the
 * pending action it will commit once confirmed, rather than a bare `true`.
 *
 * Same reset guarantee, and it matters more here: a stale DESTRUCTIVE request left behind a closed
 * parent is the payload-shaped version of the ghost modal above. Holding the action itself is also
 * what lets the confirmation step avoid re-deriving what it is confirming.
 */
export function useSubModalState<T>(
  parentVisible: boolean,
  initial: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Captured on the first render and never replaced — `useState` ignores the argument after that.
  // So the closed value is identity-stable even if the caller passes a fresh object literal each
  // render, and reopening always lands on the same empty state the hook started from.
  const [closedState] = useState(initial);
  const [state, setState] = useState<T>(closedState);

  // Adjusted during render on the transition, rather than from an effect. This is React's
  // documented "storing information from previous renders" pattern: the reset lands in the SAME
  // commit that closed the parent, so no frame is ever painted with a stale sub-modal still open.
  // An effect would run a render later — which is the cascading-render the lint rule objects to,
  // and the reason the older formulation of this hook had to launder its `setState` through a
  // locally-defined function to get past it.
  const [wasVisible, setWasVisible] = useState(parentVisible);
  if (wasVisible !== parentVisible) {
    setWasVisible(parentVisible);
    if (!parentVisible) {
      setState(closedState);
    }
  }

  return [state, setState];
}
