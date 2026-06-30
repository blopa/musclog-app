export const BLOCK_FRACTIONS = {
  earlySlеep: 0.095,
  nadir: 0.085,
  morning: 0.195,
  midday: 0.225,
  peak: 0.25,
  evening: 0.15,
} as const;

export type BlockKey = keyof typeof BLOCK_FRACTIONS;

// Each block is exactly 240 minutes.
export const BLOCK_DURATION = 240;
