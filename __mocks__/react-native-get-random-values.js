// Manual mock for `react-native-get-random-values` — a native polyfill that installs
// `global.crypto.getRandomValues` on React Native, where it is missing. It reaches for
// NativeModules at import time, which throws under Jest. Both test environments already
// provide a real `crypto.getRandomValues`, so importing it is simply a no-op here.

module.exports = {};
