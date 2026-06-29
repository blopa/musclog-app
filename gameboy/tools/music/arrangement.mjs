import { makeTickToSeconds, parseMidi, pulsePeriod, wavePeriod } from './midi.mjs';

export const AUDIO_BANK = 9;
export const FRAME_RATE = 59.7275;
export const SFX_FRAMES = 6;

const DRUM_CHANNEL = 9;
const LEAD_MIN = 48;
const LEAD_MAX = 96;
const BASS_MIN = 24;
const BASS_MAX = 60;

const TARGET_LEAD = 0;
const TARGET_BASS = 1;
const TARGET_DRUM = 2;
export const TARGET_NOP = 0xff;

export const DRUM_KICK = 1;
export const DRUM_SNARE = 2;
const KICK_NOTES = new Set([35, 36]);
const SNARE_NOTES = new Set([38, 40]);

export function foldIntoRange(note, lo, hi) {
  let n = note;
  while (n < lo) n += 12;
  while (n > hi) n -= 12;
  return Math.max(lo, Math.min(hi, n));
}

export function monophonicStream(noteEvents, pick, lo, hi) {
  const boundaries = [...new Set(noteEvents.map((e) => e.frame))].sort((a, b) => a - b);
  const active = new Map();
  let eventIdx = 0;
  const stream = [];
  let lastEmitted = -1;

  for (const frame of boundaries) {
    while (eventIdx < noteEvents.length && noteEvents[eventIdx].frame === frame) {
      const event = noteEvents[eventIdx++];
      if (event.on) active.set(event.note, (active.get(event.note) || 0) + 1);
      else {
        const count = (active.get(event.note) || 0) - 1;
        if (count <= 0) active.delete(event.note);
        else active.set(event.note, count);
      }
    }

    const notes = [...active.keys()];
    const chosen = notes.length === 0 ? 0 : foldIntoRange(pick(notes), lo, hi);
    if (chosen !== lastEmitted) {
      stream.push({ frame, note: chosen });
      lastEmitted = chosen;
    }
  }

  return stream;
}

export function sampleStream(stream, cells, cellFrames) {
  const out = new Int16Array(cells);
  let streamIdx = 0;
  let current = 0;

  for (let cell = 0; cell < cells; cell++) {
    const frame = cell * cellFrames;
    while (streamIdx < stream.length && stream[streamIdx].frame <= frame) {
      current = stream[streamIdx++].note;
    }
    out[cell] = current;
  }

  return out;
}

export function detectLoop(lead, bass, totalFrames, frameRate = FRAME_RATE) {
  const cellFrames = 8;
  const threshold = 0.85;
  const cells = Math.floor(totalFrames / cellFrames);
  if (cells < 64) return null;

  const leadCells = sampleStream(lead, cells, cellFrames);
  const bassCells = sampleStream(bass, cells, cellFrames);
  const signature = new Int32Array(cells);
  for (let cell = 0; cell < cells; cell++) {
    signature[cell] = (leadCells[cell] << 7) | bassCells[cell];
  }

  const equal = (a, b) =>
    signature[a] === signature[b] ||
    (b > 0 && signature[a] === signature[b - 1]) ||
    (b + 1 < cells && signature[a] === signature[b + 1]);

  const minPeriod = Math.max(8, Math.round((6 * frameRate) / cellFrames));
  const maxPeriod = Math.floor(cells / 2);

  let period = 0;
  for (let candidate = maxPeriod; candidate >= minPeriod; candidate--) {
    let matches = 0;
    const comparisons = cells - candidate;
    for (let cell = 0; cell < comparisons; cell++) {
      if (equal(cell, cell + candidate)) matches++;
    }
    if (matches / comparisons >= threshold) {
      period = candidate;
      break;
    }
  }
  if (period === 0) return null;

  let startCell = 0;
  for (let start = 0; start + 2 * period <= cells; start++) {
    let matches = 0;
    for (let cell = 0; cell < period; cell++) {
      if (equal(start + cell, start + period + cell)) matches++;
    }
    if (matches / period >= threshold) {
      startCell = start;
      break;
    }
  }

  return {
    loopStartFrame: startCell * cellFrames,
    loopEndFrame: (startCell + period) * cellFrames,
  };
}

function noteFrameMapper(division, tempos) {
  const toSeconds = makeTickToSeconds(division, tempos);
  return (tick) => Math.round(toSeconds(tick) * FRAME_RATE);
}

function pitchedEvents(notes, toFrame) {
  return notes
    .filter((note) => note.channel !== DRUM_CHANNEL)
    .map((note) => ({ frame: toFrame(note.tick), on: note.on, note: note.note }))
    .sort((a, b) => a.frame - b.frame);
}

function drumEvents(notes, toFrame) {
  const drums = [];
  for (const note of notes) {
    if (note.channel !== DRUM_CHANNEL || !note.on) continue;
    if (KICK_NOTES.has(note.note)) drums.push({ frame: toFrame(note.tick), drum: DRUM_KICK });
    else if (SNARE_NOTES.has(note.note))
      drums.push({ frame: toFrame(note.tick), drum: DRUM_SNARE });
  }
  return drums;
}

function noteIndexer() {
  const noteIndex = new Map();
  const noteList = [];

  return {
    noteList,
    indexFor(midi) {
      if (!noteIndex.has(midi)) {
        noteIndex.set(midi, noteList.length + 1);
        noteList.push(midi);
      }
      return noteIndex.get(midi);
    },
  };
}

function encodeEvents(merged, loopStartFrame, wrapFrame) {
  const events = [];
  let loopIndex = 0;
  let loopIndexSet = false;

  for (let i = 0; i < merged.length; i++) {
    const event = merged[i];
    if (!loopIndexSet && event.frame >= loopStartFrame) {
      loopIndex = events.length;
      loopIndexSet = true;
    }

    const nextFrame = i + 1 < merged.length ? merged[i + 1].frame : wrapFrame;
    let gap = Math.max(0, nextFrame - event.frame);
    const first = Math.min(gap, 255);
    events.push([first, event.target, event.note]);
    gap -= first;

    while (gap > 0) {
      const chunk = Math.min(gap, 255);
      events.push([chunk, TARGET_NOP, 0]);
      gap -= chunk;
    }
  }

  if (events.length === 0) events.push([60, TARGET_NOP, 0]);
  return { events, loopIndex };
}

export function buildSong(buf) {
  const { division, tempos, notes } = parseMidi(buf);
  const toFrame = noteFrameMapper(division, tempos);
  const pitched = pitchedEvents(notes, toFrame);
  const lead = monophonicStream(pitched, (ns) => Math.max(...ns), LEAD_MIN, LEAD_MAX);
  const bass = monophonicStream(pitched, (ns) => Math.min(...ns), BASS_MIN, BASS_MAX);
  const drums = drumEvents(notes, toFrame);
  const indexer = noteIndexer();

  const merged = [];
  for (const event of lead) {
    merged.push({
      frame: event.frame,
      target: TARGET_LEAD,
      note: event.note === 0 ? 0 : indexer.indexFor(event.note),
    });
  }
  for (const event of bass) {
    merged.push({
      frame: event.frame,
      target: TARGET_BASS,
      note: event.note === 0 ? 0 : indexer.indexFor(event.note),
    });
  }
  for (const event of drums) {
    merged.push({ frame: event.frame, target: TARGET_DRUM, note: event.drum });
  }
  merged.sort((a, b) => a.frame - b.frame || a.target - b.target);

  const totalFrames = merged.length === 0 ? 0 : merged[merged.length - 1].frame;
  const loop = detectLoop(lead, bass, totalFrames);
  const loopStartFrame = loop ? loop.loopStartFrame : 0;
  const wrapFrame = loop ? loop.loopEndFrame : totalFrames + 60;
  const kept = loop ? merged.filter((event) => event.frame < loop.loopEndFrame) : merged;
  const { events, loopIndex } = encodeEvents(kept, loopStartFrame, wrapFrame);

  return {
    events,
    pulsePeriods: indexer.noteList.map(pulsePeriod),
    wavePeriods: indexer.noteList.map(wavePeriod),
    noteList: indexer.noteList,
    loopIndex,
    loopStartFrame,
    loopEndFrame: wrapFrame,
    totalFrames,
    hasLoop: Boolean(loop),
    leadCount: lead.length,
    bassCount: bass.length,
    drumCount: drums.length,
  };
}

export function buildSfx(buf) {
  const { notes } = parseMidi(buf);
  const first = notes.find((note) => note.on);
  if (!first) throw new Error('SFX MIDI contains no note-on event.');
  return { period: pulsePeriod(first.note), note: first.note };
}
