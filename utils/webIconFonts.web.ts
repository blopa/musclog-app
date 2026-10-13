import { loadAsync } from 'expo-font';

// On web nothing registers a @font-face for the icon set, so every icon renders as a tofu box
// showing its private-use code point (e.g. "EA 0B"). The family name must be the icon set's
// postScriptName, which is what @react-native-vector-icons uses as the font-family on web.
export function registerWebIconFonts(): void {
  void loadAsync({
    'MaterialIcons-Regular': require('@react-native-vector-icons/material-icons/fonts/MaterialIcons.ttf'),
  }).catch((error) => console.warn('Failed to load icon font:', error));
}
