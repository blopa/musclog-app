import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MasterLayout } from '@/components/MasterLayout';
import { seedProgressionFlow } from '@/database/seeders/progressionFlow';

export default function ProgressionFlowFixtureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ locale?: string; theme?: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="gap-4 p-6">
        <Text className="text-text-primary">Development progression fixtures</Text>
        <Pressable
          testID="seed-progression"
          accessibilityRole="button"
          disabled={busy}
          className="min-h-12 justify-center rounded-xl bg-accent-primary p-3"
          onPress={async () => {
            setBusy(true);
            try {
              const fixture = await seedProgressionFlow(
                params.locale,
                params.theme === 'light' ? 'light' : 'dark'
              );
              router.replace(`/app/workout/workout-session?workoutLogId=${fixture.logId}`);
            } catch (e) {
              setError(String(e));
              setBusy(false);
            }
          }}
        >
          <Text>{busy ? 'Preparing fixtures…' : 'Seed progression and review'}</Text>
        </Pressable>
        {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      </View>
    </MasterLayout>
  );
}
