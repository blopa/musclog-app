import { router } from 'expo-router';

export async function reloadApp() {
  router.replace('/');
  window.location.reload();
}
