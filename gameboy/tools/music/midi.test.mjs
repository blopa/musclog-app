import assert from 'node:assert/strict';
import { test } from 'node:test';

import { makeTickToSeconds, parseMidi, pulsePeriod, readVarLen, wavePeriod } from './midi.mjs';

function chunk(id, body) {
  const header = Buffer.alloc(8);
  header.write(id, 0, 4, 'ascii');
  header.writeUInt32BE(body.length, 4);
  return Buffer.concat([header, body]);
}

function vlq(value) {
  const bytes = [value & 0x7f];
  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7f) | 0x80);
    value >>= 7;
  }
  return Buffer.from(bytes);
}

function midi(trackBody) {
  return Buffer.concat([
    chunk('MThd', Buffer.from([0x00, 0x01, 0x00, 0x01, 0x00, 0x60])),
    chunk('MTrk', trackBody),
  ]);
}

test('readVarLen decodes MIDI variable-length quantities', () => {
  assert.deepEqual(readVarLen(Buffer.from([0x81, 0x00]), 0), { value: 128, pos: 2 });
  assert.deepEqual(readVarLen(Buffer.from([0x7f]), 0), { value: 127, pos: 1 });
});

test('parseMidi handles tempo, running status, note-on zero velocity, and note-off', () => {
  const parsed = parseMidi(
    midi(
      Buffer.concat([
        Buffer.from([0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20]),
        Buffer.from([0x00, 0x90, 60, 64]),
        Buffer.concat([vlq(48), Buffer.from([62, 64])]),
        Buffer.from([0x00, 60, 0]),
        Buffer.from([0x00, 0x80, 62, 64]),
        Buffer.from([0x00, 0xff, 0x2f, 0x00]),
      ])
    )
  );

  assert.equal(parsed.division, 96);
  assert.deepEqual(parsed.tempos, [{ tick: 0, usPerQuarter: 500000 }]);
  assert.deepEqual(parsed.notes, [
    { tick: 0, on: true, channel: 0, note: 60 },
    { tick: 48, on: true, channel: 0, note: 62 },
    { tick: 48, on: false, channel: 0, note: 60 },
    { tick: 48, on: false, channel: 0, note: 62 },
  ]);
});

test('makeTickToSeconds honours tempo changes', () => {
  const toSeconds = makeTickToSeconds(100, [
    { tick: 0, usPerQuarter: 500000 },
    { tick: 100, usPerQuarter: 1000000 },
  ]);

  assert.equal(toSeconds(100), 0.5);
  assert.equal(toSeconds(150), 1.0);
});

test('period helpers clamp into the Game Boy 11-bit range', () => {
  assert.equal(pulsePeriod(81), 1899);
  assert.ok(wavePeriod(20) >= 1);
  assert.ok(wavePeriod(20) <= 2047);
});
