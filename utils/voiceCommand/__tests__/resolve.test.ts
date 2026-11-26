import { resolveVoiceCommand } from '@/utils/voiceCommand/tools';
import { resolveCopyMeal, resolveSearchFood } from '@/utils/voiceCommand/resolve';
import type { VoiceCommand } from '@/utils/voiceCommand/types';

// Thursday, 26 November 2026, 13:00 local.
const NOW = new Date(2026, 10, 26, 13, 0);
const ctx = (now: Date = NOW, transcript = 'x') => ({ now, transcript });

function command(overrides: Partial<VoiceCommand> = {}): VoiceCommand {
  return {
    tool: 'copy_meal',
    meal: null,
    day: null,
    fromMeal: null,
    fromDay: null,
    food: null,
    ...overrides,
  };
}

function localMidnight(year: number, month: number, day: number): Date {
  return new Date(year, month, day);
}

function expectOk(result: ReturnType<typeof resolveCopyMeal>) {
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.reason}`);
  }
  return result.action;
}

describe('resolveCopyMeal', () => {
  it('copies yesterday breakfast into today breakfast', () => {
    const action = expectOk(
      resolveCopyMeal(command({ meal: 'breakfast', fromDay: 'yesterday' }), ctx(NOW))
    );

    expect(action.kind).toBe('copyMeal');
    if (action.kind !== 'copyMeal') {
      return;
    }
    expect(action.targetDay.getTime()).toBe(localMidnight(2026, 10, 26).getTime());
    expect(action.sourceDay?.getTime()).toBe(localMidnight(2026, 10, 25).getTime());
    expect(action.meals).toEqual({ source: 'breakfast', target: 'breakfast' });
  });

  it('uses from_meal and meal as source and target', () => {
    const action = expectOk(
      resolveCopyMeal(
        command({ fromMeal: 'lunch', meal: 'dinner', fromDay: 'yesterday' }),
        ctx(NOW)
      )
    );

    expect(action.kind === 'copyMeal' && action.meals).toEqual({
      source: 'lunch',
      target: 'dinner',
    });
  });

  it('uses the one meal said for both sides', () => {
    const onlyFrom = expectOk(resolveCopyMeal(command({ fromMeal: 'lunch' }), ctx(NOW)));
    const onlyTo = expectOk(resolveCopyMeal(command({ meal: 'dinner' }), ctx(NOW)));

    expect(onlyFrom.kind === 'copyMeal' && onlyFrom.meals).toEqual({
      source: 'lunch',
      target: 'lunch',
    });
    expect(onlyTo.kind === 'copyMeal' && onlyTo.meals).toEqual({
      source: 'dinner',
      target: 'dinner',
    });
  });

  it('copies the whole day when no meal is said', () => {
    const action = expectOk(resolveCopyMeal(command({ fromDay: 'yesterday' }), ctx(NOW)));

    expect(action.kind === 'copyMeal' && action.meals).toBeNull();
  });

  it('leaves the source day null when no from_day is said', () => {
    const action = expectOk(resolveCopyMeal(command({ meal: 'breakfast' }), ctx(NOW)));

    expect(action.kind === 'copyMeal' && action.sourceDay).toBeNull();
  });

  it('rejects a source day that is not earlier than the target day', () => {
    expect(resolveCopyMeal(command({ fromDay: 'today' }), ctx(NOW))).toEqual({
      ok: false,
      reason: 'sourceNotEarlier',
    });
  });

  it('accepts a source day when the target is tomorrow', () => {
    const result = resolveCopyMeal(command({ day: 'tomorrow', fromDay: 'today' }), ctx(NOW));

    expect(result.ok).toBe(true);
  });

  it('finds the latest named weekday strictly before the target', () => {
    const sourceFor = (fromDay: VoiceCommand['fromDay'], day: VoiceCommand['day'] = null) => {
      const action = expectOk(resolveCopyMeal(command({ fromDay, day }), ctx(NOW)));
      return action.kind === 'copyMeal' ? action.sourceDay : null;
    };

    // Thursday target: Monday is 3 days back, Thursday is a week back, Wednesday is yesterday.
    expect(sourceFor('monday')).toEqual(localMidnight(2026, 10, 23));
    expect(sourceFor('thursday')).toEqual(localMidnight(2026, 10, 19));
    expect(sourceFor('wednesday')).toEqual(localMidnight(2026, 10, 25));
  });

  it('measures weekdays from a yesterday target', () => {
    // Target is Wednesday 25 November.
    expect(resolveCopyMeal(command({ fromDay: 'wednesday', day: 'yesterday' }), ctx(NOW))).toEqual({
      ok: true,
      action: expect.objectContaining({ sourceDay: localMidnight(2026, 10, 18) }),
    });
    expect(resolveCopyMeal(command({ fromDay: 'thursday', day: 'yesterday' }), ctx(NOW))).toEqual({
      ok: true,
      action: expect.objectContaining({ sourceDay: localMidnight(2026, 10, 19) }),
    });
  });

  it('returns local midnight across a DST change', () => {
    // Late March and late October transitions fall in common zones; the result must still be midnight.
    const dstNow = new Date(2026, 2, 30, 12, 0);
    const result = resolveCopyMeal(command({ fromDay: 'yesterday' }), ctx(dstNow));
    const action = expectOk(result);

    expect(action.kind === 'copyMeal' && action.targetDay.getHours()).toBe(0);
    expect(action.kind === 'copyMeal' && action.sourceDay?.getHours()).toBe(0);
    expect(action.kind === 'copyMeal' && action.sourceDay).toEqual(localMidnight(2026, 2, 29));
    expect(action.kind === 'copyMeal' && action.targetDay).toEqual(localMidnight(2026, 2, 30));
  });
});

describe('resolveSearchFood', () => {
  it('rejects an empty, whitespace or missing food', () => {
    for (const food of ['', '   ', null]) {
      expect(resolveSearchFood(command({ tool: 'search_food', food }), ctx(NOW))).toEqual({
        ok: false,
        reason: 'missingFood',
      });
    }
  });

  it('rejects a food the person never said', () => {
    expect(
      resolveSearchFood(
        command({ tool: 'search_food', food: 'banana' }),
        ctx(NOW, 'What did I eat yesterday?')
      )
    ).toEqual({ ok: false, reason: 'cantDetermine' });
  });

  it('defaults the day to today', () => {
    const action = expectOk(
      resolveSearchFood(command({ tool: 'search_food', food: 'egg' }), ctx(NOW, 'I had an egg'))
    );

    expect(action.kind === 'searchFood' && action.day).toEqual(localMidnight(2026, 10, 26));
    expect(action.kind === 'searchFood' && action.query).toBe('egg');
  });

  it('defaults the meal from the hour of the day', () => {
    const lunch = expectOk(
      resolveSearchFood(command({ tool: 'search_food', food: 'x' }), ctx(NOW))
    );
    const morning = expectOk(
      resolveSearchFood(
        command({ tool: 'search_food', food: 'x' }),
        ctx(new Date(2026, 10, 26, 8, 0))
      )
    );

    expect(lunch.kind === 'searchFood' && lunch.mealType).toBe('lunch');
    expect(morning.kind === 'searchFood' && morning.mealType).toBe('breakfast');
  });

  it('lets an explicit meal win over the hour', () => {
    const action = expectOk(
      resolveSearchFood(
        command({ tool: 'search_food', food: 'x', meal: 'dinner' }),
        ctx(new Date(2026, 10, 26, 8, 0))
      )
    );

    expect(action.kind === 'searchFood' && action.mealType).toBe('dinner');
  });
});

describe('resolveVoiceCommand', () => {
  it('answers none with noAction', () => {
    expect(resolveVoiceCommand(command({ tool: 'none' }), ctx(NOW))).toEqual({
      ok: false,
      reason: 'noAction',
    });
  });

  it('answers cant_determine_tool with cantDetermine', () => {
    expect(resolveVoiceCommand(command({ tool: 'cant_determine_tool' }), ctx(NOW))).toEqual({
      ok: false,
      reason: 'cantDetermine',
    });
  });

  it('routes an action tool to its resolver', () => {
    const result = resolveVoiceCommand(
      command({ tool: 'search_food', food: 'rice' }),
      ctx(NOW, 'rice please')
    );

    expect(result.ok && result.action.kind).toBe('searchFood');
  });
});
