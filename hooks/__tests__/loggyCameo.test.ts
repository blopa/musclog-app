/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { act, Children } from 'react';

import { LoggyCameo } from '@/components/LoggyCameo';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'AnimatedView' },
  ZoomIn: { duration: () => 'zoomIn' },
  FadeOut: { duration: () => 'fadeOut' },
}));
jest.mock('@/components/LoggyPose', () => ({ LoggyPose: 'LoggyPose' }));

/** Renders the cameo as a hook so its state can be read back: the tree it currently returns. */
function renderCameo(props: Parameters<typeof LoggyCameo>[0] = {}) {
  return renderHook(() => LoggyCameo(props));
}

const shownCount = (result: { current: ReturnType<typeof LoggyCameo> }) =>
  Children.toArray(result.current.props.children).length;

describe('LoggyCameo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows Loggy at once and takes him away after a few seconds', () => {
    const { result } = renderCameo();
    expect(shownCount(result)).toBe(1);

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(shownCount(result)).toBe(1);

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(shownCount(result)).toBe(0);
  });

  it('celebrates by default and takes the pose and height it is given', () => {
    const { result } = renderCameo();
    const [defaultCameo] = Children.toArray(result.current.props.children) as any[];
    const [pose] = Children.toArray(defaultCameo.props.children) as any[];
    expect(pose.props).toMatchObject({ pose: 'celebrating', height: 200 });

    const { result: custom } = renderCameo({ pose: 'wave', height: 120 });
    const [customCameo] = Children.toArray(custom.current.props.children) as any[];
    const [customPose] = Children.toArray(customCameo.props.children) as any[];
    expect(customPose.props).toMatchObject({ pose: 'wave', height: 120 });
  });

  it('stands in the upper middle, clear of the bottom edge where tab bars and Save buttons live', () => {
    const { result } = renderCameo({ height: 200 });
    const [cameo] = Children.toArray(result.current.props.children) as any[];

    expect(cameo.props.style).toMatchObject({ top: '40%', marginTop: -100 });
    expect(cameo.props.style).not.toHaveProperty('bottom');
  });

  it('never blocks a touch: the whole overlay ignores pointer events', () => {
    const { result } = renderCameo();

    expect(result.current.props.pointerEvents).toBe('none');
  });

  it('clears its timer when the screen leaves first', () => {
    const { unmount } = renderCameo();
    unmount();

    // A state update after unmount would warn and fail the run; the timer must already be gone.
    expect(() => jest.advanceTimersByTime(5000)).not.toThrow();
    expect(jest.getTimerCount()).toBe(0);
  });
});
