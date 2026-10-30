'use strict';

// Plain JS so both `tailwind.config.js` (Node) and `theme.ts` (app) read the one scale.

/**
 * The app's corner radii, named by what they round rather than by size. Five values and `full`:
 *
 * - `tag`: status badges ("Ready to review", "Set 2 of 3") and skeleton bars.
 * - `inner`: something drawn inside a `control` with a few points of padding (a segment in its
 *   track), so the two curves stay concentric.
 * - `control`: anything the user presses or types into: buttons, inputs, chips, list rows, tiles.
 * - `card`: a surface that groups content: cards, list groups, dialogs.
 * - `sheet`: the top corners of a bottom sheet, the one surface that meets the screen edge.
 *
 * `full` stays Tailwind's and is for circles only (avatars, status dots, round FABs) and thin
 * progress tracks. These are pixels, not rem: NativeWind resolves `rem` to 14 on native and 16 on
 * web, so the old `rounded-2xl` was 14 on a phone and 16 in a browser.
 */
const RADIUS = {
  tag: 4,
  inner: 6,
  control: 8,
  card: 12,
  sheet: 16,
};

module.exports = { RADIUS };
