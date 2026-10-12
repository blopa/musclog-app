import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
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
        <Button
          testID="seed-progression"
          label={busy ? 'Preparing fixtures…' : 'Seed progression and review'}
          disabled={busy}
          width="full"
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
        />
        {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      </View>
    </MasterLayout>
  );
}
