import { Tabs } from 'expo-router';

import {
  renderTabScreenLayout,
  useReleaseHiddenTabsOnMemoryWarning,
} from '@/components/navigation/TabKeepAlive';
import { useTheme } from '@/hooks/useTheme';

/**
 * The main destinations, in one tab navigator so switching between them shows the screen that is
 * already built instead of stacking a new one (`docs/FIXES.md`). Each screen still draws the
 * bottom bar itself through `MasterLayout`, so the navigator draws none, and the screens pushed
 * over it in the outer stack keep the same bar.
 *
 * - Hidden tabs stay mounted, up to the limit in `utils/tabKeepAlive.ts`, through `screenLayout`.
 * - Back from any tab goes to Home (the anchor, `initialRoute`), and from Home it leaves the
 *   app: the usual Android behaviour for tabs, and what the stack did once the bar stopped
 *   stacking screens.
 * - No transition: a tab switch is instant.
 */
export const unstable_settings = {
  anchor: 'index',
};

/**
 * Every screen in this folder, Home first. expo-router only shows a tab that is DECLARED here: a
 * screen left out is "hidden", and focusing it is redirected straight back to Home, so a new tab
 * screen must be added to this list (`components/navigation/__tests__/destinationNavigation.test.ts`).
 */
const TAB_ROUTE_NAMES = [
  'index',
  'nutrition/food',
  'workout/workouts',
  'profile',
  'progress',
  'cycle',
  'weekly-review',
  'notes',
  'settings',
] as const;

const renderNoTabBar = () => null;

export default function TabsLayout() {
  const theme = useTheme();
  useReleaseHiddenTabsOnMemoryWarning();

  return (
    <Tabs
      backBehavior="initialRoute"
      tabBar={renderNoTabBar}
      screenLayout={renderTabScreenLayout}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background.primary },
      }}
    >
      {TAB_ROUTE_NAMES.map((name) => (
        <Tabs.Screen key={name} name={name} />
      ))}
    </Tabs>
  );
}
