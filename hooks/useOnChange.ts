import { useState } from 'react';

/**
 * Calls `onChange(previous, next)` during render, once, when `value` differs (`Object.is`) from
 * the value of the previous render. `onChange` may set this component's own state: React's
 * "adjust state when a prop changes" pattern, without an effect and its extra render.
 *
 * Its main use is a screen that stays mounted while its inputs change: a tab kept alive while
 * hidden (`utils/tabKeepAlive.ts`) receives new route params, or outlives midnight, without a
 * remount, and must follow the change the way a fresh open would. The first render never calls
 * `onChange`: the initial value is the component's own business (usually its state initializer).
 */
export function useOnChange<T>(value: T, onChange: (previous: T, next: T) => void): void {
  const [seen, setSeen] = useState(value);

  if (!Object.is(seen, value)) {
    setSeen(value);
    onChange(seen, value);
  }
}
