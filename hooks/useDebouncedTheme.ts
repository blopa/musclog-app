import { useCallback, useRef, useState } from 'react';

import type { ThemeOption } from '../constants/settings';
import { SettingsService } from '../database/services/SettingsService';
import { useSettings } from './useSettings';

/**
 * Hook that provides instant theme updates with debounced database persistence
 * This allows the UI to update immediately while saving to the database after a delay
 */
export function useDebouncedTheme(debounceMs = 1000) {
  // Get the actual theme from database
  const { theme: actualTheme } = useSettings();

  // Local state for instant UI updates
  const [localTheme, setLocalTheme] = useState<ThemeOption>(actualTheme);

  // Ref to track the timeout
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ref to track the latest pending value
  const pendingValueRef = useRef<ThemeOption | null>(null);

  // Update local theme when actual theme changes from database
  // This handles cases where the theme is changed elsewhere or app restarts
  const syncWithDatabase = useCallback(() => {
    setLocalTheme(actualTheme);
    pendingValueRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [actualTheme]);

  // Keep local theme in sync with database theme
  // Only update if there's no pending change to avoid overriding user's immediate selection
  if (actualTheme !== localTheme && pendingValueRef.current === null) {
    syncWithDatabase();
  }

  // Function to handle theme changes with instant UI update and debounced database save
  const handleThemeChange = useCallback(
    (newTheme: ThemeOption) => {
      // Update UI immediately
      setLocalTheme(newTheme);

      // Store the pending value
      pendingValueRef.current = newTheme;

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout to save to database
      timeoutRef.current = setTimeout(async () => {
        try {
          await SettingsService.setTheme(newTheme);
          pendingValueRef.current = null;
        } catch (error) {
          console.error('[useDebouncedTheme] Error saving theme to database:', error);
          // Revert to actual theme on error
          setLocalTheme(actualTheme);
          pendingValueRef.current = null;
        }
      }, debounceMs);
    },
    [actualTheme, debounceMs]
  );

  // Function to immediately save pending changes to database
  const flushPendingChanges = useCallback(async () => {
    if (pendingValueRef.current && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;

      try {
        await SettingsService.setTheme(pendingValueRef.current);
        pendingValueRef.current = null;
      } catch (error) {
        console.error('[useDebouncedTheme] Error flushing theme changes:', error);
        // Revert to actual theme on error
        setLocalTheme(actualTheme);
        pendingValueRef.current = null;
      }
    }
  }, [actualTheme]);

  // Cleanup timeout on unmount
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    theme: localTheme,
    actualTheme,
    handleThemeChange,
    flushPendingChanges,
    cleanup,
    hasPendingChanges: pendingValueRef.current !== null,
  };
}
