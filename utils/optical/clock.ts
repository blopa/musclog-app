/**
 * The clock every optical timing measurement reads.
 *
 * `performance.now` is monotonic and sub-millisecond, which matters when the thing being measured
 * is a ~10 ms raster or a ~175 ms QR encode. It is not guaranteed to exist on every runtime this
 * code runs in (older Hermes, some web workers), hence the fallback — but the fallback is a last
 * resort, not the normal path, so it lives in exactly one place rather than being re-derived at
 * every call site.
 */
export function monotonicNowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}
