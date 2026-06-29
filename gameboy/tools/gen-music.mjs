// Converts the bundled Standard MIDI Files into Game Boy APU data tables.
//
// Source:
//   - gameboy/assets/beep_sfx.mid                   -> the UI confirm/select blip
//   - gameboy/assets/E2M9_Cammy_-_Cookie_Fangs.mid  -> the title-screen soundtrack
//
// The parser/reduction/emission pieces live under tools/music/ so this command
// stays as orchestration: read assets, build the reduced streams, emit C, report.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AUDIO_BANK, buildSfx, buildSong, FRAME_RATE, SFX_FRAMES } from './music/arrangement.mjs';
import { musicBody, musicHeader } from './music/emit-c.mjs';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..', '..');
const assetsDir = join(repoRoot, 'gameboy', 'assets');
const outDir = join(repoRoot, 'gameboy', 'src', 'generated');
mkdirSync(outDir, { recursive: true });

const SFX_FILE = 'beep_sfx.mid';
const SONG_FILE = 'E2M9_Cammy_-_Cookie_Fangs.mid';

function seconds(frames) {
  return (frames / FRAME_RATE).toFixed(1);
}

function loopSummary(song) {
  if (!song.hasLoop) {
    return `no clean loop found — whole ${seconds(song.totalFrames)}s song loops`;
  }

  return (
    `loop ${seconds(song.loopStartFrame)}s..${seconds(song.loopEndFrame)}s ` +
    `(${seconds(song.loopEndFrame - song.loopStartFrame)}s body, intro ` +
    `${seconds(song.loopStartFrame)}s, from ${seconds(song.totalFrames)}s source), ` +
    `loop index ${song.loopIndex}`
  );
}

const sfx = buildSfx(readFileSync(join(assetsDir, SFX_FILE)));
const song = buildSong(readFileSync(join(assetsDir, SONG_FILE)));

writeFileSync(
  join(outDir, 'music_data.h'),
  musicHeader({
    audioBank: AUDIO_BANK,
    sfx,
    sfxFrames: SFX_FRAMES,
    sfxFile: SFX_FILE,
    song,
    songFile: SONG_FILE,
  })
);
writeFileSync(
  join(outDir, 'music_data.c'),
  musicBody({
    audioBank: AUDIO_BANK,
    sfxFile: SFX_FILE,
    song,
    songFile: SONG_FILE,
  })
);

console.log(
  `Wrote music_data.{c,h}: SFX period ${sfx.period} (note ${sfx.note}); ` +
    `song ${song.events.length} events, ${song.noteList.length} distinct notes ` +
    `(lead ${song.leadCount}, bass ${song.bassCount}, drums ${song.drumCount}); ` +
    `${loopSummary(song)}; bank ${AUDIO_BANK}.`
);
