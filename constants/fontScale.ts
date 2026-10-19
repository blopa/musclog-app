/**
 * Upper bound on OS font scaling for text inside fixed-height chrome (tab labels, buttons, stat
 * strips). Past this the label overflows its container instead of growing it. Body copy in
 * scrollable content keeps the default, unbounded scaling.
 */
export const MAX_CHROME_FONT_SCALE = 1.3;
