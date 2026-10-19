import {
  Calendar,
  Dumbbell,
  Flame,
  Heart,
  Layout,
  List,
  type LucideIcon,
  Settings,
  Shield,
  Shuffle,
  Target,
  Timer,
  TrendingUp,
} from 'lucide-react-native';

import type { WhatsNewIconName } from '@/utils/whatsNew/catalog';

export const whatsNewIcons: Record<WhatsNewIconName, LucideIcon> = {
  layout: Layout,
  list: List,
  target: Target,
  trendingUp: TrendingUp,
  timer: Timer,
  dumbbell: Dumbbell,
  calendar: Calendar,
  heart: Heart,
  shuffle: Shuffle,
  shield: Shield,
  flame: Flame,
  settings: Settings,
};
