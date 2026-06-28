import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSfx, detectLoop, foldIntoRange, monophonicStream } from './arrangement.mjs';

function chunk(id, body) {
  const header = Buffer.alloc(8);
  header.write(id, 0, 4, 'ascii');
  header.writeUInt32BE(body.length, 4);
  return Buffer.concat([header, body]);
}

function tinyMidi(note) {
  return Buffer.concat([
    chunk('MThd', Buffer.from([0x00, 0x01, 0x00, 0x01, 0x00, 0x60])),
    chunk(
      'MTrk',
      Buffer.from([0x00, 0x90, note, 64, 0x10, 0x80, note, 64, 0x00, 0xff, 0x2f, 0x00])
    ),
  ]);
}

function repeatingStream(pattern, repeats, cellFrames = 8) {
  const stream = [];
  let previous = -1;
  for (let repeat = 0; repeat !== repeats; repeat++) {
    for (let cell = 0; cell !== pattern.length; cell++) {
      const note = pattern[cell];
      if (note !== previous) {
        stream.push({ frame: (repeat * pattern.length + cell) * cellFrames, note });
        previous = note;
      }
    }
  }
  return stream;
}

test('foldIntoRange folds notes by octave instead of dropping them', () => {
  assert.equal(foldIntoRange(36, 48, 60), 48);
  assert.equal(foldIntoRange(84, 48, 60), 60);
});

test('monophonicStream emits only changes in the selected active note', () => {
  const stream = monophonicStream(
    [
      { frame: 0, on: true, note: 55 },
      { frame: 0, on: true, note: 67 },
      { frame: 8, on: false, note: 67 },
      { frame: 16, on: false, note: 55 },
    ],
    (notes) => Math.max(...notes),
    48,
    72
  );

  assert.deepEqual(stream, [
    { frame: 0, note: 67 },
    { frame: 8, note: 55 },
    { frame: 16, note: 0 },
  ]);
});

test('detectLoop finds a clean repeating body', () => {
  const pattern = Array.from({ length: 64 }, (_, index) => (index < 32 ? 60 : 62));
  const lead = repeatingStream(pattern, 2);
  const bass = repeatingStream(
    pattern.map((note) => note - 24),
    2
  );

  assert.deepEqual(detectLoop(lead, bass, 64 * 2 * 8), {
    loopStartFrame: 0,
    loopEndFrame: 512,
  });
});

test('buildSfx takes the first note-on as the UI blip pitch', () => {
  assert.deepEqual(buildSfx(tinyMidi(81)), { period: 1899, note: 81 });
});
