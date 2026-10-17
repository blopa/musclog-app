import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Native insets come from the window; the web implementation reads CSS environment values. */
export function useAppSafeAreaInsets() {
  return useSafeAreaInsets();
}
