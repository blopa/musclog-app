import { useEffect, useSyncExternalStore } from 'react';

import { SettingsService } from '@/database/services/SettingsService';
import { useSettings } from '@/hooks/useSettings';
import { getServerThemeMirror, getThemeMirror, subscribeToThemeMirror } from '@/utils/themeMirror';

/**
 * Copies the website's theme choice into the settings row once that row can be read.
 *
 * On the website the theme mirror outranks the settings row (`ThemeProvider preferMirror`):
 * every theme change in this browser lands in the mirror, whether it came from the website's
 * picker or from the app's settings, while the picker's write to the row can be lost. A visitor
 * who also uses the web app opens its database on every website page, which on a phone takes
 * seconds, and leaving the page before it has opened drops the write. The row then still held the
 * old theme, and once it loaded it replaced the choice on screen and in the mirror.
 *
 * Rendering nothing, this repeats the write whenever the readable row disagrees with the mirror,
 * so the app (where the row stays authoritative) opens in the theme picked here.
 */
export function WebsiteThemeSync(): null {
  const { isLoading, theme } = useSettings();
  const mirror = useSyncExternalStore(subscribeToThemeMirror, getThemeMirror, getServerThemeMirror);
  const preference = mirror?.preference;

  useEffect(() => {
    if (isLoading || !preference || preference === theme) {
      return;
    }

    SettingsService.setTheme(preference).catch((error) =>
      console.warn('[WebsiteThemeSync] Failed to save the website theme:', error)
    );
  }, [isLoading, preference, theme]);

  return null;
}
