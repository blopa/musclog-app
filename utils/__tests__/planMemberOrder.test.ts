import { reorderPlanMembers } from '@/utils/planMemberOrder';

const member = (templateId: string, weekDays: number[] = []) => ({ templateId, weekDays });

describe('reorderPlanMembers', () => {
  it('applies the given order when every member is named', () => {
    const members = [member('a'), member('b'), member('c')];

    expect(reorderPlanMembers(members, ['c', 'a', 'b']).map((m) => m.templateId)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('carries each member’s weekdays with it', () => {
    const members = [member('a', [1]), member('b', [2, 4])];

    expect(reorderPlanMembers(members, ['b', 'a'])).toEqual([
      member('b', [2, 4]),
      member('a', [1]),
    ]);
  });

  it('leaves an unnamed member — one whose workout is missing, so it never rendered — in place', () => {
    // 'ghost' is the archived workout: it is not in the reordered ids because the editor never
    // drew a row for it, and it must not be shuffled to an end by someone else's move.
    const members = [member('a'), member('ghost'), member('b'), member('c')];

    expect(reorderPlanMembers(members, ['c', 'b', 'a']).map((m) => m.templateId)).toEqual([
      'c',
      'ghost',
      'b',
      'a',
    ]);
  });

  it('ignores ids that match no member', () => {
    const members = [member('a'), member('b')];

    expect(reorderPlanMembers(members, ['b', 'gone', 'a']).map((m) => m.templateId)).toEqual([
      'b',
      'a',
    ]);
  });

  it('ignores a repeated id rather than duplicating a member', () => {
    const members = [member('a'), member('b')];

    expect(reorderPlanMembers(members, ['b', 'b', 'a']).map((m) => m.templateId)).toEqual([
      'b',
      'a',
    ]);
  });

  it('returns the members untouched when the order names none of them', () => {
    const members = [member('a'), member('b')];

    expect(reorderPlanMembers(members, []).map((m) => m.templateId)).toEqual(['a', 'b']);
  });
});
