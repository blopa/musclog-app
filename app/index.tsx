import { Redirect } from 'expo-router';
import { Platform } from 'react-native';

export default function Index() {
  return <Redirect href={Platform.OS === 'web' && !__DEV__ ? '/home' : '/app'} />;
}
