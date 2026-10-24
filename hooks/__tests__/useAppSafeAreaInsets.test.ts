import { act, renderHook } from '@testing-library/react';

import { useAppSafeAreaInsets } from '../useAppSafeAreaInsets.web';

it('reads CSS safe areas, tracks viewport changes, and removes its measuring node', () => {
  const style = jest.spyOn(window, 'getComputedStyle').mockReturnValue({
    paddingTop: '12px',
    paddingRight: '0px',
    paddingBottom: '34px',
    paddingLeft: '0px',
  } as CSSStyleDeclaration);
  const { result, unmount } = renderHook(() => useAppSafeAreaInsets());
  const second = renderHook(() => useAppSafeAreaInsets());
  expect(result.current).toEqual({ top: 12, right: 0, bottom: 34, left: 0 });
  style.mockReturnValue({
    paddingTop: '0px',
    paddingRight: '0px',
    paddingBottom: '0px',
    paddingLeft: '0px',
  } as CSSStyleDeclaration);
  act(() => window.dispatchEvent(new Event('resize')));
  expect(result.current.bottom).toBe(0);
  expect(second.result.current.bottom).toBe(0);
  const probes = document.querySelectorAll('div[style*="visibility: hidden"]').length;
  unmount();
  expect(document.querySelectorAll('div[style*="visibility: hidden"]').length).toBe(probes);
  second.unmount();
  expect(document.querySelectorAll('div[style*="visibility: hidden"]').length).toBe(probes - 1);
  style.mockRestore();
});
