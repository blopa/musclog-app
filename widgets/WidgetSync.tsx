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
import { localNextDayStartMsFromDate } from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';
import { widgetEvents } from '@/utils/widgetEvents';

import ActivityHeatmapWidget from './ActivityHeatmapWidget';
import { loadActivityWidgetDays, subscribeToActivityChanges } from './activityWidgetData';
import {
  buildActivityWidgetSnapshot,
  expiredActivityWidgetSnapshot,
} from './activityWidgetSnapshot';
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
const UNREADABLE_CYCLE_INPUTS: CycleWidgetInputs = { lockScopes: ['app'], elapsedDay: null };

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

type DailyWidget<T> = {
  updateSnapshot: (props: T) => void;
  updateTimeline: (entries: { date: Date; props: T }[]) => void;
};

/**
 * iOS keeps a timeline, so it also gets the entry that replaces today's figures at midnight;
 * Android has no timeline and is refreshed again by the day change.
 */
function publishDaily<T>(
  widget: DailyWidget<T>,
  date: Date,
  snapshot: T,
  expire: (snapshot: T) => T
) {
  if (Platform.OS === 'ios') {
    widget.updateTimeline([
      { date, props: snapshot },
      { date: new Date(localNextDayStartMsFromDate(date)), props: expire(snapshot) },
    ]);
  } else {
    widget.updateSnapshot(snapshot);
  }
}

let cameraImage: Promise<string> | undefined;

/** The artwork's file URI, or `''` when there is none: a snapshot never carries a null. */
function sharedCameraImage(): Promise<string> {
  cameraImage ??= (async () => {
    if (!widgetsDirectory) {
      return '';
    }

    const asset = await Asset.fromModule(require('../assets/camera-widget.png')).downloadAsync();
    // Replaced once per launch rather than only when missing, so a changed artwork reaches
    // installs that already hold the old file (a 1024px copy once broke the iOS tile for good).
    const destination = new File(widgetsDirectory, 'smart-camera.png');
    if (asset.localUri) {
      if (destination.exists) {
        destination.delete();
      }

      new File(asset.localUri).copy(destination);
    }

    // A fresh handle: the one above still reports the state from before delete() and copy().
    const copied = new File(widgetsDirectory, 'smart-camera.png');

    return copied.exists ? copied.uri : '';
  })().catch((error) => {
    cameraImage = undefined;
    void handleError(error, 'widgets.cameraArtwork', { showSnackbar: false });
    return '';
  });

  return cameraImage;
}

export function WidgetSync() {
  const { theme } = useThemeContext();
  const { isLoading, appLockScopes } = useSettings();
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
      ({ date, snapshot }) => publishDaily(NutritionWidget, date, snapshot, expiredWidgetSnapshot),
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
            translate: (key) => t(key),
          }),
        };
      },
      ({ date, snapshot }) => publishDaily(CycleWidget, date, snapshot, expiredCycleWidgetSnapshot),
      report
    );
    const activityQueue = createWidgetRefreshQueue(
      async () => {
        await waitForDbReady();
        const date = new Date();
        return {
          date,
          snapshot: buildActivityWidgetSnapshot({
            date,
            days: await loadActivityWidgetDays(date),
            palette,
            translate: (key, options) => t(key, options),
          }),
        };
      },
      ({ date, snapshot }) =>
        publishDaily(ActivityHeatmapWidget, date, snapshot, expiredActivityWidgetSnapshot),
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
      void activityQueue.refresh();
      void cameraQueue.refresh();
    };

    const dispose = () => {
      nutritionQueue.dispose();
      cycleQueue.dispose();
      activityQueue.dispose();
      cameraQueue.dispose();
    };

    const unsubscribe = widgetEvents.onNutritionWidgetUpdate(() => {
      void nutritionQueue.refresh();
    });
    const unsubscribeCycle = subscribeToCycleChanges(() => {
      void cycleQueue.refresh();
    });
    const unsubscribeActivity = subscribeToActivityChanges(() => {
      void activityQueue.refresh();
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
      unsubscribeActivity();
      unsubscribeReset();
      subscription.remove();
    };
    // The lock decides whether the cycle widget may show the day, so a change to it must
    // re-publish at once rather than at the next foreground.
  }, [isLoading, locale, t, theme, today, appLockScopes]);

  return null;
}
