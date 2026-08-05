import {
  BarChart3,
  Calendar,
  ClipboardCheck,
  Dumbbell,
  type LucideIcon,
  MessageSquare,
  Settings,
  StickyNote,
  User,
  UtensilsCrossed,
} from 'lucide-react-native';

import type { NavItemKey } from '@/constants/settings';

/**
 * The icon for each navigation destination, shared by the bottom bar (`NavigationMenu`) and the
 * slot picker (`VisualSettingsModal`) so a new destination picks its icon once. Lives here rather
 * than in `constants/settings.ts` to keep that module free of UI imports.
 *
 * Being a `Record<NavItemKey, …>` is load-bearing: adding a key to `NAV_ITEM_KEYS` fails the build
 * here until an icon is chosen. `NavigationMenu` reads every entry except `coach`, which it
 * renders through `CoachUnreadBadgeIcon` to carry the unread badge.
 */
export const NAV_ITEM_ICON: Record<NavItemKey, LucideIcon> = {
  workouts: Dumbbell,
  food: UtensilsCrossed,
  profile: User,
  coach: MessageSquare,
  cycle: Calendar,
  settings: Settings,
  progress: BarChart3,
  checkin: ClipboardCheck,
  notes: StickyNote,
};
