import { Redirect } from 'expo-router';
import { useEffect } from 'react';

export default function Index() {
  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    // TODO: check onboarding status and redirect to the appropriate screen instead of always going to /app
  }, []);

  return <Redirect href={__DEV__ ? '/app' : '/home'} />;
}
