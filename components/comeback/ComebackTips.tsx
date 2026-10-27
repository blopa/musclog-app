import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useCoach } from '@/components/CoachContext';
import { ListRow } from '@/components/theme/ListRow';
import { TRACK_MEAL } from '@/constants/chat';
import { useSmartCamera } from '@/context/SmartCameraContext';
import { useSettings } from '@/hooks/useSettings';
import {
  comebackRecommendations,
  type ComebackTip,
  type ComebackTipAction,
} from '@/utils/comeback/comebackRecommendations';
import type { ComebackAnswers } from '@/utils/comeback/comebackState';

const FOOD_ROUTE = '/app/nutrition/food';

/**
 * Tailored "how to keep logging" tips for the way the person eats. Every tip that opens something
 * is built from what is actually set up — an AI tip never appears as a button that dead-ends — and
 * there is always a tip that needs no AI at all.
 */
export function ComebackTips({ answers }: { answers: ComebackAnswers }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { openCamera } = useSmartCamera();
  const { openCoach } = useCoach();
  const { isAiConfigured, isAiMealPhotoEnabled, aiProvider } = useSettings();

  const tips = comebackRecommendations(answers, {
    isAiConfigured,
    isAiMealPhotoEnabled,
    aiProvider,
  });
  const act = (action: ComebackTipAction) => {
    switch (action) {
      case 'smartCameraMeal':
        openCamera({ mode: 'ai-meal-photo' });
        break;
      case 'coachTrackMeal':
        openCoach({ intention: TRACK_MEAL });
        break;
      case 'barcodeScan':
        openCamera({ mode: 'barcode-scan', showBarcodeTextSearch: true });
        break;
      case 'myMeals':
      case 'copyDay':
        router.push(FOOD_ROUTE);
        break;
      case 'aiSettings':
        router.navigate('/app/settings');
        break;
      case 'none':
        break;
    }
  };

  if (tips.length === 0) {
    return null;
  }

  return (
    <View className="gap-2" testID="comeback-tips">
      {tips.map((tip: ComebackTip) => (
        <View
          key={tip.id}
          className="gap-1 rounded-control border border-border-light bg-bg-card p-3"
        >
          <Text className="text-sm font-semibold text-text-primary">{t(tip.titleKey)}</Text>
          <Text className="text-sm text-text-secondary">{t(tip.descriptionKey)}</Text>
          {tip.action !== 'none' && tip.actionLabelKey ? (
            <ListRow
              title={t(tip.actionLabelKey)}
              onPress={() => act(tip.action)}
              testID={`comeback-tip-${tip.id}`}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}
