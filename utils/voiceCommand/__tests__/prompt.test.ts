import { getVoiceCommandSystemPrompt } from '@/utils/voiceCommand/prompt';
import {
  VOICE_ACTION_TOOLS,
  VOICE_TOOL_NAMES,
  type VoiceActionTool,
} from '@/utils/voiceCommand/types';

/** Every set of five action tools, the largest set a request offers short of all ten. */
function fiveToolSets(): VoiceActionTool[][] {
  const sets: VoiceActionTool[][] = [];
  const collect = (start: number, current: VoiceActionTool[]) => {
    if (current.length === 5) {
      sets.push(current);
      return;
    }
    for (let index = start; index <= VOICE_ACTION_TOOLS.length - (5 - current.length); index += 1) {
      collect(index + 1, [...current, VOICE_ACTION_TOOLS[index]]);
    }
  };
  collect(0, []);

  return sets;
}

describe('getVoiceCommandSystemPrompt', () => {
  it('checks all 252 combinations of five tools', () => {
    expect(fiveToolSets()).toHaveLength(252);
  });

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

  it('routes a question to ask_coach when that tool is offered', () => {
    const prompt = getVoiceCommandSystemPrompt(['ask_coach', 'search_food']);

    expect(prompt).toContain('"What did I eat yesterday?" => {"tool":"ask_coach"}');
    expect(prompt).not.toContain('question is not a request');
  });
});
