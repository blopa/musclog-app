import { usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { useTranslation } from 'react-i18next';

export function DocumentTitle() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const routeTitles: Record<string, string> = {
    '/app': t('app.title'),
    '/app/nutrition': t('nutrition.title'),
    '/app/nutrition/food': t('nutrition.food.title'),
    '/app/workout': t('workout.title'),
    '/app/workout/workouts': t('workout.workouts.title'),
    '/app/progress': t('progress.title'),
    '/app/profile': t('profile.title'),
    '/app/settings': t('settings.title'),
    '/app/cycle': t('cycle.title'),
  };

  const title =
    routeTitles[pathname] ||
    routeTitles[Object.keys(routeTitles).find((route) => pathname.startsWith(route)) || ''] ||
    'Musclog';

  return (
    <Head>
      <title>{title}</title>
    </Head>
  );
}
