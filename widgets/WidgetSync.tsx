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

import CycleWidget from './CycleWidget';
import { loadCycleWidgetInputs, subscribeToCycleChanges } from './cycleWidgetData';
import {
  buildCycleWidgetSnapshot,
  type CycleWidgetInputs,
  expiredCycleWidgetSnapshot,
} from './cycleWidgetSnapshot';
import NutritionWidget from './NutritionWidget';
import SmartCameraWidget from './SmartCameraWidget';
import { createWidgetRefreshQueue } from './widgetRefreshQueue';
import {
  buildNutritionWidgetSnapshot,
  CAMERA_WIDGET_URL,
  expiredWidgetSnapshot,
  widgetPalette,
} from './widgetSnapshot';

/** What to publish when the cycle records cannot be read: nothing, never the previous values. */
const UNREADABLE_CYCLE_INPUTS: CycleWidgetInputs = {
  lockScopes: ['app'],
  style: 'discreet',
  cycle: null,
};

async function readCycleInputs(): Promise<CycleWidgetInputs> {
  try {
    return await loadCycleWidgetInputs();
  } catch (error) {
    // A home-screen widget outlives the app, so a failed read must replace what it shows rather
    // than leave a stale day count where a lock or a style change should have hidden it.
    void handleError(error, 'widgets.cycle', { showSnackbar: false });
    return UNREADABLE_CYCLE_INPUTS;
  }
}

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
  const {
    isLoading,
    appLockScopes,
    cycleNotificationStyle,
    cycleShowPredictions,
    cycleShowFertility,
  } = useSettings();
  const { i18n, t } = useTranslation();
  const today = useLocalToday();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const palette = widgetPalette(theme.colors);
    const report = (error: unknown) => {
      void handleError(error, 'widgets.refresh', { showSnackbar: false });
    };

    const nutritionQueue = createWidgetRefreshQueue(
      async () => {
        await waitForDbReady();
        const date = new Date();
        const [nutrients, goal] = await Promise.all([
          NutritionService.getDailyNutrients(date),
          NutritionGoalService.getGoalForDate(date),
        ]);
        const resolved = goal ? ((await NutritionTargetService.resolve(goal, date)) ?? goal) : null;
        return {
          date,
          snapshot: buildNutritionWidgetSnapshot({
            date,
            nutrients,
            goal: resolved,
            palette,
            locale,
            translate: (key) => t(key),
          }),
        };
      },
      ({ date, snapshot }) => {
        if (Platform.OS === 'ios') {
          const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
          NutritionWidget.updateTimeline([
            { date, props: snapshot },
            { date: midnight, props: expiredWidgetSnapshot(snapshot) },
          ]);
        } else {
          NutritionWidget.updateSnapshot(snapshot);
        }
      },
      report
    );
    const cycleQueue = createWidgetRefreshQueue(
      async () => {
        await waitForDbReady();
        return {
          date: new Date(),
          snapshot: buildCycleWidgetSnapshot({
            inputs: await readCycleInputs(),
            palette,
            locale,
            translate: (key, options) => t(key, options),
          }),
        };
      },
      ({ date, snapshot }) => {
        if (Platform.OS === 'ios') {
          const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
          CycleWidget.updateTimeline([
            { date, props: snapshot },
            { date: midnight, props: expiredCycleWidgetSnapshot(snapshot) },
          ]);
        } else {
          CycleWidget.updateSnapshot(snapshot);
        }
      },
      report
    );
    const cameraQueue = createWidgetRefreshQueue(
      sharedCameraImage,
      (imageUri) =>
        SmartCameraWidget.updateSnapshot({
          label: t('widgets.smartCamera'),
          palette,
          imageUri,
          url: CAMERA_WIDGET_URL,
        }),
      report
    );
    const refresh = () => {
      void nutritionQueue.refresh();
      void cycleQueue.refresh();
      void cameraQueue.refresh();
    };

    const dispose = () => {
      nutritionQueue.dispose();
      cycleQueue.dispose();
      cameraQueue.dispose();
    };

    const unsubscribe = widgetEvents.onNutritionWidgetUpdate(() => {
      void nutritionQueue.refresh();
    });
    const unsubscribeCycle = subscribeToCycleChanges(() => {
      void cycleQueue.refresh();
    });
    const unsubscribeReset = widgetEvents.onReset(dispose);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
      }
    });
    refresh();

    return () => {
      dispose();
      unsubscribe();
      unsubscribeCycle();
      unsubscribeReset();
      subscription.remove();
    };
    // The lock and the style decide what the cycle widget may say, so a change to either must
    // re-publish it at once rather than at the next foreground.
  }, [
    isLoading,
    locale,
    t,
    theme,
    today,
    appLockScopes,
    cycleNotificationStyle,
    cycleShowPredictions,
    cycleShowFertility,
  ]);

  return null;
}
