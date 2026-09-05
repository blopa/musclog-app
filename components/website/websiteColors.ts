/**
 * The website's colour vocabulary, expressed as the app's theme tokens.
 *
 * Every value here resolves through a `--c-*` custom property rather than to a
 * literal, so one page paints in whichever of the six named palettes the visitor
 * picked. `ThemeProvider` publishes the active set on `:root`, and the pre-paint
 * script in `app/+html.tsx` puts it there before the first pixel lands.
 *
 * An icon's `color` prop takes these too. `react-native-svg` forwards it to an
 * SVG presentation attribute on web, and a presentation attribute is a CSS
 * declaration like any other, so it substitutes `var()` normally.
 */

/** Opaque tokens are stored as bare `r g b` channels, so alpha is a caller's choice. */
const channels = (token: string, alpha?: number) =>
  alpha === undefined ? `rgb(var(--c-${token}))` : `rgb(var(--c-${token}) / ${alpha})`;

/** On-surface ink: the hairlines and washes that used to be spelled `rgba(255,255,255,a)`. */
export const ink = (alpha: number) => channels('ink-DEFAULT', alpha);

/** The brand at working strength — buttons, links, active borders. */
export const brand = (alpha?: number) => channels('accent-primary', alpha);

/** The brand at its most luminous — glows, hero highlights, icon strokes. */
export const brandBright = (alpha?: number) => channels('accent-bright', alpha);

/** What a backdrop darkens towards. Dark in every palette, by definition. */
export const scrim = (alpha: number) => channels('scrim-base', alpha);

/** The page ground, for the bars and sheets that float above it. */
export const surface = (alpha?: number) => channels('bg-primary', alpha);

/** The raised ground a card sits on. */
export const surfaceCard = (alpha?: number) => channels('bg-card', alpha);

/** Semantic hues for decorative accents (feature icons, comparison chips, charts). */
export const hue = (
  name: 'amber' | 'error' | 'indigo' | 'info' | 'pink' | 'purple' | 'rose' | 'success' | 'warning',
  alpha?: number
) => channels(`status-${name}`, alpha);

export const BRAND_GREEN = brand();
export const BRAND_GREEN_BRIGHT = brandBright();
/** Ink on the brand — near-black on green in the dark palettes, white in the light ones. */
export const ON_BRAND = channels('text-on-accent');

export const HEADING_TEXT = channels('text-primary');
export const BODY_TEXT = channels('text-secondary');
export const BODY_TEXT_SOFT = channels('text-tertiary');
export const MUTED = channels('text-muted');

export const CARD_BG = ink(0.03);
export const CARD_BORDER = ink(0.1);
export const INPUT_BG = ink(0.06);
export const INPUT_BORDER = ink(0.12);
