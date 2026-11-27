import { getVoiceCommandSystemPrompt } from '@/utils/voiceCommand/prompt';
import {
  VOICE_ACTION_TOOLS,
  VOICE_TOOL_NAMES,
  type VoiceActionTool,
} from '@/utils/voiceCommand/types';

/** Every set of five action tools: the largest set a request offers short of all six. */
function fiveToolSets(): VoiceActionTool[][] {
  return VOICE_ACTION_TOOLS.map((excluded) =>
    VOICE_ACTION_TOOLS.filter((tool) => tool !== excluded)
  );
}

describe('getVoiceCommandSystemPrompt', () => {
  it('names every tool', () => {
    const prompt = getVoiceCommandSystemPrompt();

    for (const name of VOICE_TOOL_NAMES) {
      expect(prompt).toContain(name);
    }
  });

  it.each(fiveToolSets().map((set) => [set.join(',')] as const))(
    'stays within 2000 characters with %s',
    (_label) => {
      const set = _label.split(',') as VoiceActionTool[];

      expect(getVoiceCommandSystemPrompt(set).length).toBeLessThanOrEqual(2000);
    }
  );

  it('lists only the offered tools', () => {
    const prompt = getVoiceCommandSystemPrompt(['search_food', 'log_weight']);

    expect(prompt).toContain('search_food:');
    expect(prompt).toContain('log_weight:');
    expect(prompt).not.toContain('copy_meal:');
    expect(prompt).not.toContain('go_to:');
    expect(prompt).not.toContain('add_note:');
  });

  it('names the one tool the person picked', () => {
    expect(getVoiceCommandSystemPrompt(['search_food', 'log_weight'], 'log_weight')).toContain(
      'The person has said this sentence means log_weight.'
    );
  });
});
