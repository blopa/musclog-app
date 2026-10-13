import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

let mockInServerContext = false;
const mockLoadAsync = jest.fn((_fonts: Record<string, unknown>) => {
  if (!mockInServerContext) {
    throw new Error('expo-font server context accessed outside of withServerContext()');
  }

  return Promise.resolve();
});

jest.mock('expo-font', () => ({
  loadAsync: (fonts: Record<string, unknown>) => mockLoadAsync(fonts),
}));
jest.mock('@/utils/webIconFonts', () => jest.requireActual('@/utils/webIconFonts.web'));
jest.mock('expo-router', () => ({ Slot: () => null }));
jest.mock('expo-splash-screen', () => ({ setOptions: jest.fn(), hideAsync: jest.fn() }));
jest.mock('react-native', () => ({ View: 'div' }));
jest.mock('react-native-css-interop', () => ({
  createInteropElement: jest.requireActual('react').createElement,
}));
jest.mock('react-native-css-interop/jsx-runtime', () => jest.requireActual('react/jsx-runtime'));
jest.mock(
  '@react-native-vector-icons/material-icons/fonts/MaterialIcons.ttf',
  () => 'material.ttf'
);
jest.mock('@/components/DeferredAppBoot', () => ({ DeferredAppBoot: () => null }));
jest.mock('@/hooks/useBootColors', () => ({ useBootColors: () => ({ surfaceCard: '#fff' }) }));
jest.mock('@/utils/bootErrorReporting', () => ({ captureBootException: jest.fn() }));

describe('web icon fonts during static export', () => {
  it('imports the root layout without font loading, then registers fonts for each server render', () => {
    // Manifest generation imports routes before Expo enters its server font context.
    const RootLayout = require('@/app/_layout').default;
    expect(mockLoadAsync).not.toHaveBeenCalled();

    mockInServerContext = true;
    try {
      renderToString(createElement(RootLayout));
      renderToString(createElement(RootLayout));
    } finally {
      mockInServerContext = false;
    }

    expect(mockLoadAsync).toHaveBeenCalledTimes(2);
    expect(mockLoadAsync).toHaveBeenCalledWith({
      'MaterialIcons-Regular': require('@react-native-vector-icons/material-icons/fonts/MaterialIcons.ttf'),
    });
  });

  it('does not load web fonts on native', () => {
    mockLoadAsync.mockClear();
    jest.requireActual('@/utils/webIconFonts').registerWebIconFonts();
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });
});
