/**
 * Synthesizes the promo's music bed from nothing (no samples, nothing to license): an upbeat
 * 120 BPM track in F major (Dm / Bb / F / C, one chord a bar) so a bar is exactly 60 frames of
 * the 30 fps video. The arrangement follows the scenes in src/Promo.tsx:
 *
 *   bars  0-1   intro: pad and a soft arp, a riser into the drop
 *   bars  2-22  the features: kick, bass and hats; claps from bar 5; 16th hats and a lead arp
 *               from bar 9; a crash on every scene change
 *   bars 23-25  breakdown under "No account. No ads.": pad, arp and a riser
 *   bars 26-28  the outro drop, then a final chord that rings out
 *
 * Writes public/music.wav (Remotion encodes it to AAC with the video). Run by
 * `npm run prepare-assets`, so every render and studio session has it.
 */
const fs = require('fs');
const path = require('path');

const SR = 44100;
const BPM = 120;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BARS = 29;
const TAIL = 3.5;
const DUR = BARS * BAR + TAIL;
const N = Math.ceil(SR * DUR);

const L = new Float64Array(N);
const R = new Float64Array(N);
const duck = new Float64Array(N).fill(1);

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 1234567;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x7fffffff) * 2 - 1;
};

// Dm, Bb, F, C as MIDI voicings around middle C; root for the bass.
const CHORDS = [
  { root: 38, notes: [62, 65, 69, 72] },
  { root: 34, notes: [58, 62, 65, 69] },
  { root: 41, notes: [60, 65, 69, 72] },
  { root: 36, notes: [60, 64, 67, 72] },
];
const chordAt = (bar) => CHORDS[bar % 4];

// Scene changes (bar numbers) get a crash; see src/Promo.tsx.
const SCENE_BARS = [2, 5, 9, 13, 17, 20, 23, 26];
const isBreak = (bar) => bar >= 23 && bar <= 25;
const drumsOn = (bar) => bar >= 2 && bar <= 27 && !isBreak(bar);
const END_BAR = 28;

const add = (i, l, r) => {
  if (i >= 0 && i < N) {
    L[i] += l;
    R[i] += r;
  }
};

// ---------- Kick (and the sidechain it drives) ----------
const kick = (t0, gain = 1) => {
  const s = Math.floor(t0 * SR);
  let phase = 0;
  for (let k = 0; k < SR * 0.45; k++) {
    const t = k / SR;
    const f = 45 + 110 * Math.exp(-t / 0.035);
    phase += (2 * Math.PI * f) / SR;
    const env = Math.exp(-t / 0.18);
    const click = k < 90 ? noise() * 0.25 * (1 - k / 90) : 0;
    const v = gain * (0.95 * Math.sin(phase) * env + click);
    add(s + k, v, v);
  }
  for (let k = 0; k < SR * 0.32; k++) {
    const i = s + k;
    if (i < N) duck[i] = Math.min(duck[i], 1 - 0.7 * Math.exp(-(k / SR) / 0.09));
  }
};

// ---------- Clap ----------
const clap = (t0, gain = 0.5) => {
  const s = Math.floor(t0 * SR);
  let lp = 0;
  let prev = 0;
  for (let k = 0; k < SR * 0.25; k++) {
    const t = k / SR;
    const burst = t < 0.03 ? (Math.floor(t / 0.01) % 2 === 0 ? 1 : 0.4) : 1;
    const env = burst * Math.exp(-t / (t < 0.03 ? 0.01 : 0.07));
    const n = noise();
    lp += 0.35 * (n - lp);
    const hp = lp - prev;
    prev = lp;
    const v = gain * hp * env * 3;
    add(s + k, v * 0.9, v);
  }
};

// ---------- Hats ----------
const hat = (t0, open, gain) => {
  const s = Math.floor(t0 * SR);
  const dec = open ? 0.11 : 0.025;
  let prev = 0;
  for (let k = 0; k < SR * dec * 5; k++) {
    const n = noise();
    const hp = n - prev;
    prev = n;
    const v = gain * hp * Math.exp(-(k / SR) / dec);
    add(s + k, v * 0.8, v);
  }
};

// ---------- Crash / impact ----------
const crash = (t0, gain = 0.32) => {
  const s = Math.floor(t0 * SR);
  let prev = 0;
  for (let k = 0; k < SR * 2.2; k++) {
    const t = k / SR;
    const n = noise();
    const hp = n - prev;
    prev = n;
    const env = Math.exp(-t / 0.6);
    const boom =
      t < 0.8
        ? Math.sin(2 * Math.PI * (40 + 30 * Math.exp(-t / 0.05)) * t) * Math.exp(-t / 0.25) * 0.6
        : 0;
    add(s + k, gain * (hp * env * 0.9 + boom), gain * (hp * env + boom));
  }
};

// ---------- Riser: noise swelling up over a bar ----------
const riser = (t0, len, gain = 0.22) => {
  const s = Math.floor(t0 * SR);
  let bp = 0;
  let lp = 0;
  for (let k = 0; k < SR * len; k++) {
    const x = k / (SR * len);
    const n = noise();
    const cut = 0.02 + 0.5 * x * x;
    lp += cut * (n - lp);
    bp = lp - bp * 0.2;
    const v = gain * bp * x * x * 2.2;
    add(s + k, v, v * 0.92);
  }
};

// ---------- Bass: filtered saw on the off-beat eighths, plus a sub ----------
const bassNote = (t0, len, midi, gain) => {
  const s = Math.floor(t0 * SR);
  const f = mtof(midi);
  let ph = 0;
  let lp = 0;
  for (let k = 0; k < SR * len; k++) {
    const t = k / SR;
    ph = (ph + f / SR) % 1;
    const saw = 2 * ph - 1;
    const cut = 0.05 + 0.18 * Math.exp(-t / 0.06);
    lp += cut * (saw - lp);
    const env = Math.min(1, t / 0.004) * Math.min(1, (len - t) / 0.02);
    const sub = Math.sin(2 * Math.PI * (f / 2) * t);
    const v = gain * env * (lp * 0.7 + sub * 0.55);
    add(s + k, v, v);
  }
};

// ---------- Pad: detuned saws through a soft low-pass, sidechained ----------
const padL = new Float64Array(N);
const padR = new Float64Array(N);
const pad = (t0, len, notes, gain) => {
  const s = Math.floor(t0 * SR);
  notes.forEach((m, ni) => {
    const f = mtof(m);
    const det = [0.996, 1.0, 1.004];
    const ph = [ni * 0.13, ni * 0.37, ni * 0.71];
    let lpL = 0;
    let lpR = 0;
    for (let k = 0; k < SR * (len + 0.6); k++) {
      const t = k / SR;
      let a = 0;
      let b = 0;
      det.forEach((d, di) => {
        const x = (ph[di] + f * d * t) % 1;
        const saw = 2 * x - 1;
        if (di !== 2) a += saw;
        if (di !== 0) b += saw;
      });
      lpL += 0.06 * (a - lpL);
      lpR += 0.06 * (b - lpR);
      const att = Math.min(1, t / 0.08);
      const rel = t > len ? Math.max(0, 1 - (t - len) / 0.6) : 1;
      const env = gain * att * rel;
      const i = s + k;
      if (i < N) {
        padL[i] += lpL * env;
        padR[i] += lpR * env;
      }
    }
  });
};

// ---------- Pluck arp with a ping-pong delay ----------
const arpL = new Float64Array(N);
const arpR = new Float64Array(N);
const pluck = (t0, midi, gain, pan) => {
  const s = Math.floor(t0 * SR);
  const f = mtof(midi);
  for (let k = 0; k < SR * 0.35; k++) {
    const t = k / SR;
    const idx = 2.2 * Math.exp(-t / 0.05);
    const v =
      gain *
      Math.sin(2 * Math.PI * f * t + idx * Math.sin(2 * Math.PI * f * 2 * t)) *
      Math.exp(-t / 0.11) *
      Math.min(1, t / 0.002);
    const i = s + k;
    if (i < N) {
      arpL[i] += v * (1 - pan);
      arpR[i] += v * (1 + pan);
    }
  }
};

// ---------- Arrangement ----------
for (let bar = 0; bar < BARS; bar++) {
  const t = bar * BAR;
  const ch = chordAt(bar);
  const final = bar === END_BAR;

  // Pad: quiet in the intro, full in the body, the final chord rings out.
  if (final) pad(t, 2.6, [...CHORDS[2].notes, 53], 0.05);
  else pad(t, BAR, ch.notes, bar < 2 ? 0.03 : isBreak(bar) ? 0.045 : 0.04);

  // Arp: 16ths over the chord, from the start (soft) and lead from bar 9.
  if (!final) {
    const pattern = [0, 1, 2, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2];
    const lead = bar >= 9 || isBreak(bar) || bar >= 26;
    for (let s16 = 0; s16 < 16; s16++) {
      if (!lead && s16 % 2 === 1) continue;
      const note = ch.notes[pattern[s16]] + (lead && s16 % 4 === 0 ? 12 : 0);
      pluck(t + s16 * (BEAT / 4), note, lead ? 0.085 : 0.05, s16 % 2 ? 0.35 : -0.35);
    }
  }

  // Drums and bass.
  if (drumsOn(bar)) {
    for (let b = 0; b < 4; b++) kick(t + b * BEAT, 0.95);
    if (bar >= 5) {
      clap(t + BEAT, 0.42);
      clap(t + 3 * BEAT, 0.42);
    }
    for (let e = 0; e < 8; e++) {
      const tt = t + e * (BEAT / 2);
      if (e % 2 === 1) hat(tt, true, 0.09);
      if (bar >= 9) {
        hat(tt, false, 0.05);
        hat(tt + BEAT / 4, false, 0.035);
      }
      if (e % 2 === 1) bassNote(tt, BEAT / 2 - 0.02, ch.root, 0.34);
    }
    // A snare-ish clap roll into each scene change.
    if (SCENE_BARS.includes(bar + 1) && bar >= 4) {
      for (let r = 0; r < 4; r++) clap(t + 3 * BEAT + r * (BEAT / 4), 0.16 + r * 0.05);
    }
  } else if (isBreak(bar)) {
    bassNote(t, BAR - 0.05, ch.root, 0.18);
  }

  if (SCENE_BARS.includes(bar)) crash(t, bar === 2 || bar === 26 ? 0.4 : 0.24);
  if (final) {
    kick(t, 1.0);
    crash(t, 0.45);
    bassNote(t, 2.2, 29, 0.32);
  }
}
riser(1 * BAR, BAR, 0.24);
riser(25 * BAR, BAR, 0.3);
riser(12 * BAR + 2 * BEAT, 2 * BEAT, 0.14);
riser(19 * BAR + 2 * BEAT, 2 * BEAT, 0.14);

// Ping-pong delay on the arp (3/16 of a beat apart, alternating sides).
const dly = Math.floor(((BEAT * 3) / 4) * SR);
for (let i = dly; i < N; i++) {
  arpL[i] += 0.38 * arpR[i - dly];
  arpR[i] += 0.38 * arpL[i - dly];
}

// Mix: pad and arp are sidechained to the kick.
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] += (padL[i] + arpL[i] * 0.9) * duck[i];
  R[i] += (padR[i] + arpR[i] * 0.9) * duck[i];
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 1.6 / peak;
const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0);
out.writeUInt32LE(36 + N * 4, 4);
out.write('WAVEfmt ', 8);
out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20);
out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28);
out.writeUInt16LE(4, 32);
out.writeUInt16LE(16, 34);
out.write('data', 36);
out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const fade = Math.min(1, (N - i) / (SR * 0.5));
  const l = Math.tanh(L[i] * norm) * 0.89 * fade;
  const r = Math.tanh(R[i] * norm) * 0.89 * fade;
  out.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}
fs.mkdirSync(path.join(__dirname, '..', 'public'), { recursive: true });
const file = path.join(__dirname, '..', 'public', 'music.wav');
fs.writeFileSync(file, out);
console.log(`wrote ${file} (${DUR.toFixed(1)} s)`);
