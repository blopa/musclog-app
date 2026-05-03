import { usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { useTranslation } from 'react-i18next';

export function DocumentTitle() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const routeTitles: Record<string, string> = {
    '/app': t('common.app.title'),
    '/app/nutrition': t('common.nutrition.title'),
    '/app/nutrition/food': t('common.nutrition.food.title'),
    '/app/workout': t('common.workout.title'),
    '/app/workout/workouts': t('common.workout.workouts.title'),
    '/app/progress': t('common.progress.title'),
    '/app/profile': t('common.profile.title'),
    '/app/settings': t('common.settings.title'),
    '/app/cycle': t('common.cycle.title'),
  };

  const title =
    routeTitles[pathname] ||
    routeTitles[Object.keys(routeTitles).find((route) => pathname.startsWith(route)) || ''] ||
    t('common.app.title');

  return (
    <Head>
      <title>{title}</title>
    </Head>
  );
}
