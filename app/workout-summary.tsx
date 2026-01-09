import React from 'react';
import { WorkoutSummaryCelebration } from '../components/WorkoutSummaryCelebration';
import { useRouter } from 'expo-router';

export default function WorkoutSummaryScreen() {
  const router = useRouter();

  const handleGoHome = () => {
    router.replace('/');
  };

  const handleShareSummary = () => {
    // TODO: Implement share functionality
    console.log('Share summary');
  };

  return (
    <WorkoutSummaryCelebration
      visible={true}
      onClose={() => router.back()}
      onGoHome={handleGoHome}
      onShareSummary={handleShareSummary}
      totalTime="45m"
      volume="12,450 kg"
      personalRecords={2}
    />
  );
}
