import { router } from 'expo-router';

export async function reloadApp() {
  router.replace('/app');
  window.location.reload();
}
