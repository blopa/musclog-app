import { Activity, Dumbbell, Soup, Trophy, User } from 'lucide-react-native';

import { themeColors } from '@/theme.tokens';
import type { AvatarColor } from '@/types/AvatarColor';
import type { AvatarIcon } from '@/types/AvatarIcon';

import { getAvatarBackgroundColor, getAvatarColor } from '@/utils/avatarColorUtils';
import { getAvatarDisplayProps, getAvatarIcon } from '@/utils/avatarUtils';

/** Every member of the `AvatarIcon` union (types/AvatarIcon.ts). */
const AVATAR_ICONS: AvatarIcon[] = [
  'person',
  'fitness_center',
  'bolt',
  'monitoring',
  'directions_run',
  'sports',
  'emoji_events',
  'heart',
  'flame',
  'meditation',
  'restaurant',
  'ramen-dining',
  'dinner-dining',
  'bakery-dining',
  'local-cafe',
  'droplet',
  'scale',
  'egg',
  'cup',
  'lightbulb',
  'wind',
  'nutrition',
];

const theme = { colors: themeColors } as unknown as Parameters<typeof getAvatarDisplayProps>[0];

describe('avatarUtils', () => {
  describe('getAvatarIcon', () => {
    it('returns the person icon when no icon is stored', () => {
      expect(getAvatarIcon()).toBe(User);
      expect(getAvatarIcon(null)).toBe(User);
      expect(getAvatarIcon(undefined)).toBe(User);
    });

    it.each(AVATAR_ICONS)('resolves %s to a renderable component', (icon) => {
      expect(getAvatarIcon(icon)).toBeDefined();
    });

    it('has a mapping for every icon except the one that legitimately is the person icon', () => {
      // Without this, a missing map entry would silently fall through to `User` and the
      // user's chosen avatar would quietly change.
      const fellBackToUser = AVATAR_ICONS.filter((icon) => getAvatarIcon(icon) === User);
      expect(fellBackToUser).toEqual(['person']);
    });

    it('maps the semantic names to their lucide components', () => {
      expect(getAvatarIcon('fitness_center')).toBe(Dumbbell);
      expect(getAvatarIcon('sports')).toBe(Dumbbell);
      expect(getAvatarIcon('monitoring')).toBe(Activity);
      expect(getAvatarIcon('emoji_events')).toBe(Trophy);
      expect(getAvatarIcon('ramen-dining')).toBe(Soup);
    });

    it('falls back to the person icon for an unknown stored icon name', () => {
      expect(getAvatarIcon('rocket' as AvatarIcon)).toBe(User);
    });
  });

  describe('getAvatarDisplayProps', () => {
    it('composes the icon component with the matching colour pair', () => {
      expect(getAvatarDisplayProps(theme, 'flame', 'orange')).toEqual({
        IconComponent: getAvatarIcon('flame'),
        color: getAvatarColor(theme, 'orange'),
        backgroundColor: getAvatarBackgroundColor(theme, 'orange'),
      });
    });

    it('uses the person icon and accent colours when nothing is configured', () => {
      expect(getAvatarDisplayProps(theme)).toEqual({
        IconComponent: User,
        color: themeColors.accent.primary,
        backgroundColor: themeColors.accent.primary20,
      });
    });

    it('lets the icon and colour be chosen independently', () => {
      const iconOnly = getAvatarDisplayProps(theme, 'egg', null);
      expect(iconOnly.IconComponent).toBe(getAvatarIcon('egg'));
      expect(iconOnly.color).toBe(themeColors.accent.primary);

      const colourOnly = getAvatarDisplayProps(theme, null, 'indigo');
      expect(colourOnly.IconComponent).toBe(User);
      expect(colourOnly.color).toBe(themeColors.avatar.indigo);
    });

    it('resolves a colour for every icon/colour combination (no undefined style values)', () => {
      const colours: AvatarColor[] = ['emerald', 'blue', 'purple', 'pink'];
      for (const icon of AVATAR_ICONS) {
        for (const colour of colours) {
          const props = getAvatarDisplayProps(theme, icon, colour);
          expect(props.IconComponent).toBeDefined();
          expect(props.color).toBeTruthy();
          expect(props.backgroundColor).toBeTruthy();
        }
      }
    });
  });
});
