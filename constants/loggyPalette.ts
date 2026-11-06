/**
 * The colours of Loggy's own artwork (`assets/avatars/loggy-poses/*.svg`). They are fixed, like a
 * photo's: a green log on an emerald or rose brand fill disappears, so a surface built around Loggy
 * takes its ground from here and not from the theme (see docs/DESIGN.md, "Surfaces that do not follow
 * the theme"). `constants/__tests__/loggyPalette.test.ts` holds them to the artwork.
 */
export const LOGGY_PALETTE = {
  ink: '#1b314d',
  paper: '#fcf9f4',
  green: '#47ad92',
  teal: '#2f7e78',
  coral: '#ee8074',
  yellow: '#f5c84c',
  sky: '#8ad4ec',
  tan: '#efd9b4',
} as const;

/** A poster's flat ground and everything drawn on it. */
export type PosterGround = {
  background: string;
  /** All text and the strongest marks. */
  ink: string;
  /** The one highlighted mark in a chart: the longest run, the busiest month. */
  highlight: string;
  /** A filled mark that is not the highlight. */
  mark: string;
  /** An empty cell or a bar's track. */
  track: string;
};

export type PosterGroundName = 'yellow' | 'sky' | 'coral' | 'tan' | 'paper' | 'ink';

/** `#rrggbb` plus a two-digit alpha. Both runtimes read it, and it needs no theme. */
function withAlpha(hex: string, alpha: number): string {
  const channel = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');

  return `${hex}${channel}`;
}

function lightGround(background: string): PosterGround {
  return {
    background,
    ink: LOGGY_PALETTE.ink,
    highlight: LOGGY_PALETTE.ink,
    mark: withAlpha(LOGGY_PALETTE.ink, 0.38),
    track: withAlpha(LOGGY_PALETTE.ink, 0.12),
  };
}

export const POSTER_GROUNDS: Record<PosterGroundName, PosterGround> = {
  yellow: lightGround(LOGGY_PALETTE.yellow),
  sky: lightGround(LOGGY_PALETTE.sky),
  coral: lightGround(LOGGY_PALETTE.coral),
  tan: lightGround(LOGGY_PALETTE.tan),
  paper: lightGround(LOGGY_PALETTE.paper),
  ink: {
    background: LOGGY_PALETTE.ink,
    ink: LOGGY_PALETTE.paper,
    highlight: LOGGY_PALETTE.yellow,
    mark: withAlpha(LOGGY_PALETTE.paper, 0.45),
    track: withAlpha(LOGGY_PALETTE.paper, 0.16),
  },
};
