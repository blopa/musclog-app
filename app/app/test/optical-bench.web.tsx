import { Text, View } from 'react-native';

// The bench imports react-native-vision-camera (and drives a Skia canvas at frame rate), neither
// of which works on web. This stub keeps the route tree valid so the app/website still builds —
// same arrangement as `reps-recording.web.tsx`.
export default function OpticalBenchScreen() {
  return (
    <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 }}>
      {/* TODO: implement it on web too hehe */}
      <Text>The optical transfer bench is only available on native devices.</Text>
    </View>
  );
}
