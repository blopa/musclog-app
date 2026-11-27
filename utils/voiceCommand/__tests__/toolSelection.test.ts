import {
  activeVoiceTools,
  DEFAULT_VOICE_TOOL_SELECTION,
  parseVoiceToolSelection,
  serializeVoiceToolSelection,
  toggleVoiceTool,
} from '@/utils/voiceCommand/toolSelection';
import type { VoiceActionTool } from '@/utils/voiceCommand/types';

describe('parseVoiceToolSelection', () => {
  it('reads the stored list in pick order and drops duplicates and unknown names', () => {
    expect(parseVoiceToolSelection('search_food,bogus,search_food,go_to')).toEqual([
      'search_food',
      'go_to',
    ]);
  });

  it('falls back to the default for empty, missing or garbage input', () => {
    for (const raw of ['', '   ', null, undefined, 'nonsense,more nonsense']) {
      expect(parseVoiceToolSelection(raw)).toEqual([...DEFAULT_VOICE_TOOL_SELECTION]);
    }
  });

  it('round-trips through serialize', () => {
    const picks: VoiceActionTool[] = ['go_to', 'add_note'];

    expect(parseVoiceToolSelection(serializeVoiceToolSelection(picks))).toEqual(picks);
  });
});

describe('toggleVoiceTool', () => {
  it('appends a tool that is not picked yet', () => {
    expect(toggleVoiceTool(['search_food', 'copy_meal'], 'go_to')).toEqual([
      'search_food',
      'copy_meal',
      'go_to',
    ]);
  });

  it('removes a tool that is picked', () => {
    expect(toggleVoiceTool(['search_food', 'copy_meal'], 'copy_meal')).toEqual(['search_food']);
  });

  it('refuses to remove the last tool, returning the same array', () => {
    const selection: readonly VoiceActionTool[] = ['search_food'];

    expect(toggleVoiceTool(selection, 'search_food')).toBe(selection);
  });
});

describe('activeVoiceTools', () => {
  it('keeps the first picks, then sorts them into native order', () => {
    expect(activeVoiceTools(['go_to', 'search_food', 'copy_meal', 'log_weight'], 3)).toEqual([
      'search_food',
      'copy_meal',
      'go_to',
    ]);
  });

  it('offers every pick when no limit is given, in native order', () => {
    expect(activeVoiceTools(['add_note', 'log_weight', 'search_food'])).toEqual([
      'search_food',
      'log_weight',
      'add_note',
    ]);
  });

  it('does not mutate the stored selection', () => {
    const selection: readonly VoiceActionTool[] = ['go_to', 'search_food'];
    activeVoiceTools(selection);

    expect(selection).toEqual(['go_to', 'search_food']);
  });
});
