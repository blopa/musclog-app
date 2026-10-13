/**
 * Rest after a set that names no rest of its own, until the user picks a different default.
 * Ninety seconds is the middle of the evidence: rest of two minutes or more beats one minute for
 * strength and hypertrophy on compound lifts (Schoenfeld et al., 2016), while isolation work
 * recovers sooner.
 */
export const DEFAULT_REST_SECONDS = 90;

export const MIN_REST_SECONDS = 15;
export const MAX_REST_SECONDS = 600;
export const REST_SECONDS_STEP = 15;

/** The countdown turns into a "get ready" state this many seconds before it ends. */
export const GET_READY_SECONDS = 10;
