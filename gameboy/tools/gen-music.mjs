// Converts the bundled Standard MIDI Files into Game Boy APU data tables.
//
// Source:
//   - gameboy/assets/beep_sfx.mid                 -> the UI confirm/select blip
//   - gameboy/assets/E2M9_Cammy_-_Cookie_Fangs.mid -> the title-screen soundtrack
//
// WHY THIS EXISTS
//   A Game Boy cannot play MIDI. Its APU has four fixed channels (two pulse, one
//   wave, one noise) and no concept of a MIDI stream. So at build time we parse
//   the SMFs and *reduce* them to something the four channels can actually play:
//
//     - SFX  : a single pulse blip. We take the one note in beep_sfx.mid and emit
//              its pitch as an 11-bit pulse period (MUSIC_SFX_PERIOD).
//     - Music: the 13-track Doom song is reduced to three voices —
//                lead  (highest sounding pitched note)  -> pulse channel 2
//                bass  (lowest sounding pitched note)   -> wave  channel 3
//                drums (a subset of GM percussion)      -> noise channel 4
//              quantised to ~59.73 Hz video frames and emitted as a delta-time
//              event stream the runtime player (audio.c) steps once per frame.
//
//   The generated files are committed so the ROM build has no MIDI dependency.
//   Re-run with `npm run gb:gen-music` if either .mid changes.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..', '..');
const assetsDir = join(repoRoot, 'gameboy', 'assets');
const outDir = join(repoRoot, 'gameboy', 'src');

const SFX_FILE = 'beep_sfx.mid';
const SONG_FILE = 'E2M9_Cammy_-_Cookie_Fangs.mid';

// The audio code and this data share one ROM bank so the player reads the tables
// directly (it is a BANKED function, so its bank is mapped while it runs).
const AUDIO_BANK = 9;

// Game Boy LCD frame rate. The player advances one event-stream step per frame.
const FRAME_RATE = 59.7275;

// GM percussion lives on MIDI channel 10 (0-indexed channel 9).
const DRUM_CHANNEL = 9;

// Playable pitch windows (MIDI note numbers). Notes outside the window are folded
// by whole octaves until they fit, so nothing drops out of the arrangement.
const LEAD_MIN = 48; // C3
const LEAD_MAX = 96; // C7
const BASS_MIN = 24; // C1 (the wave channel reaches an octave lower than pulse)
const BASS_MAX = 60; // C4

// Drum stream: only the kick/snare backbone is kept. Hi-hats fire too densely to
// be worth the ROM and muddy a single noise channel.
const DRUM_KICK = 1;
const DRUM_SNARE = 2;
const KICK_NOTES = new Set([35, 36]); // Acoustic/Bass drum
const SNARE_NOTES = new Set([38, 40]); // Acoustic/Electric snare

// SFX blip length, in video frames — short and snappy for UI feedback.
const SFX_FRAMES = 6;

function readVarLen(buf, pos) {
    let value = 0;
    let p = pos;
    for (;;) {
        const byte = buf[p++];
        value = (value << 7) | (byte & 0x7f);
        if ((byte & 0x80) === 0) break;
    }
    return { value, pos: p };
}

// Parse a Standard MIDI File into a tempo map and a flat list of note events.
function parseMidi(buf) {
    if (buf.toString('ascii', 0, 4) !== 'MThd') {
        throw new Error('Not a Standard MIDI File (missing MThd).');
    }
    const division = buf.readUInt16BE(12);
    if (division & 0x8000) {
        throw new Error('SMPTE time division is not supported.');
    }
    const trackCount = buf.readUInt16BE(10);

    const tempos = []; // { tick, usPerQuarter }
    const notes = []; // { tick, on, channel, note }

    let pos = 14;
    for (let t = 0; t < trackCount; t++) {
        if (buf.toString('ascii', pos, pos + 4) !== 'MTrk') {
            throw new Error(`Expected MTrk chunk at byte ${pos}.`);
        }
        const len = buf.readUInt32BE(pos + 4);
        pos += 8;
        const end = pos + len;

        let tick = 0;
        let status = 0;
        while (pos < end) {
            const dt = readVarLen(buf, pos);
            tick += dt.value;
            pos = dt.pos;

            let byte = buf[pos];
            if (byte & 0x80) {
                status = byte;
                pos++;
            } // else running status: reuse previous status, byte is data

            if (status === 0xff) {
                const type = buf[pos++];
                const ml = readVarLen(buf, pos);
                pos = ml.pos;
                if (type === 0x51 && ml.value === 3) {
                    tempos.push({
                        tick,
                        usPerQuarter: (buf[pos] << 16) | (buf[pos + 1] << 8) | buf[pos + 2],
                    });
                }
                pos += ml.value;
            } else if (status === 0xf0 || status === 0xf7) {
                const sl = readVarLen(buf, pos);
                pos = sl.pos + sl.value;
            } else {
                const high = status & 0xf0;
                const channel = status & 0x0f;
                if (high === 0x90) {
                    const note = buf[pos++];
                    const velocity = buf[pos++];
                    notes.push({ tick, on: velocity > 0, channel, note });
                } else if (high === 0x80) {
                    const note = buf[pos++];
                    pos++; // release velocity
                    notes.push({ tick, on: false, channel, note });
                } else if (high === 0xc0 || high === 0xd0) {
                    pos += 1; // single data byte
                } else {
                    pos += 2; // two data bytes (CC, pitch bend, aftertouch, …)
                }
            }
        }
        pos = end;
    }

    if (tempos.length === 0 || tempos[0].tick !== 0) {
        tempos.unshift({ tick: 0, usPerQuarter: 500000 }); // default 120 BPM
    }
    tempos.sort((a, b) => a.tick - b.tick);

    return { division, tempos, notes };
}

// Build a tick -> seconds mapping that honours every tempo change.
function makeTickToSeconds(division, tempos) {
    const cum = [{ tick: 0, seconds: 0, usPerQuarter: tempos[0].usPerQuarter }];
    for (let i = 1; i < tempos.length; i++) {
        const prev = cum[i - 1];
        const dTicks = tempos[i].tick - tempos[i - 1].tick;
        cum.push({
            tick: tempos[i].tick,
            seconds: prev.seconds + (dTicks * prev.usPerQuarter) / division / 1e6,
            usPerQuarter: tempos[i].usPerQuarter,
        });
    }
    return (tick) => {
        let seg = cum[0];
        for (let i = 1; i < cum.length; i++) {
            if (cum[i].tick <= tick) seg = cum[i];
            else break;
        }
        return seg.seconds + ((tick - seg.tick) * seg.usPerQuarter) / division / 1e6;
    };
}

function midiToFreq(note) {
    return 440 * 2 ** ((note - 69) / 12);
}

// 11-bit pulse-channel period: freq = 131072 / (2048 - period).
function pulsePeriod(note) {
    const p = Math.round(2048 - 131072 / midiToFreq(note));
    return Math.max(1, Math.min(2047, p));
}

// 11-bit wave-channel period: freq = 65536 / (2048 - period) (an octave below a
// pulse with the same period, so it is computed independently for true pitch).
function wavePeriod(note) {
    const p = Math.round(2048 - 65536 / midiToFreq(note));
    return Math.max(1, Math.min(2047, p));
}

function foldIntoRange(note, lo, hi) {
    let n = note;
    while (n < lo) n += 12;
    while (n > hi) n -= 12;
    return Math.max(lo, Math.min(hi, n));
}

// Turn note on/off events into a monophonic stream of (frame, note) changes,
// picking the highest (lead) or lowest (bass) note sounding at each instant.
function monophonicStream(noteEvents, toFrame, pick, lo, hi) {
    const boundaries = [...new Set(noteEvents.map((e) => e.frame))].sort((a, b) => a - b);
    const active = new Map(); // midi note -> count of overlapping voices
    let eventIdx = 0;
    const stream = [];
    let lastEmitted = -1;

    for (const frame of boundaries) {
        while (eventIdx < noteEvents.length && noteEvents[eventIdx].frame === frame) {
            const e = noteEvents[eventIdx++];
            if (e.on) active.set(e.note, (active.get(e.note) || 0) + 1);
            else {
                const c = (active.get(e.note) || 0) - 1;
                if (c <= 0) active.delete(e.note);
                else active.set(e.note, c);
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

// Sample a monophonic (frame, note) change stream into per-cell note values.
function sampleStream(stream, cells, cellFrames) {
    const out = new Int16Array(cells);
    let si = 0;
    let cur = 0;
    for (let c = 0; c < cells; c++) {
        const frame = c * cellFrames;
        while (si < stream.length && stream[si].frame <= frame) cur = stream[si++].note;
        out[c] = cur;
    }
    return out;
}

// "Smart" loop finder. Quantises the lead+bass arrangement into coarse cells and
// uses self-similarity (autocorrelation) to find a section that repeats, so the
// runtime can play any non-repeating intro once and then loop the body forever.
//
// Returns { loopStartFrame, loopEndFrame } — or null when nothing repeats cleanly,
// in which case the caller loops the whole song.
function detectLoop(lead, bass, totalFrames) {
    const CELL = 8; // frames per cell (~134 ms): smooths out small timing jitter
    const THRESHOLD = 0.85; // min fraction of matching cells to call it a repeat
    const cells = Math.floor(totalFrames / CELL);
    if (cells < 64) return null;

    const leadCells = sampleStream(lead, cells, CELL);
    const bassCells = sampleStream(bass, cells, CELL);
    const sig = new Int32Array(cells);
    for (let c = 0; c < cells; c++) sig[c] = (leadCells[c] << 7) | bassCells[c];

    // Jitter-tolerant cell equality: a cell matches if it equals its counterpart or
    // an immediate neighbour, so a repeat that drifts a frame or two still scores.
    // Both voices must match (the combined signature) — a track whose bass ostinato
    // repeats but whose lead is through-composed has no real full-arrangement loop
    // and must fall through to whole-song looping.
    const eq = (a, b) =>
        sig[a] === sig[b] ||
        (b > 0 && sig[a] === sig[b - 1]) ||
        (b + 1 < cells && sig[a] === sig[b + 1]);

    const minP = Math.max(8, Math.round((6 * FRAME_RATE) / CELL)); // loops of >= ~6s
    const maxP = Math.floor(cells / 2); // need at least two periods to confirm one

    // Largest period whose whole-song autocorrelation clears the threshold: prefer
    // a long musical loop over a short vamp, but only one that genuinely repeats.
    let period = 0;
    for (let P = maxP; P >= minP; P--) {
        let matches = 0;
        const n = cells - P;
        for (let c = 0; c < n; c++) if (eq(c, c + P)) matches++;
        if (matches / n >= THRESHOLD) {
            period = P;
            break;
        }
    }
    if (period === 0) return null;

    // Earliest start at which one period matches the period after it — i.e. where
    // the repeating body begins and the intro (if any) ends.
    let startCell = 0;
    for (let S = 0; S + 2 * period <= cells; S++) {
        let matches = 0;
        for (let c = 0; c < period; c++) if (eq(S + c, S + period + c)) matches++;
        if (matches / period >= THRESHOLD) {
            startCell = S;
            break;
        }
    }

    return { loopStartFrame: startCell * CELL, loopEndFrame: (startCell + period) * CELL };
}

function buildSong(buf) {
    const { division, tempos, notes } = parseMidi(buf);
    const toSeconds = makeTickToSeconds(division, tempos);
    const toFrame = (tick) => Math.round(toSeconds(tick) * FRAME_RATE);

    const pitched = notes
        .filter((n) => n.channel !== DRUM_CHANNEL)
        .map((n) => ({ frame: toFrame(n.tick), on: n.on, note: n.note }))
        .sort((a, b) => a.frame - b.frame);

    const lead = monophonicStream(pitched, toFrame, (ns) => Math.max(...ns), LEAD_MIN, LEAD_MAX);
    const bass = monophonicStream(pitched, toFrame, (ns) => Math.min(...ns), BASS_MIN, BASS_MAX);

    const drums = [];
    for (const n of notes) {
        if (n.channel !== DRUM_CHANNEL || !n.on) continue;
        if (KICK_NOTES.has(n.note)) drums.push({ frame: toFrame(n.tick), drum: DRUM_KICK });
        else if (SNARE_NOTES.has(n.note)) drums.push({ frame: toFrame(n.tick), drum: DRUM_SNARE });
    }

    // Assign a shared note-index table for every pitch the lead and bass use.
    const noteIndex = new Map(); // midi -> index (1-based; 0 means "note off")
    const noteList = [];
    const indexFor = (midi) => {
        if (!noteIndex.has(midi)) {
            noteIndex.set(midi, noteList.length + 1);
            noteList.push(midi);
        }
        return noteIndex.get(midi);
    };

    // Merge the three voices into one frame-sorted event list.
    // target: 0 = lead, 1 = bass, 2 = drum.
    const merged = [];
    for (const e of lead) merged.push({ frame: e.frame, target: 0, note: e.note === 0 ? 0 : indexFor(e.note) });
    for (const e of bass) merged.push({ frame: e.frame, target: 1, note: e.note === 0 ? 0 : indexFor(e.note) });
    for (const e of drums) merged.push({ frame: e.frame, target: 2, note: e.drum });
    merged.sort((a, b) => a.frame - b.frame || a.target - b.target);

    const totalFrames = merged.length === 0 ? 0 : merged[merged.length - 1].frame;
    const loop = detectLoop(lead, bass, totalFrames);

    // When a loop is found, trim everything past its end and jump back to its start
    // forever. Otherwise keep the whole song and loop it from the top.
    const loopStartFrame = loop ? loop.loopStartFrame : 0;
    const wrapFrame = loop ? loop.loopEndFrame : totalFrames + 60;
    const kept = loop ? merged.filter((e) => e.frame < loop.loopEndFrame) : merged;

    // Encode each event with a "wait-after" delta: apply the event, then wait
    // delta_frames before the next. Gaps over a byte are carried by NOP fillers.
    // The loop index marks the first event at/after the body start; on reaching the
    // end of the list the player wraps to it.
    const NOP = 0xff;
    const events = [];
    let loopIndex = 0;
    let loopIndexSet = false;
    for (let i = 0; i < kept.length; i++) {
        const e = kept[i];
        if (!loopIndexSet && e.frame >= loopStartFrame) {
            loopIndex = events.length;
            loopIndexSet = true;
        }
        const nextFrame = i + 1 < kept.length ? kept[i + 1].frame : wrapFrame;
        let gap = Math.max(0, nextFrame - e.frame);
        const first = Math.min(gap, 255);
        events.push([first, e.target, e.note]);
        gap -= first;
        while (gap > 0) {
            const chunk = Math.min(gap, 255);
            events.push([chunk, NOP, 0]);
            gap -= chunk;
        }
    }
    if (events.length === 0) events.push([60, NOP, 0]);

    const pulsePeriods = noteList.map(pulsePeriod);
    const wavePeriods = noteList.map(wavePeriod);

    return {
        events,
        pulsePeriods,
        wavePeriods,
        noteList,
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

function buildSfx(buf) {
    const { notes } = parseMidi(buf);
    const first = notes.find((n) => n.on);
    if (!first) throw new Error(`${SFX_FILE} contains no note-on event.`);
    return { period: pulsePeriod(first.note), note: first.note };
}

function periodTable(symbol, values) {
    const rows = [];
    for (let i = 0; i < values.length; i += 8) {
        rows.push('    ' + values.slice(i, i + 8).map((v) => `${v}u`).join(', ') + ',');
    }
    return `const uint16_t ${symbol}[MUSIC_NOTE_COUNT] = {\n${rows.join('\n')}\n};\n`;
}

function eventTable(events) {
    const rows = [];
    for (let i = 0; i < events.length; i += 6) {
        rows.push(
            '    ' +
                events
                    .slice(i, i + 6)
                    .map(([d, t, n]) => `{${d}u,${t}u,${n}u}`)
                    .join(', ') +
                ','
        );
    }
    return `const MusicEvent music_events[MUSIC_EVENT_COUNT] = {\n${rows.join('\n')}\n};\n`;
}

const sfx = buildSfx(readFileSync(join(assetsDir, SFX_FILE)));
const song = buildSong(readFileSync(join(assetsDir, SONG_FILE)));

const header = `/* Auto-generated by gameboy/tools/gen-music.mjs — do not edit by hand. */
/* Sources: gameboy/assets/${SFX_FILE}, gameboy/assets/${SONG_FILE}. */
#ifndef MUSCLOG_MUSIC_DATA_H
#define MUSCLOG_MUSIC_DATA_H

#include <stdint.h>

/* The audio runtime (audio.c) and these tables share this ROM bank. */
#define AUDIO_BANK ${AUDIO_BANK}

/* UI confirm/select blip: a single pulse note (from ${SFX_FILE}). */
#define MUSIC_SFX_PERIOD ${sfx.period}u   /* 11-bit pulse period (MIDI note ${sfx.note}) */
#define MUSIC_SFX_FRAMES ${SFX_FRAMES}u

/* One step of the soundtrack event stream. The player applies the event, then
 * waits \`delta_frames\` video frames before the next one ("wait-after"). target
 * 0 = lead (pulse 2), 1 = bass (wave 3), 2 = drum (noise 4), 255 = NOP (carries a
 * long gap). For lead/bass, \`value\` is a 1-based index into the period tables
 * (0 = note off); for drums it is 1 = kick, 2 = snare. */
typedef struct {
    uint8_t delta_frames;
    uint8_t target;
    uint8_t value;
} MusicEvent;

#define MUSIC_TARGET_LEAD 0u
#define MUSIC_TARGET_BASS 1u
#define MUSIC_TARGET_DRUM 2u
#define MUSIC_TARGET_NOP  255u

#define MUSIC_DRUM_KICK  1u
#define MUSIC_DRUM_SNARE 2u

#define MUSIC_NOTE_COUNT ${song.noteList.length}u
#define MUSIC_EVENT_COUNT ${song.events.length}u

/* Events before this index are a play-once intro; when the stream ends the player
 * wraps here, so events from this index on loop forever (a self-similarity scan in
 * gen-music.mjs found the repeating section). 0 = the whole song loops. */
#define MUSIC_LOOP_INDEX ${song.loopIndex}u

/* Period lookups shared by lead and bass, indexed by an event's 1-based value-1. */
extern const uint16_t music_pulse_periods[MUSIC_NOTE_COUNT];
extern const uint16_t music_wave_periods[MUSIC_NOTE_COUNT];
extern const MusicEvent music_events[MUSIC_EVENT_COUNT];

#endif /* MUSCLOG_MUSIC_DATA_H */
`;

const body = `/* Auto-generated by gameboy/tools/gen-music.mjs — do not edit by hand. */
/* Sources: gameboy/assets/${SFX_FILE}, gameboy/assets/${SONG_FILE}. */
#pragma bank ${AUDIO_BANK}
#include "music_data.h"

${periodTable('music_pulse_periods', song.pulsePeriods)}
${periodTable('music_wave_periods', song.wavePeriods)}
${eventTable(song.events)}`;

writeFileSync(join(outDir, 'music_data.h'), header);
writeFileSync(join(outDir, 'music_data.c'), body);

const loopMsg = song.hasLoop
    ? `loop ${(song.loopStartFrame / FRAME_RATE).toFixed(1)}s..${(song.loopEndFrame / FRAME_RATE).toFixed(1)}s ` +
      `(${((song.loopEndFrame - song.loopStartFrame) / FRAME_RATE).toFixed(1)}s body, intro ` +
      `${(song.loopStartFrame / FRAME_RATE).toFixed(1)}s, from ${(song.totalFrames / FRAME_RATE).toFixed(1)}s source), ` +
      `loop index ${song.loopIndex}`
    : `no clean loop found — whole ${(song.totalFrames / FRAME_RATE).toFixed(1)}s song loops`;

console.log(
    `Wrote music_data.{c,h}: SFX period ${sfx.period} (note ${sfx.note}); ` +
        `song ${song.events.length} events, ${song.noteList.length} distinct notes ` +
        `(lead ${song.leadCount}, bass ${song.bassCount}, drums ${song.drumCount}); ${loopMsg}; bank ${AUDIO_BANK}.`
);
