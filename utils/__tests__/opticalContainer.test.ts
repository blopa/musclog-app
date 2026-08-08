/**
 * The payload pipeline: UTF-8 ⇄ bytes, gzip, optional AES, and the MLOG container around them.
 *
 * The properties worth defending here are mostly about *refusing* things: a container from a
 * newer app, a hostile declared length, a wrong passphrase, a corrupted byte. Everything that
 * reaches `restoreDatabase` wipes the receiving phone, so "fails loudly" is the requirement.
 */

import {
  MAX_OPTICAL_PLAIN_BYTES,
  OPTICAL_CONTAINER_HEADER_LEN,
  OPTICAL_CONTAINER_VERSION,
  OpticalContainerError,
  packOpticalContainer,
  parseOpticalContainerHeader,
  readExportVersion,
  unpackOpticalContainer,
} from '@/utils/optical/container';
import { gunzipChunked, gzipChunked, OpticalInflateTooLargeError } from '@/utils/optical/gzip';
import { sha256 } from '@/utils/optical/passphrase';
import { utf8Decode, utf8Encode } from '@/utils/optical/utf8';

const sampleDump = (rows = 200) =>
  JSON.stringify(
    {
      _exportVersion: 24,
      _exportPlatform: 'android',
      nutrition_logs: Array.from({ length: rows }, (_, i) => ({
        id: `row-${i}`,
        calories: 100 + i,
        name: 'Chicken breast, grilled',
        date: 1754000000000 + i * 1000,
      })),
    },
    null,
    2
  );

describe('utf8', () => {
  it('round-trips ASCII, accents, CJK and emoji', () => {
    const cases = [
      '',
      'plain ascii',
      'café — résumé',
      '日本語のテキスト',
      '🏋️‍♀️ 🥗 👨‍👩‍👧‍👦',
      'mixed: a¢€𝄞 end',
    ];
    for (const text of cases) {
      expect(utf8Decode(utf8Encode(text))).toBe(text);
    }
  });

  it('handles astral-plane characters across the internal chunk boundary', () => {
    // The decoder emits UTF-16 units in fixed chunks; a surrogate pair split across a flush would
    // corrupt silently. 4095 filler chars puts the pair exactly on the seam.
    for (const padding of [4094, 4095, 4096, 4097]) {
      const text = `${'a'.repeat(padding)}𝄞${'b'.repeat(10)}`;
      expect(utf8Decode(utf8Encode(text))).toBe(text);
    }
  });

  it('round-trips a payload larger than the chunk size', () => {
    const text = sampleDump(2000);
    expect(text.length).toBeGreaterThan(50_000);
    expect(utf8Decode(utf8Encode(text))).toBe(text);
  });

  it('does not read past the end of a truncated sequence', () => {
    // Never expected — SHA-256 gates this — but it must not produce NaN code units.
    const truncated = utf8Encode('é').subarray(0, 1);
    expect(() => utf8Decode(truncated)).not.toThrow();
    expect(utf8Decode(truncated)).not.toContain('NaN');
  });
});

describe('gzip', () => {
  it('round-trips exactly', async () => {
    const plain = utf8Encode(sampleDump());
    const gz = await gzipChunked(plain);
    expect(await gunzipChunked(gz, MAX_OPTICAL_PLAIN_BYTES)).toEqual(plain);
  });

  it('compresses a real-shaped dump substantially', async () => {
    // ~9x is what a real export achieves; anything near 1x means something changed upstream.
    const plain = utf8Encode(sampleDump(2000));
    const gz = await gzipChunked(plain);
    expect(plain.length / gz.length).toBeGreaterThan(4);
  });

  it('round-trips an empty and a tiny input', async () => {
    for (const plain of [new Uint8Array(0), Uint8Array.from([1, 2, 3])]) {
      const gz = await gzipChunked(plain);
      expect(await gunzipChunked(gz, 1024)).toEqual(plain);
    }
  });

  it('round-trips across the internal slice boundary', async () => {
    // 256 KB slices; a payload straddling one must not lose or duplicate bytes.
    const plain = new Uint8Array(600 * 1024);
    for (let i = 0; i < plain.length; i++) {
      plain[i] = (i * 31) & 0xff;
    }
    const gz = await gzipChunked(plain);
    expect(await gunzipChunked(gz, plain.length)).toEqual(plain);
  });

  it('aborts an inflate that exceeds the caller’s ceiling', async () => {
    // The bytes arrived over an open optical channel, so gzip's declared size is a hint and the
    // real defence is counting output as it lands.
    const bomb = await gzipChunked(new Uint8Array(2 * 1024 * 1024));
    expect(bomb.length).toBeLessThan(64 * 1024);
    await expect(gunzipChunked(bomb, 64 * 1024)).rejects.toBeInstanceOf(
      OpticalInflateTooLargeError
    );
  });
});

describe('container round trip', () => {
  it('recovers the dump exactly, unencrypted', async () => {
    const json = sampleDump();
    const { container, meta } = await packOpticalContainer(json);

    expect(meta.gzip).toBe(true);
    expect(meta.encrypted).toBe(false);
    expect(meta.exportVersion).toBe(24);
    expect(container.length).toBe(OPTICAL_CONTAINER_HEADER_LEN + meta.bodyLen);

    const unpacked = await unpackOpticalContainer(container);
    expect(unpacked.json).toBe(json);
  });

  it('recovers the dump exactly with a passphrase', async () => {
    const json = sampleDump();
    // Low iteration count: crypto-js PBKDF2 is interpreted, and this runs twice per case.
    const { container, meta } = await packOpticalContainer(json, {
      passphrase: 'correct horse battery staple',
      kdfIterations: 64,
    });

    expect(meta.encrypted).toBe(true);
    expect(meta.gzip).toBe(true);

    const unpacked = await unpackOpticalContainer(container, {
      passphrase: 'correct horse battery staple',
    });
    expect(unpacked.json).toBe(json);
  });

  it('compresses before encrypting', async () => {
    // The ordering the whole design depends on: ciphertext is incompressible, so encrypting first
    // would cost ~9x the transfer time. An encrypted container must still be far smaller than the
    // plaintext it carries.
    const json = sampleDump(2000);
    const { container } = await packOpticalContainer(json, {
      passphrase: 'pw',
      kdfIterations: 64,
    });
    expect(container.length).toBeLessThan(utf8Encode(json).length / 3);
  });

  it('skips gzip when it would not help', async () => {
    // A tiny payload pays gzip's framing for nothing.
    const { meta } = await packOpticalContainer('{"a":1}');
    expect(meta.gzip).toBe(false);
    expect(meta.plainLen).toBe(7);
  });

  it('preserves non-ASCII content through the whole pipeline', async () => {
    const json = JSON.stringify({ _exportVersion: 24, note: 'café 日本語 🏋️ résumé' });
    const { container } = await packOpticalContainer(json, { passphrase: 'x', kdfIterations: 64 });
    expect((await unpackOpticalContainer(container, { passphrase: 'x' })).json).toBe(json);
  });

  it('records the header fields it advertises', async () => {
    const { container } = await packOpticalContainer(sampleDump(), {
      nowMs: 1_754_000_000_000,
      exportVersion: 24,
    });
    const meta = parseOpticalContainerHeader(container);

    expect(meta.containerVersion).toBe(OPTICAL_CONTAINER_VERSION);
    expect(meta.createdAtSec).toBe(1_754_000_000);
    expect(meta.exportVersion).toBe(24);
    expect(meta.sha256).toEqual(sha256(utf8Encode(sampleDump())));
  });
});

describe('container rejection', () => {
  const packed = () => packOpticalContainer(sampleDump());

  it('rejects bytes that are not ours', async () => {
    const { container } = await packed();
    const wrongMagic = container.slice();
    wrongMagic[0] = 0x00;

    expect(() => parseOpticalContainerHeader(wrongMagic)).toThrow(OpticalContainerError);
    expect(() => parseOpticalContainerHeader(wrongMagic)).toThrow(/Musclog optical container/);
    expect(() => parseOpticalContainerHeader(new Uint8Array(10))).toThrow(
      /shorter than its header/
    );
  });

  it('rejects a container from a newer app rather than guessing', async () => {
    const { container } = await packed();
    const future = container.slice();
    future[4] = OPTICAL_CONTAINER_VERSION + 1;

    try {
      parseOpticalContainerHeader(future);
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as OpticalContainerError).code).toBe('unsupported-version');
    }
  });

  it('rejects a header whose declared body length disagrees with the bytes', async () => {
    const { container } = await packed();
    const truncated = container.slice(0, container.length - 1);

    try {
      parseOpticalContainerHeader(truncated);
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as OpticalContainerError).code).toBe('bad-length');
    }
  });

  it('rejects an implausible declared payload size before allocating', async () => {
    const { container } = await packed();
    const huge = container.slice();
    new DataView(huge.buffer).setUint32(12, MAX_OPTICAL_PLAIN_BYTES + 1, true);

    await expect(unpackOpticalContainer(huge)).rejects.toMatchObject({ code: 'too-large' });
  });

  it('distinguishes "needs a passphrase" from "corrupt"', async () => {
    // Load-bearing for the UI: one re-prompts with the container still in memory, the other
    // means rescanning the whole stream.
    const { container } = await packOpticalContainer(sampleDump(), {
      passphrase: 'right',
      kdfIterations: 64,
    });

    await expect(unpackOpticalContainer(container)).rejects.toMatchObject({
      code: 'needs-passphrase',
    });
    await expect(unpackOpticalContainer(container, { passphrase: 'wrong' })).rejects.toMatchObject({
      code: 'bad-passphrase',
    });
  });

  it('reports a passphrase on an unencrypted container rather than ignoring it', async () => {
    const { container } = await packed();
    await expect(unpackOpticalContainer(container, { passphrase: 'x' })).rejects.toMatchObject({
      code: 'unexpected-passphrase',
    });
  });

  it('catches a corrupted body with the checksum', async () => {
    // The gate that stops damaged bytes from ever reaching restoreDatabase().
    const { container } = await packed();
    const corrupted = container.slice();
    corrupted[corrupted.length - 20] ^= 0xff;

    await expect(unpackOpticalContainer(corrupted)).rejects.toBeInstanceOf(OpticalContainerError);
  });

  it('catches a corrupted body even when gzip happens to survive it', async () => {
    // An uncompressible payload skips gzip, so only SHA-256 stands between a flipped bit and the
    // database. Flip one and confirm it is caught.
    const json = `{"_exportVersion":24,"blob":"${'x'.repeat(40)}"}`;
    const { container, meta } = await packOpticalContainer(json);
    expect(meta.gzip).toBe(false);

    const corrupted = container.slice();
    corrupted[OPTICAL_CONTAINER_HEADER_LEN + 5] ^= 0xff;

    await expect(unpackOpticalContainer(corrupted)).rejects.toMatchObject({ code: 'checksum' });
  });
});

describe('readExportVersion', () => {
  it('lifts the version without parsing the dump', () => {
    expect(readExportVersion('{\n  "_exportVersion": 24,\n  "foo": 1\n}')).toBe(24);
    expect(readExportVersion('{"_exportVersion":7}')).toBe(7);
  });

  it('returns 0 when it cannot find one', () => {
    expect(readExportVersion('{}')).toBe(0);
    // Beyond the window it scans — the field is written first, so this cannot happen for a real
    // dump, and guessing from deep in the file would be worse than reporting nothing.
    expect(readExportVersion(`{"pad":"${'x'.repeat(600)}","_exportVersion":24}`)).toBe(0);
  });
});
