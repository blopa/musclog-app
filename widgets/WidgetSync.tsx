import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { widgetsDirectory } from 'expo-widgets';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform } from 'react-native';

import { useThemeContext } from '@/context/ThemeContext';
import { waitForDbReady } from '@/database/dbReady';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { NutritionService } from '@/database/services/NutritionService';
import { NutritionTargetService } from '@/database/services/NutritionTargetService';
import { useLocalToday } from '@/hooks/useLocalToday';
import { useSettings } from '@/hooks/useSettings';
import { handleError } from '@/utils/handleError';
import { widgetEvents } from '@/utils/widgetEvents';

import NutritionWidget from './NutritionWidget';
import SmartCameraWidget from './SmartCameraWidget';
import { createWidgetRefreshQueue } from './widgetRefreshQueue';
import {
  buildNutritionWidgetSnapshot,
  CAMERA_WIDGET_URL,
  expiredWidgetSnapshot,
  widgetPalette,
} from './widgetSnapshot';

let cameraImage: Promise<string | null> | undefined;

function sharedCameraImage(): Promise<string | null> {
  cameraImage ??= (async () => {
    if (!widgetsDirectory) {
      return null;
    }

    const asset = await Asset.fromModule(require('../assets/camera-widget.png')).downloadAsync();
    const destination = new File(widgetsDirectory, 'smart-camera.png');
    if (!destination.exists && asset.localUri) {
      new File(asset.localUri).copy(destination);
    }

    return destination.exists ? destination.uri : null;
  })().catch((error) => {
    cameraImage = undefined;
    void handleError(error, 'widgets.cameraArtwork', { showSnackbar: false });
    return null;
  });

  return cameraImage;
}

export function WidgetSync() {
  const { theme } = useThemeContext();
  const { isLoading } = useSettings();
  const { i18n, t } = useTranslation();
  const today = useLocalToday();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const palette = widgetPalette(theme.colors);
    const queue = createWidgetRefreshQueue(
      async () => {
        await waitForDbReady();
        const date = new Date();
        const [nutrients, goal, imageUri] = await Promise.all([
          NutritionService.getDailyNutrients(date),
          NutritionGoalService.getGoalForDate(date),
          sharedCameraImage(),
        ]);
        const resolved = goal ? ((await NutritionTargetService.resolve(goal, date)) ?? goal) : null;
        return {
          date,
          nutrition: buildNutritionWidgetSnapshot({
            date,
            nutrients,
            goal: resolved,
            palette,
            locale,
            translate: (key) => t(key),
          }),
          camera: { label: t('widgets.smartCamera'), palette, imageUri, url: CAMERA_WIDGET_URL },
        };
      },
      ({ date, nutrition, camera }) => {
        SmartCameraWidget.updateSnapshot(camera);
        if (Platform.OS === 'ios') {
          const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
          NutritionWidget.updateTimeline([
            { date, props: nutrition },
            { date: midnight, props: expiredWidgetSnapshot(nutrition) },
          ]);
        } else {
          NutritionWidget.updateSnapshot(nutrition);
        }
      },
      (error) => {
        void handleError(error, 'widgets.refresh', { showSnackbar: false });
      }
    );
    const unsubscribe = widgetEvents.onNutritionWidgetUpdate(() => {
      void queue.refresh();
    });
    const unsubscribeReset = widgetEvents.onReset(queue.dispose);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void queue.refresh();
      }
    });
    void queue.refresh();

    return () => {
      queue.dispose();
      unsubscribe();
      unsubscribeReset();
      subscription.remove();
    };
  }, [isLoading, locale, t, theme, today]);

  return null;
}
