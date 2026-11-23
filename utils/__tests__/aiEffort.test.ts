import { AI_TASK_EFFORT, type AiEffort, type AiTask, effortFor } from '../aiEffort';

const ORDER: AiEffort[] = ['minimal', 'low', 'medium', 'high'];
const TASKS = Object.keys(AI_TASK_EFFORT) as AiTask[];

describe('effortFor', () => {
  it('returns the normal column when thinking mode is off', () => {
    for (const task of TASKS) {
      expect(effortFor(task, false)).toBe(AI_TASK_EFFORT[task].normal);
    }
  });

  it('returns high for every task when thinking mode is on', () => {
    for (const task of TASKS) {
      expect(effortFor(task, true)).toBe('high');
    }
  });

  it('gives extraction minimal, chat low, and insight and planning medium by default', () => {
    expect(effortFor('extraction', false)).toBe('minimal');
    expect(effortFor('chat', false)).toBe('low');
    expect(effortFor('insight', false)).toBe('medium');
    expect(effortFor('planning', false)).toBe('medium');
  });

  it('never lowers effort when thinking mode is on', () => {
    for (const task of TASKS) {
      const normal = ORDER.indexOf(effortFor(task, false));
      const thinking = ORDER.indexOf(effortFor(task, true));
      expect(thinking).toBeGreaterThanOrEqual(normal);
    }
  });
});
