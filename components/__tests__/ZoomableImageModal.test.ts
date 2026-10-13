import React from 'react';
import { Image } from 'react-native';
import { ZoomableImageModal } from '@/components/ZoomableImageModal';

const mockGestures: Record<string, any> = {};
const mockStyles: (() => any)[] = [];
jest.mock('react-native-gesture-handler', () => {
  const gesture = (kind: string) => {
    const handlers: Record<string, any> = {};
    const builder: any = {};
    for (const method of ['onStart', 'onUpdate', 'onEnd', 'maxPointers', 'numberOfTaps']) {
      builder[method] = (callback: any) => {
        handlers[method] = callback;
        return builder;
      };
    }
    mockGestures[kind] = handlers;
    return builder;
  };
  return {
    Gesture: {
      Pinch: () => gesture('pinch'),
      Pan: () => gesture('pan'),
      Tap: () => gesture('tap'),
      Exclusive: jest.fn(),
      Simultaneous: jest.fn(),
    },
    GestureDetector: 'GestureDetector',
    GestureHandlerRootView: 'GestureHandlerRootView',
  };
});
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'AnimatedView' },
  useSharedValue: (value: number) => ({
    value,
    set(next: number) {
      this.value = next;
    },
  }),
  useAnimatedStyle: (callback: () => any) => {
    mockStyles.push(callback);
    return callback();
  },
  runOnJS: (callback: unknown) => callback,
  withSpring: (value: number) => value,
  withTiming: (value: number) => value,
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/context/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar: jest.fn() }),
}));
jest.mock('@/utils/shareImage', () => ({ shareImage: jest.fn() }));
jest.mock('@/components/theme/IconButton', () => ({ IconButton: 'IconButton' }));
function stage(node: any): any {
  if (!node) return null;
  if (node.props?.onLayout) return node;
  return React.Children.toArray(node.props?.children).map(stage).find(Boolean);
}
beforeEach(() => {
  mockStyles.length = 0;
  jest.spyOn(React, 'useState').mockImplementation((initial: any) => [initial, jest.fn()] as any);
  jest.spyOn(React, 'useEffect').mockImplementation((effect) => {
    effect();
  });
});
afterEach(() => jest.restoreAllMocks());
it.each([
  { image: { width: 4000, height: 1000 }, x: 300, y: 0 },
  { image: { width: 1000, height: 4000 }, x: 50, y: 600 },
])('clamps gestures to fitted image bounds: $image', ({ image, x, y }) => {
  jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => {
    success(image.width, image.height);
  });
  const tree = ZoomableImageModal({ visible: true, uri: 'image', onClose: jest.fn() });
  stage(tree).props.onLayout({ nativeEvent: { layout: { width: 400, height: 800 } } });
  mockGestures.pinch.onStart();
  mockGestures.pinch.onUpdate({ scale: 2.5, focalX: 200, focalY: 400 });
  mockGestures.pan.onStart();
  mockGestures.pan.onUpdate({ translationX: 600, translationY: 600 });
  expect(mockStyles[0]().transform).toEqual([{ translateX: x }, { translateY: y }, { scale: 2.5 }]);
});
