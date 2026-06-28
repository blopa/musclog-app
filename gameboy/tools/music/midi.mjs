export function readVarLen(buf, pos) {
  let value = 0;
  let p = pos;

  for (let bytes = 0; bytes !== 4; bytes++) {
    if (p >= buf.length) {
      throw new Error('Unexpected end of MIDI data while reading a variable-length quantity.');
    }

    const byte = buf[p++];
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, pos: p };
  }

  throw new Error('Invalid MIDI variable-length quantity longer than four bytes.');
}

function requireBytes(buf, pos, count, context) {
  if (pos + count > buf.length) {
    throw new Error(`Unexpected end of MIDI data while reading ${context}.`);
  }
}

function dataByteCount(status) {
  const high = status & 0xf0;
  if (high === 0xc0 || high === 0xd0) return 1;
  if (high >= 0x80 && high <= 0xe0) return 2;
  throw new Error(`Unsupported MIDI event status 0x${status.toString(16)}.`);
}

export function parseMidi(buf) {
  requireBytes(buf, 0, 14, 'SMF header');
  if (buf.toString('ascii', 0, 4) !== 'MThd') {
    throw new Error('Not a Standard MIDI File (missing MThd).');
  }

  const headerLength = buf.readUInt32BE(4);
  if (headerLength < 6) {
    throw new Error(`Invalid SMF header length ${headerLength}.`);
  }

  const trackCount = buf.readUInt16BE(10);
  const division = buf.readUInt16BE(12);
  if (division & 0x8000) {
    throw new Error('SMPTE time division is not supported.');
  }

  const tempos = [];
  const notes = [];

  let pos = 8 + headerLength;
  for (let t = 0; t < trackCount; t++) {
    requireBytes(buf, pos, 8, 'MTrk header');
    if (buf.toString('ascii', pos, pos + 4) !== 'MTrk') {
      throw new Error(`Expected MTrk chunk at byte ${pos}.`);
    }

    const len = buf.readUInt32BE(pos + 4);
    pos += 8;
    const end = pos + len;
    requireBytes(buf, pos, len, 'MTrk body');

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
      } else if (status === 0) {
        throw new Error(`Running status used before any status byte at tick ${tick}.`);
      }

      if (status === 0xff) {
        requireBytes(buf, pos, 1, 'meta event type');
        const type = buf[pos++];
        const ml = readVarLen(buf, pos);
        pos = ml.pos;
        requireBytes(buf, pos, ml.value, 'meta event body');

        if (type === 0x51 && ml.value === 3) {
          tempos.push({
            tick,
            usPerQuarter: (buf[pos] << 16) | (buf[pos + 1] << 8) | buf[pos + 2],
          });
        }
        pos += ml.value;
      } else if (status === 0xf0 || status === 0xf7) {
        const sl = readVarLen(buf, pos);
        pos = sl.pos;
        requireBytes(buf, pos, sl.value, 'SysEx event body');
        pos += sl.value;
      } else {
        const high = status & 0xf0;
        const channel = status & 0x0f;
        const count = dataByteCount(status);
        requireBytes(buf, pos, count, 'channel event data');

        if (high === 0x90) {
          const note = buf[pos++];
          const velocity = buf[pos++];
          notes.push({ tick, on: velocity > 0, channel, note });
        } else if (high === 0x80) {
          const note = buf[pos++];
          pos++;
          notes.push({ tick, on: false, channel, note });
        } else {
          pos += count;
        }
      }
    }

    pos = end;
  }

  if (tempos.length === 0 || tempos[0].tick !== 0) {
    tempos.unshift({ tick: 0, usPerQuarter: 500000 });
  }
  tempos.sort((a, b) => a.tick - b.tick);

  return { division, tempos, notes };
}

export function makeTickToSeconds(division, tempos) {
  const cumulative = [{ tick: 0, seconds: 0, usPerQuarter: tempos[0].usPerQuarter }];

  for (let i = 1; i < tempos.length; i++) {
    const prev = cumulative[i - 1];
    const dTicks = tempos[i].tick - tempos[i - 1].tick;
    cumulative.push({
      tick: tempos[i].tick,
      seconds: prev.seconds + (dTicks * prev.usPerQuarter) / division / 1e6,
      usPerQuarter: tempos[i].usPerQuarter,
    });
  }

  return (tick) => {
    let segment = cumulative[0];
    for (let i = 1; i < cumulative.length; i++) {
      if (cumulative[i].tick <= tick) segment = cumulative[i];
      else break;
    }
    return segment.seconds + ((tick - segment.tick) * segment.usPerQuarter) / division / 1e6;
  };
}

export function midiToFreq(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

export function pulsePeriod(note) {
  const period = Math.round(2048 - 131072 / midiToFreq(note));
  return Math.max(1, Math.min(2047, period));
}

export function wavePeriod(note) {
  const period = Math.round(2048 - 65536 / midiToFreq(note));
  return Math.max(1, Math.min(2047, period));
}
