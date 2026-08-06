// Manual mock for `react-native-safe-area-context`. Its native spec imports
// `react-native/Libraries/Utilities/codegenNativeComponent` — a deep path that reaches the
// real React Native package and its missing native bridge — so the real module cannot load
// under Jest. Insets are irrelevant to the logic under test; report a zero-inset screen.

const insets = { bottom: 0, left: 0, right: 0, top: 0 };
const frame = { height: 844, width: 390, x: 0, y: 0 };
const passthrough = ({ children }) => children ?? null;

module.exports = {
  initialWindowMetrics: { frame, insets },
  SafeAreaFrameContext: { Consumer: passthrough, Provider: passthrough },
  SafeAreaInsetsContext: { Consumer: passthrough, Provider: passthrough },
  SafeAreaProvider: passthrough,
  SafeAreaView: passthrough,
  useSafeAreaFrame: () => frame,
  useSafeAreaInsets: () => insets,
};
