import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  appendWaveformSample,
  silentWaveform,
  type VoiceLevelMeter,
  WAVEFORM_TICK_MS,
} from '@/utils/voiceLevel';

/** Tallest bar; the waveform reserves this height so nothing below it moves. */
export const VOICE_WAVEFORM_HEIGHT = 88;

/** A silent bar, so the line still reads as "the microphone is on" in a pause. */
const BAR_REST_HEIGHT = 6;

const BAR_GAP = 4;

/** Wide enough to read as a waveform on a phone, narrow enough to stay one shape on a tablet. */
const MAX_WIDTH = 320;

type VoiceWaveformProps = {
  /** The hold's level (`useHoldToTranscribe().level`). */
  level: VoiceLevelMeter;
  /** Scrolls while true; freezes in place once the hold is let go. */
  running: boolean;
  color: string;
};

/**
 * A scrolling level meter: every `WAVEFORM_TICK_MS` the newest microphone level enters on the
 * right and the oldest bar leaves on the left, mirrored around the middle line. It is information,
 * not decoration (docs/DESIGN.md → motion): in silence the bars lie flat, and nothing moves once
 * the hold ends. Its own state, so the samples never re-render the bar or the overlay around it.
 */
export function VoiceWaveform({ level, running, color }: VoiceWaveformProps) {
  const [bars, setBars] = useState(silentWaveform);

  useEffect(() => {
    if (!running) {
      return;
    }

    const timer = setInterval(() => {
      setBars((current) => appendWaveformSample(current, level.sample()));
    }, WAVEFORM_TICK_MS);

    return () => clearInterval(timer);
  }, [level, running]);

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      className="w-full flex-row items-center"
      style={{ maxWidth: MAX_WIDTH, height: VOICE_WAVEFORM_HEIGHT, gap: BAR_GAP }}
    >
      {bars.map((value, index) => (
        <View
          // The position is the bar's identity: the values scroll through fixed slots.
          key={index}
          className="flex-1 rounded-full"
          style={{
            height: BAR_REST_HEIGHT + value * (VOICE_WAVEFORM_HEIGHT - BAR_REST_HEIGHT),
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}
