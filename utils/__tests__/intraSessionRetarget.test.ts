import { selectRetargets } from '@/utils/intraSessionRetarget';
import { parseProgressionRule } from '@/utils/progressionRuleSchema';
import { serializeSetPrescription } from '@/utils/setPrescription';

const set = (id: string, setOrder: number, status: string, extra: Record<string, unknown> = {}) =>
  ({ id, setOrder, completionStatus: status, setType: 'normal', ...extra }) as any;

const topSetRule = parseProgressionRule(
  JSON.stringify({
    type: 'top_set_backoff',
    repMin: 4,
    repMax: 6,
    backoffPercent: 85,
    backoffReps: 8,
  })
);

describe('selectRetargets', () => {
  it('re-targets only the next planned set from the set just performed', () => {
    const siblings = [set('a', 1, 'performed'), set('b', 2, 'planned'), set('c', 3, 'planned')];

    const plan = selectRetargets({
      set: siblings[0],
      status: 'performed',
      siblings,
      rule: null,
      autonomy: 'suggest',
    });

    expect(plan?.previous.id).toBe('a');
    expect(plan?.targets.map((row) => row.id)).toEqual(['b']);
    expect(plan?.previousIsTopSet).toBe(false);
  });

  it('changes nothing in manual mode when there is no explicit rule', () => {
    const siblings = [set('a', 1, 'performed'), set('b', 2, 'planned')];

    expect(
      selectRetargets({
        set: siblings[0],
        status: 'performed',
        siblings,
        rule: null,
        autonomy: 'manual',
      })
    ).toBeNull();
  });

  it('still applies a rule the user chose explicitly in manual mode', () => {
    expect(topSetRule).not.toBeNull();
    const siblings = [set('a', 1, 'performed'), set('b', 2, 'planned'), set('c', 3, 'planned')];

    const plan = selectRetargets({
      set: siblings[0],
      status: 'performed',
      siblings,
      rule: topSetRule,
      autonomy: 'manual',
    });

    expect(plan?.previousIsTopSet).toBe(true);
    expect(plan?.targets.map((row) => row.id)).toEqual(['b', 'c']);
  });

  it('never re-targets from or onto a warm-up', () => {
    const warm = set('w', 1, 'performed', { setType: 'warmup' });
    expect(
      selectRetargets({
        set: warm,
        status: 'performed',
        siblings: [set('b', 2, 'planned')],
        rule: null,
        autonomy: 'suggest',
      })
    ).toBeNull();
  });

  it('leaves a set the user typed over exactly as typed', () => {
    const siblings = [
      set('a', 1, 'performed'),
      set('b', 2, 'planned', {
        prescriptionJson: serializeSetPrescription({
          plan: { weightKg: 50, reps: 8 },
          recommendation: { weightKg: 50, reps: 8 },
          override: 'manual',
        }),
      }),
    ];

    expect(
      selectRetargets({
        set: siblings[0],
        status: 'performed',
        siblings,
        rule: null,
        autonomy: 'suggest',
      })
    ).toBeNull();
  });

  it('after a skipped set, re-targets the next planned set from the last performed one', () => {
    const siblings = [set('a', 1, 'performed'), set('b', 2, 'skipped'), set('c', 3, 'planned')];

    const plan = selectRetargets({
      set: siblings[1],
      status: 'skipped',
      siblings,
      rule: null,
      autonomy: 'suggest',
    });

    expect(plan?.previous.id).toBe('a');
    expect(plan?.targets.map((row) => row.id)).toEqual(['c']);
  });

  it('has nothing to re-target from when the first set is skipped', () => {
    const siblings = [set('a', 1, 'skipped'), set('b', 2, 'planned')];

    expect(
      selectRetargets({
        set: siblings[0],
        status: 'skipped',
        siblings,
        rule: null,
        autonomy: 'suggest',
      })
    ).toBeNull();
  });

  it('does nothing when a set is put back to planned', () => {
    const siblings = [set('a', 1, 'planned'), set('b', 2, 'planned')];

    expect(
      selectRetargets({
        set: siblings[0],
        status: 'planned',
        siblings,
        rule: null,
        autonomy: 'suggest',
      })
    ).toBeNull();
  });
});
