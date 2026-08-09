/**
 * Optical transfer — compression.
 *
 * Compression is the single largest lever on transfer time: a real export gzips ~9×, turning a
 * ~650 KB dump into ~70 KB and a ten-minute transfer into a twenty-second one.
 *
 * Both directions run through fflate's *streaming* classes rather than `gzipSync`/`gunzipSync`,
 * for two different reasons:
 *
 *  - Compressing 650 KB takes ~800 ms on a 2018 phone. Sync, that is a dead UI. Pushing slices
 *    with a yield between them keeps the progress bar moving and Cancel responsive.
 *  - Decompressing needs a HARD OUTPUT CEILING. These bytes arrived over an open optical channel,
 *    and gzip's trailing ISIZE field is a hint, not a bound — a small stream can legitimately
 *    claim to inflate to gigabytes. Streaming lets us count output as it arrives and abort the
 *    moment it exceeds what the caller will accept, instead of discovering it after allocating.
 */

import { Gunzip, Gzip } from 'fflate';

/** ~256 KB per push: big enough that per-slice overhead vanishes, small enough to yield often. */
const SLICE_BYTES = 256 * 1024;

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export class OpticalInflateTooLargeError extends Error {
  constructor(readonly limit: number) {
    super(`Decompressed payload exceeds ${limit} bytes`);
    this.name = 'OpticalInflateTooLargeError';
  }
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export interface GzipOptions {
  /** fflate level 0–9. 6 is the default: ~7% smaller than 1 for ~170 ms more on a real export. */
  level?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  onProgress?: (fraction: number) => void;
}

export async function gzipChunked(bytes: Uint8Array, options: GzipOptions = {}) {
  const { level = 6, onProgress } = options;
  const chunks: Uint8Array[] = [];
  let total = 0;
  let failure: unknown = null;

  const gzip = new Gzip({ level }, (chunk) => {
    chunks.push(chunk);
    total += chunk.length;
  });

  for (let offset = 0; offset < bytes.length; offset += SLICE_BYTES) {
    const end = Math.min(offset + SLICE_BYTES, bytes.length);
    const isFinal = end === bytes.length;
    try {
      gzip.push(bytes.subarray(offset, end), isFinal);
    } catch (error) {
      failure = error;
      break;
    }
    onProgress?.(end / bytes.length);
    await yieldToUi();
  }

  if (bytes.length === 0) {
    gzip.push(new Uint8Array(0), true);
  }
  if (failure) {
    throw failure;
  }

  return concat(chunks, total);
}

export interface GunzipOptions {
  onProgress?: (bytesOut: number) => void;
}

/**
 * Inflate, refusing to produce more than `maxBytes`.
 *
 * The limit is enforced against bytes actually emitted, not against any length the stream claims,
 * which is the only way it can be trusted on data from an untrusted source.
 */
export async function gunzipChunked(
  bytes: Uint8Array,
  maxBytes: number,
  options: GunzipOptions = {}
): Promise<Uint8Array> {
  const { onProgress } = options;
  const chunks: Uint8Array[] = [];
  let total = 0;
  let overflow = false;

  const gunzip = new Gunzip((chunk) => {
    if (overflow) {
      return;
    }
    total += chunk.length;
    if (total > maxBytes) {
      overflow = true;
      return;
    }
    chunks.push(chunk);
  });

  for (let offset = 0; offset < bytes.length; offset += SLICE_BYTES) {
    const end = Math.min(offset + SLICE_BYTES, bytes.length);
    gunzip.push(bytes.subarray(offset, end), end === bytes.length);
    if (overflow) {
      throw new OpticalInflateTooLargeError(maxBytes);
    }
    onProgress?.(total);
    await yieldToUi();
  }

  return concat(chunks, total);
}
