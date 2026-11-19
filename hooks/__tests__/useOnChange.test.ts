/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { useState } from 'react';

import { useOnChange } from '@/hooks/useOnChange';

describe('useOnChange', () => {
  it('does not fire on the first render', () => {
    const onChange = jest.fn();
    renderHook(() => useOnChange('a', onChange));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('fires once per change with the previous and next value', () => {
    const onChange = jest.fn();
    const { rerender } = renderHook(({ value }) => useOnChange(value, onChange), {
      initialProps: { value: 1 },
    });

    rerender({ value: 1 });
    expect(onChange).not.toHaveBeenCalled();

    rerender({ value: 2 });
    rerender({ value: 2 });
    rerender({ value: 3 });
    expect(onChange.mock.calls).toEqual([
      [1, 2],
      [2, 3],
    ]);
  });

  it('lets the callback set the component state in the same render pass', () => {
    const { result, rerender } = renderHook(
      ({ param }) => {
        const [selected, setSelected] = useState(param);
        useOnChange(param, (_previous, next) => setSelected(next));
        return selected;
      },
      { initialProps: { param: 'monday' } }
    );

    rerender({ param: 'tuesday' });
    expect(result.current).toBe('tuesday');
  });
});
