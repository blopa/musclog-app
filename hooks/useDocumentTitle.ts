import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

/**
 * Hook to dynamically update the document title based on the current route.
 * Only runs on web platform.
 */
export function useDocumentTitle() {
  const pathname = usePathname();
  const { t } = useTranslation();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    // Map routes to titles
    const routeTitles: Record<string, string> = {
      '/app': t('app.title', 'Musclog App'),
      '/app/nutrition': t('nutrition.title', 'Nutrition'),
      '/app/nutrition/food': t('nutrition.food.title', 'Food Log'),
      '/app/workout': t('workout.title', 'Workout'),
      '/app/workout/workouts': t('workout.workouts.title', 'Workouts'),
      '/app/progress': t('progress.title', 'Progress'),
      '/app/profile': t('profile.title', 'Profile'),
      '/app/settings': t('settings.title', 'Settings'),
      '/app/cycle': t('cycle.title', 'Cycle'),
    };

    // Find the most specific route match
    const title =
      routeTitles[pathname] ||
      routeTitles[Object.keys(routeTitles).find((route) => pathname.startsWith(route)) || ''] ||
      'Musclog';

    document.title = title;
  }, [pathname, t]);
}
