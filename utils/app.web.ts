import { router } from 'expo-router';

export function isProduction() {
  return !__DEV__;
}

export async function reloadApp() {
  router.replace('/app');
  window.location.reload();
}
