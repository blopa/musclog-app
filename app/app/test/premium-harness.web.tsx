import { Text, View } from 'react-native';

// The native harness imports secure storage and the RevenueCat SDK; none of it exists on web.
export default function PremiumHarnessScreen() {
  return (
    <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text>Premium harness is not available on web.</Text>
    </View>
  );
}
