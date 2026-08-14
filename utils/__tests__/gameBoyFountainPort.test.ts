import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ErrorCorrectionLevel from '@zxing/library/cjs/core/qrcode/decoder/ErrorCorrectionLevel';
import Version from '@zxing/library/cjs/core/qrcode/decoder/Version';

import gameBoyOpticalProtocol from '@/data/gameBoyOpticalProtocol.json';
import { dlog, frameIndices, frameSeed, solitonCdf } from '@/utils/optical/fountain';
import { splitmix32 } from '@/utils/optical/frameProtocol';
import { alphanumericCapacity } from '@/utils/optical/qrEncode';

const Q12 = 4096;
const Q24 = 16_777_216;

function q12Multiply(a: number, b: number): number {
  const negative = a < 0 !== b < 0;
  const value = Math.trunc((Math.abs(a) * Math.abs(b) + Q12 / 2) / Q12);
  return negative ? -value : value;
}

function fixedLog(x: number): number {
  let exponent = 0;
  let mantissa = x;
  while (mantissa >= 6144) {
    mantissa = Math.trunc(mantissa / 2);
    exponent++;
  }
  while (mantissa < 3072) {
    mantissa *= 2;
    exponent--;
  }

  let z = Math.trunc((Math.abs(mantissa - Q12) * Q12) / (mantissa + Q12));
  if (mantissa < Q12) z = -z;
  const zSquared = q12Multiply(z, z);
  let term = z;
  let sum = 0;
  for (let n = 1; n <= 21; n += 2) {
    sum += Math.trunc(term / n);
    term = q12Multiply(term, zSquared);
  }
  return exponent * 2839 + 2 * sum;
}

function gameBoyIndices(k: number, sessionId: number, seq: number): number[] | null {
  const random = splitmix32(frameSeed(sessionId, seq));
  if (k === 1) {
    random();
    return [0];
  }

  const log = fixedLog(k * 2 * Q12);
  const squareRoot = Math.floor(Math.sqrt(k * Q12)) * 64;
  const r = Math.max(Q12, q12Multiply(q12Multiply(410, log), squareRoot));
  const spike = Math.min(k, Math.ceil((k * Q12) / r));
  const weight = (degree: number): number => {
    const rho = degree === 1 ? Math.trunc(Q24 / k) : Math.trunc(Q24 / (degree * (degree - 1)));
    let tau = 0;
    if (degree < spike) {
      tau = Math.trunc((r * Q12) / (degree * k));
    } else if (degree === spike) {
      const value = fixedLog(r * 2);
      if (value > 0) tau = Math.trunc((q12Multiply(r, value) * Q12) / k);
    }
    return rho + tau;
  };

  let total = 0;
  for (let degree = 1; degree <= k; degree++) total += weight(degree);
  const target = Math.trunc(total / Q12) * (random() >>> 20);
  let cumulative = 0;
  let degree = 0;
  for (let candidate = 1; candidate <= k; candidate++) {
    cumulative += weight(candidate);
    if (Math.abs(cumulative - target) < Math.trunc(total / 100)) return null;
    if (cumulative >= target) {
      degree = candidate;
      break;
    }
  }
  if (degree === 0 || degree > 64 || degree > 255) return null;

  const selected: number[] = [];
  if (degree > k >> 3) {
    if (k > 64) return null;
    const scratch = Array.from({ length: k }, (_, index) => index);
    for (let i = 0; i < degree; i++) {
      const j = i + (random() % (k - i));
      [scratch[i], scratch[j]] = [scratch[j], scratch[i]];
      selected.push(scratch[i]);
    }
  } else {
    const unique = new Set<number>();
    while (unique.size < degree) unique.add(random() % k);
    selected.push(...unique);
  }
  return selected.sort((a, b) => a - b);
}

function gfMultiply(left: number, right: number): number {
  let result = 0;
  let y = right;
  for (let bit = 0; bit < 8; bit++) {
    result = ((result << 1) ^ ((result & 0x80) === 0 ? 0 : 0x11d)) & 0xff;
    if ((y & 0x80) !== 0) result ^= left;
    y = (y << 1) & 0xff;
  }
  return result;
}

function expectedRsProducts(degree: number): number[] {
  const divisor = Array.from({ length: degree }, () => 0);
  divisor[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      divisor[j] = gfMultiply(divisor[j], root);
      if (j + 1 < degree) divisor[j] ^= divisor[j + 1];
    }
    root = gfMultiply(root, 2);
  }
  return Array.from({ length: 256 }, (_, factor) =>
    divisor.map((coefficient) => gfMultiply(coefficient, factor))
  ).flat();
}

describe('Game Boy optical wire port', () => {
  it('only emits fixed-point frames whose indices match the frozen JS decoder', () => {
    const sessionId = 0x4321;
    for (const k of [1, 2, 7, 32, 100, 256, 512]) {
      const cdf = solitonCdf(k);
      let emitted = 0;
      for (let seq = 0; seq < 3000; seq++) {
        const indexes = gameBoyIndices(k, sessionId, seq);
        if (!indexes) continue;
        expect(indexes).toEqual(frameIndices(k, cdf, sessionId, seq).sort((a, b) => a - b));
        emitted++;
      }
      expect(emitted).toBeGreaterThan(1000);
    }
  });

  it('keeps the C transport constants compatible with the app receiver', () => {
    const root = join(__dirname, '..', '..');
    const exportHeader = readFileSync(
      join(root, 'gameboy/src/features/optical/optical_export.h'),
      'utf8'
    );
    const generatedProtocol = readFileSync(
      join(root, 'gameboy/src/generated/optical_protocol.generated.h'),
      'utf8'
    );
    const fountainSource = readFileSync(
      join(root, 'gameboy/src/features/optical/fountain.c'),
      'utf8'
    );
    const qrHeader = readFileSync(join(root, 'gameboy/src/features/optical/qrcodegen.h'), 'utf8');
    const opticalShareSource = readFileSync(
      join(root, 'gameboy/src/features/optical/optical_share.c'),
      'utf8'
    );
    const textUiSource = readFileSync(join(root, 'gameboy/src/ui/ui_text.c'), 'utf8');
    const rsProducts = readFileSync(
      join(root, 'gameboy/src/features/optical/qr_rs_products.generated.h'),
      'utf8'
    );
    const qrSource = readFileSync(join(root, 'gameboy/src/features/optical/qrcodegen.c'), 'utf8');

    expect(exportHeader).toContain('#include "optical_protocol.generated.h"');
    expect(generatedProtocol).toContain(
      `#define OPTICAL_EXPORT_DATABASE_VERSION ${gameBoyOpticalProtocol.databaseExportVersion}u`
    );
    expect(generatedProtocol).toContain(
      `#define OPTICAL_EXPORT_SCHEMA_VERSION ${gameBoyOpticalProtocol.gameBoyExportVersion}u`
    );
    expect(exportHeader).toContain('#define OPTICAL_CONTAINER_HEADER_LEN 92u');
    expect(exportHeader).toContain('#define OPTICAL_FOUNTAIN_BLOCK_LEN 292u');
    expect(exportHeader).toContain('#define OPTICAL_SRAM_CACHE_BLOCKS 12u');
    expect(fountainSource).toContain('frame[0] = 0xD1u;');
    expect(fountainSource).toContain('frame[1] = 0x0Cu;');
    expect(fountainSource).toContain('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$%*+-./:');
    expect(qrHeader).toContain('#define QRVERSION 11');
    expect(qrHeader).toContain('#define QR_MAX_ALPHANUMERIC_CHARS 468u');
    expect(qrSource).toContain('#define ECC_CODEWORDS_PER_BLOCK 20u');
    expect(qrSource).toContain('#define NUM_ERROR_CORRECTION_BLOCKS 4u');
    expect(qrSource).toContain('terminatorBits = dataCapacityBits - bitLen;');
    expect(opticalShareSource).toMatch(
      /DISPLAY_OFF;\s*\/\*[\s\S]*?\*\/\s*LCDC_REG \|= LCDCF_BG8000;\s*set_bkg_palette/
    );
    expect(opticalShareSource).toContain('tile_bank ? S_BANK : 0u');
    expect(opticalShareSource).toContain('cpu_fast();');
    expect(opticalShareSource).toContain('cpu_slow();');
    expect(opticalShareSource).toContain('STR_STOP_SHARING');
    expect(textUiSource).toMatch(
      /void ui_init_text\(void\)[\s\S]*?DISPLAY_OFF;\s*LCDC_REG &= \(uint8_t\)\(~LCDCF_BG8000\);/
    );
    const generatedProducts = [...rsProducts.matchAll(/0x([0-9a-f]{2})u/g)].map((match) =>
      Number.parseInt(match[1], 16)
    );
    expect(rsProducts).toContain('#define QR_RS_DEGREE 20u');
    expect(generatedProducts).toEqual(expectedRsProducts(20));
    const version = Version.getVersionForNumber(11);
    const ecBlocks = version.getECBlocksForLevel(ErrorCorrectionLevel.L);
    expect(ecBlocks.getECCodewordsPerBlock()).toBe(20);
    expect(ecBlocks.getNumBlocks()).toBe(4);
    expect(version.getTotalCodewords() - ecBlocks.getTotalECCodewords()).toBe(324);
    expect(324 * 8 - (4 + 11 + (468 / 2) * 11)).toBe(3);
    expect(alphanumericCapacity(11, 'L')).toBe(468);
    expect((20 + 292) * 1.5).toBe(468);
    expect(0x0b00 + 61 * 8).toBeLessThanOrEqual(0x0d00);
    expect(0x0d00 + 61 * 8).toBeLessThanOrEqual(0x0f00);
    expect(0x0f00 + 20 + 292).toBeLessThanOrEqual(0x1040);
    expect(0x1040 + 468).toBeLessThanOrEqual(0x1250);
    expect(0x1250 + 12 * 292).toBe(0x2000);
  });

  it('retains the deterministic log approximation used by the frozen receiver', () => {
    for (const value of [1, 2, 7.5, 64, 1024]) {
      expect(dlog(value)).toBeCloseTo(Math.log(value), 12);
    }
  });
});
