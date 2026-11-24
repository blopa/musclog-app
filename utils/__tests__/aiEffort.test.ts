import {
  AI_TASK_EFFORT,
  type AiEffort,
  type AiTask,
  effortFor,
  reasoningEffortValue,
} from '../aiEffort';
import { THINKING_LEVELS } from '../aiThinkingLevel';

const ORDER: AiEffort[] = ['minimal', 'low', 'medium', 'high', 'max'];
const TASKS = Object.keys(AI_TASK_EFFORT) as AiTask[];

describe('effortFor', () => {
  it('gives each job its own effort when thinking is off', () => {
    expect(effortFor('extraction', 'off')).toBe('minimal');
    expect(effortFor('chat', 'off')).toBe('low');
    expect(effortFor('insight', 'off')).toBe('medium');
    expect(effortFor('planning', 'off')).toBe('medium');
  });

  it('lifts every job to high at medium and high, which differ in requests, not effort', () => {
    for (const task of TASKS) {
      expect(effortFor(task, 'medium')).toBe('high');
      expect(effortFor(task, 'high')).toBe('high');
    }
  });

  it('asks for the most at tokenmaxxing', () => {
    for (const task of TASKS) {
      expect(effortFor(task, 'tokenmaxxing')).toBe('max');
    }
  });

  it('never lowers effort as the level goes up', () => {
    for (const task of TASKS) {
      const ranks = THINKING_LEVELS.map((level) => ORDER.indexOf(effortFor(task, level)));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  });
});

describe('reasoningEffortValue', () => {
  it('sends only values every OpenAI reasoning model and the Iron Worker accept', () => {
    expect(reasoningEffortValue('minimal')).toBe('low');
    expect(reasoningEffortValue('low')).toBe('low');
    expect(reasoningEffortValue('medium')).toBe('medium');
    expect(reasoningEffortValue('high')).toBe('high');
    expect(reasoningEffortValue('max')).toBe('high');
  });
});
