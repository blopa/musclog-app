/**
 * Optical transfer — the Musclog container ("MLOG" v1).
 *
 * Wraps a `dumpDatabase()` JSON string into the bytes the fountain transmits, and unwraps it on
 * the far side. This is the layer where format evolution is allowed: the frame header in
 * `./frameProtocol.ts` is frozen forever, but `containerVersion` here is checked *after* the
 * payload has been reassembled — so a future change produces a clear "update Musclog on the other
 * phone" instead of a stream that silently never completes.
 *
 * Header: 92 bytes, little-endian, fixed layout (no variable-length fields, no branches).
 *
 *   off  size  field
 *     0     4  magic 'MLOG'
 *     4     1  containerVersion
 *     5     1  flags        bit0 = gzip, bit1 = aes, bits 2..7 reserved
 *     6     2  exportVersion       the dump's own _exportVersion
 *     8     4  createdAtSec        sender clock, seconds since epoch
 *    12     4  plainLen            UTF-8 byte length of the JSON
 *    16     4  bodyLen             byte length of the body that follows
 *    20    32  sha256              over the plain UTF-8 JSON bytes
 *    52     1  kdfId               0 none, 1 PBKDF2-HMAC-SHA256
 *    53     1  cipherId            0 none, 1 AES-256-CBC/PKCS#7
 *    54     1  payloadKind         0 database dump, 1 share envelope
 *    55     1  reserved
 *    56     4  kdfIterations
 *    60    16  kdfSalt
 *    76    16  cipherIv
 *    92   ...  body
 *
 * The crypto fields are always present, zeroed when unencrypted. Forty wasted bytes on a ≥70 KB
 * payload is under 0.06%, and one fixed-size parse is worth more than two layouts.
 *
 * `payloadKind` claims the low byte of what used to be a zeroed `reserved` u16, so a container
 * carrying a database dump is byte-identical to one written before the field existed — which is
 * what lets an already-shipped receiver keep reading our dumps unchanged. See
 * `docs/OPTICAL_TRANSFER.md` for what an OLD build does when it receives a share payload, and for
 * why `containerVersion` was deliberately NOT bumped for this.
 *
 * BODY ORDER IS FIXED: utf8 → sha256 → gzip → aes. **gzip strictly before aes** — ciphertext is
 * incompressible, so encrypting first would cost roughly 9× the transfer time. That ordering is
 * the whole reason the passphrase lives here rather than being passed to `dumpDatabase(phrase)`.
 */

import { gunzipChunked, gzipChunked } from './gzip';
import {
  decryptOpticalBody,
  DEFAULT_OPTICAL_KDF_ITERATIONS,
  deriveOpticalKey,
  encryptOpticalBody,
  OPTICAL_CIPHER_AES256_CBC,
  OPTICAL_CIPHER_IV_BYTES,
  OPTICAL_CIPHER_NONE,
  OPTICAL_KDF_NONE,
  OPTICAL_KDF_PBKDF2_SHA256,
  OPTICAL_KDF_SALT_BYTES,
  randomBytes,
  sha256,
} from './passphrase';
import { utf8Decode, utf8Encode } from './utf8';

export const OPTICAL_CONTAINER_HEADER_LEN = 92;
export const OPTICAL_CONTAINER_VERSION = 1;

/** A whole-database dump, restored by `restoreDatabase`. The default, and what byte 54 read as
 *  before the field existed. */
export const OPTICAL_PAYLOAD_KIND_DATABASE = 0;
/** A `_musclogShare` envelope carrying a subset of records — see `utils/share/shareEnvelope.ts`. */
export const OPTICAL_PAYLOAD_KIND_SHARE = 1;

/**
 * The `exportVersion` every share container declares.
 *
 * This is a COMPATIBILITY CONTRACT, not a version number. A build shipped before share payloads
 * existed ignores `payloadKind` entirely and would otherwise offer its destructive "Replace my
 * data" restore for a meal. Its `tooNew` gate compares this field against `CURRENT_DATABASE_VERSION`,
 * so a deliberately impossible value makes that build disable the button and say "sent by a newer
 * version of Musclog" — the right sentence, for free, with no change to already-shipped code.
 *
 * It is the second of two independent defences. The first is that a share envelope carries no
 * top-level `_exportVersion`, so `restoreDatabase`'s Zod pass rejects it before the wipe. This one
 * turns a confusing wall of validation errors into a clear message; that one prevents data loss.
 * `utils/__tests__/opticalContainer.test.ts` pins it above `CURRENT_DATABASE_VERSION`.
 */
export const OPTICAL_EXPORT_VERSION_SHARE = 0xffff;

/** Ceiling on the inflated JSON. Bounds `gunzipChunked` against a hostile declared length. */
export const MAX_OPTICAL_PLAIN_BYTES = 64 * 1024 * 1024;

const MAGIC = [0x4d, 0x4c, 0x4f, 0x47]; // 'MLOG'
const FLAG_GZIP = 1;
const FLAG_AES = 2;
/** Below this, gzip's own header costs more than it saves. */
const MIN_GZIP_INPUT = 512;
const GZIP_MIN_SAVING = 64;

export type OpticalContainerErrorCode =
  | 'bad-magic'
  | 'bad-length'
  | 'bad-passphrase'
  | 'checksum'
  | 'needs-passphrase'
  | 'too-large'
  | 'unexpected-passphrase'
  | 'unsupported-version';

/**
 * The code matters as much as the message: the UI has to tell "wrong passphrase" (re-prompt, the
 * container is still in memory, zero rescan cost) apart from "corrupt" (rescan everything).
 */
export class OpticalContainerError extends Error {
  constructor(
    readonly code: OpticalContainerErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'OpticalContainerError';
  }
}

export interface OpticalContainerMeta {
  containerVersion: number;
  gzip: boolean;
  encrypted: boolean;
  exportVersion: number;
  createdAtSec: number;
  plainLen: number;
  bodyLen: number;
  sha256: Uint8Array;
  kdfId: number;
  cipherId: number;
  /** OPTICAL_PAYLOAD_KIND_*. Readers must treat an unrecognised value as "not for me". */
  payloadKind: number;
  kdfIterations: number;
  kdfSalt: Uint8Array;
  cipherIv: Uint8Array;
}

export type OpticalPackStep = 'encoding' | 'hashing' | 'compressing' | 'encrypting';
export type OpticalPackProgress = (step: OpticalPackStep, fraction: number) => void;

export interface PackOpticalOptions {
  passphrase?: string;
  exportVersion?: number;
  nowMs?: number;
  kdfIterations?: number;
  onProgress?: OpticalPackProgress;
  /** OPTICAL_PAYLOAD_KIND_*. Defaults to a database dump, which is what byte 54 meant before. */
  payloadKind?: number;
}

export interface UnpackOpticalOptions {
  passphrase?: string;
  onProgress?: OpticalPackProgress;
  maxPlainBytes?: number;
}

/**
 * Lifts `_exportVersion` without parsing the whole dump. `dumpRowsToJson` writes it first with
 * two-space indent, so it is always inside the first few dozen characters.
 *
 * Only used for a friendly pre-wipe "this backup is newer than this app" gate — `restoreDatabase`'s
 * Zod pass remains the authority on whether the dump is actually usable.
 */
export function readExportVersion(json: string): number {
  return Number(/"_exportVersion"\s*:\s*(\d+)/.exec(json.slice(0, 512))?.[1] ?? 0);
}

export async function packOpticalContainer(
  json: string,
  options: PackOpticalOptions = {}
): Promise<{ container: Uint8Array; meta: OpticalContainerMeta }> {
  const {
    passphrase,
    exportVersion = readExportVersion(json),
    nowMs = Date.now(),
    kdfIterations = DEFAULT_OPTICAL_KDF_ITERATIONS,
    onProgress,
    payloadKind = OPTICAL_PAYLOAD_KIND_DATABASE,
  } = options;

  onProgress?.('encoding', 0);
  const plain = utf8Encode(json);
  onProgress?.('encoding', 1);

  onProgress?.('hashing', 0);
  const digest = sha256(plain);
  onProgress?.('hashing', 1);

  let body = plain;
  let gzip = false;
  if (plain.length >= MIN_GZIP_INPUT) {
    const compressed = await gzipChunked(plain, {
      onProgress: (fraction) => onProgress?.('compressing', fraction),
    });
    // Keep it only if it actually helped — an incompressible payload would otherwise pay gzip's
    // framing for nothing.
    if (compressed.length + GZIP_MIN_SAVING < plain.length) {
      body = compressed;
      gzip = true;
    }
  }

  const encrypted = Boolean(passphrase);
  const salt = encrypted
    ? randomBytes(OPTICAL_KDF_SALT_BYTES)
    : new Uint8Array(OPTICAL_KDF_SALT_BYTES);
  const iv = encrypted
    ? randomBytes(OPTICAL_CIPHER_IV_BYTES)
    : new Uint8Array(OPTICAL_CIPHER_IV_BYTES);

  if (encrypted) {
    onProgress?.('encrypting', 0);
    const key = deriveOpticalKey(passphrase as string, salt, kdfIterations);
    body = encryptOpticalBody(body, key, iv);
    onProgress?.('encrypting', 1);
  }

  const meta: OpticalContainerMeta = {
    containerVersion: OPTICAL_CONTAINER_VERSION,
    gzip,
    encrypted,
    exportVersion,
    createdAtSec: Math.floor(nowMs / 1000),
    plainLen: plain.length,
    bodyLen: body.length,
    sha256: digest,
    kdfId: encrypted ? OPTICAL_KDF_PBKDF2_SHA256 : OPTICAL_KDF_NONE,
    cipherId: encrypted ? OPTICAL_CIPHER_AES256_CBC : OPTICAL_CIPHER_NONE,
    payloadKind,
    kdfIterations: encrypted ? kdfIterations : 0,
    kdfSalt: salt,
    cipherIv: iv,
  };

  const container = new Uint8Array(OPTICAL_CONTAINER_HEADER_LEN + body.length);
  const view = new DataView(container.buffer);
  container.set(MAGIC, 0);
  view.setUint8(4, meta.containerVersion);
  view.setUint8(5, (gzip ? FLAG_GZIP : 0) | (encrypted ? FLAG_AES : 0));
  view.setUint16(6, meta.exportVersion, true);
  view.setUint32(8, meta.createdAtSec, true);
  view.setUint32(12, meta.plainLen, true);
  view.setUint32(16, meta.bodyLen, true);
  container.set(digest, 20);
  view.setUint8(52, meta.kdfId);
  view.setUint8(53, meta.cipherId);
  view.setUint8(54, meta.payloadKind);
  view.setUint8(55, 0);
  view.setUint32(56, meta.kdfIterations, true);
  container.set(salt, 60);
  container.set(iv, 76);
  container.set(body, OPTICAL_CONTAINER_HEADER_LEN);

  return { container, meta };
}

export function parseOpticalContainerHeader(bytes: Uint8Array): OpticalContainerMeta {
  if (bytes.length < OPTICAL_CONTAINER_HEADER_LEN) {
    throw new OpticalContainerError('bad-length', 'Container is shorter than its header');
  }
  if (MAGIC.some((byte, index) => bytes[index] !== byte)) {
    throw new OpticalContainerError('bad-magic', 'Not a Musclog optical container');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const containerVersion = view.getUint8(4);
  if (containerVersion !== OPTICAL_CONTAINER_VERSION) {
    throw new OpticalContainerError(
      'unsupported-version',
      `Container version ${containerVersion} is not supported`
    );
  }

  const flags = view.getUint8(5);
  const meta: OpticalContainerMeta = {
    containerVersion,
    gzip: (flags & FLAG_GZIP) !== 0,
    encrypted: (flags & FLAG_AES) !== 0,
    exportVersion: view.getUint16(6, true),
    createdAtSec: view.getUint32(8, true),
    plainLen: view.getUint32(12, true),
    bodyLen: view.getUint32(16, true),
    sha256: bytes.slice(20, 52),
    kdfId: view.getUint8(52),
    cipherId: view.getUint8(53),
    payloadKind: view.getUint8(54),
    kdfIterations: view.getUint32(56, true),
    kdfSalt: bytes.slice(60, 76),
    cipherIv: bytes.slice(76, 92),
  };

  if (bytes.length !== OPTICAL_CONTAINER_HEADER_LEN + meta.bodyLen) {
    throw new OpticalContainerError('bad-length', 'Container length does not match its header');
  }
  return meta;
}

export async function unpackOpticalContainer(
  container: Uint8Array,
  options: UnpackOpticalOptions = {}
): Promise<{ json: string; meta: OpticalContainerMeta }> {
  const { passphrase, onProgress, maxPlainBytes = MAX_OPTICAL_PLAIN_BYTES } = options;
  const meta = parseOpticalContainerHeader(container);

  if (meta.plainLen > maxPlainBytes) {
    throw new OpticalContainerError('too-large', 'Container declares an implausible payload size');
  }
  if (meta.encrypted && !passphrase) {
    throw new OpticalContainerError('needs-passphrase', 'This transfer is passphrase-protected');
  }
  if (!meta.encrypted && passphrase) {
    throw new OpticalContainerError(
      'unexpected-passphrase',
      'This transfer is not passphrase-protected'
    );
  }

  let body = container.subarray(OPTICAL_CONTAINER_HEADER_LEN);

  if (meta.encrypted) {
    onProgress?.('encrypting', 0);
    try {
      const key = deriveOpticalKey(passphrase as string, meta.kdfSalt, meta.kdfIterations);
      body = decryptOpticalBody(body, key, meta.cipherIv);
    } catch {
      // PKCS#7 unpadding rejects almost every wrong key, so this is the usual path for a typo.
      // The ~1-in-256 wrong key that unpads cleanly is caught by the SHA-256 check below.
      throw new OpticalContainerError('bad-passphrase', 'Wrong passphrase');
    }
    onProgress?.('encrypting', 1);
  }

  let plain = body;
  if (meta.gzip) {
    try {
      plain = await gunzipChunked(body, maxPlainBytes, {
        onProgress: (bytesOut) =>
          onProgress?.('compressing', meta.plainLen > 0 ? bytesOut / meta.plainLen : 0),
      });
    } catch (error) {
      // A wrong passphrase that survived unpadding produces noise, and noise is not valid gzip.
      throw meta.encrypted
        ? new OpticalContainerError('bad-passphrase', 'Wrong passphrase')
        : error;
    }
  }

  onProgress?.('hashing', 0);
  const digest = sha256(plain);
  if (plain.length !== meta.plainLen || !bytesEqual(digest, meta.sha256)) {
    // The authority on both integrity and passphrase correctness.
    throw new OpticalContainerError(
      meta.encrypted ? 'bad-passphrase' : 'checksum',
      'Payload failed its checksum'
    );
  }
  onProgress?.('hashing', 1);

  onProgress?.('encoding', 0);
  const json = utf8Decode(plain);
  onProgress?.('encoding', 1);

  return { json, meta };
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
