import { Text, View } from 'react-native';

// react-native-vision-camera does not work on web, so the native reps-recording
// test screen (which imports it at module level) cannot be bundled here. This web
// stub keeps the route tree valid so the rest of the app/website still builds.
export default function RepsRecordingScreen() {
  return (
    <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text>Reps recording is only available on native devices.</Text>
    </View>
  );
}
