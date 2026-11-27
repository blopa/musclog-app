import { resolveVoiceCommand } from '@/utils/voiceCommand/tools';
import {
  resolveAddNote,
  resolveCopyMeal,
  resolveGoTo,
  resolveLogMeal,
  resolveLogWeight,
  resolveSearchFood,
} from '@/utils/voiceCommand/resolve';
import type { VoiceCommand } from '@/utils/voiceCommand/types';

// Thursday, 26 November 2026, 13:00 local.
const NOW = new Date(2026, 10, 26, 13, 0);
const ctx = (now: Date = NOW, transcript = 'x') => ({ now, transcript, weightUnit: 'kg' as const });

function command(overrides: Partial<VoiceCommand> = {}): VoiceCommand {
  return {
    tool: 'copy_meal',
    meal: null,
    day: null,
    fromMeal: null,
    fromDay: null,
    food: null,
    weight: null,
    text: null,
    screen: null,
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

describe('a meal name in the food slot', () => {
  const now = new Date(2026, 10, 25, 12, 0);
  const command = {
    tool: 'search_food',
    meal: null,
    day: 'today',
    fromMeal: null,
    fromDay: null,
    food: 'breakfast',
    weight: null,
    text: null,
    screen: null,
  } as const;

  it('opens the copy review with no source day instead of searching', () => {
    const resolution = resolveVoiceCommand(command, {
      now,
      transcript: 'Today, I had the same breakfast as yesterday.',
      weightUnit: 'kg',
    });

    expect(resolution).toEqual({
      ok: true,
      action: {
        kind: 'copyMeal',
        targetDay: new Date(2026, 10, 25),
        sourceDay: null,
        meals: { source: 'breakfast', target: 'breakfast' },
      },
    });
  });

  it('still needs the meal to have been said', () => {
    expect(
      resolveVoiceCommand(command, { now, transcript: 'Add some oats', weightUnit: 'kg' })
    ).toEqual({
      ok: false,
      reason: 'cantDetermine',
    });
  });
});

describe('resolveLogWeight', () => {
  const weigh = (
    transcript: string,
    overrides: Partial<VoiceCommand> = {},
    extra: Partial<{ weightUnit: 'kg' | 'lb'; chosen: boolean }> = {}
  ) =>
    resolveLogWeight(command({ tool: 'log_weight', ...overrides }), {
      now: NOW,
      transcript,
      weightUnit: 'kg',
      ...extra,
    });

  it('takes the value from the transcript when the model agrees with it', () => {
    const result = weigh('I weigh 82.4 kilos', { weight: '82.4' });

    expect(result).toEqual({
      ok: true,
      action: {
        kind: 'logWeight',
        day: localMidnight(2026, 10, 26),
        weightKg: 82.4,
      },
    });
  });

  it('reads a decimal comma as the decimal point', () => {
    expect(weigh('Ich wiege 82,4 kg', { weight: '82.4' })).toEqual({
      ok: true,
      action: expect.objectContaining({ kind: 'logWeight', weightKg: 82.4 }),
    });
    expect(weigh('Ich wiege 82,4 kg', { weight: '82,4' })).toEqual({
      ok: true,
      action: expect.objectContaining({ weightKg: 82.4 }),
    });
  });

  it('rejects a spelled-out weight the transcript cannot be read for', () => {
    expect(weigh('I weigh eighty two point four', { weight: '82.4' })).toEqual({
      ok: false,
      reason: 'cantDetermine',
    });
  });

  it('rejects a model value that disagrees with the number said', () => {
    expect(weigh('I weigh 82.4', { weight: '80' })).toEqual({
      ok: false,
      reason: 'cantDetermine',
    });
  });

  it('rejects a weigh-in for tomorrow', () => {
    expect(weigh('I weigh 82.4 tomorrow', { weight: '82.4', day: 'tomorrow' })).toEqual({
      ok: false,
      reason: 'cantDetermine',
    });
  });

  it('takes the unit said in the transcript over the account unit', () => {
    // 181 lb is 82.1 kg; the account is metric and the unit said wins.
    const result = weigh('I weigh 181 pounds', { weight: '181' });

    expect(result.ok).toBe(true);
    expect(result).toEqual({
      ok: true,
      action: expect.objectContaining({ kind: 'logWeight' }),
    });
    expect((result as { action: { weightKg: number } }).action.weightKg).toBeCloseTo(82.1, 1);
  });

  it('a metric user saying 181 pounds gives about 82.1 kg', () => {
    const result = weigh('I weigh 181 pounds', { weight: '181' }, { weightUnit: 'kg' });

    expect((result as { action: { weightKg: number } }).action.weightKg).toBeCloseTo(82.1, 1);
  });

  it('an imperial user saying "I weigh 181" gives about 82.1 kg', () => {
    const result = weigh('I weigh 181', { weight: '181' }, { weightUnit: 'lb' });

    expect((result as { action: { weightKg: number } }).action.weightKg).toBeCloseTo(82.1, 1);
  });

  it('an imperial user saying "82 kilos" gives 82 kg', () => {
    const result = weigh('I weigh 82 kilos', { weight: '82' }, { weightUnit: 'lb' });

    expect(result).toEqual({
      ok: true,
      action: expect.objectContaining({ kind: 'logWeight', weightKg: 82 }),
    });
  });

  it('takes the account unit when none was said', () => {
    const result = weigh('I weigh 181', { weight: '181' }, { weightUnit: 'lb' });

    expect((result as { action: { weightKg: number } }).action.weightKg).toBeCloseTo(82.1, 1);
  });

  it.each([
    ['10 kilos', '10'],
    ['500 kilos', '500'],
    ['10 pounds', '10'],
  ])('rejects an out-of-range weight: %s', (said, model) => {
    expect(weigh(`I weigh ${said}`, { weight: model })).toEqual({
      ok: false,
      reason: 'cantDetermine',
    });
  });

  it('checks the range in kilograms: 900 lb is over the limit, 880 lb is not', () => {
    // 900 lb is about 408 kg: over the limit once converted.
    expect(weigh('I weigh 900 pounds', { weight: '900' })).toEqual({
      ok: false,
      reason: 'cantDetermine',
    });
    // 880 lb is about 399 kg: inside the limit.
    expect(
      (weigh('I weigh 880 pounds', { weight: '880' }) as { action: { weightKg: number } }).action
        .weightKg
    ).toBeCloseTo(399.2, 1);
  });

  it('with the tool picked, is always ok and leaves the value empty when unreadable', () => {
    expect(weigh('I weigh something', {}, { chosen: true })).toEqual({
      ok: true,
      action: {
        kind: 'logWeight',
        day: localMidnight(2026, 10, 26),
        weightKg: null,
      },
    });
  });

  it('with the tool picked, defaults the day to today even when tomorrow was said', () => {
    expect(
      weigh('I weigh 82.4', { weight: 'tomorrow', day: 'tomorrow' }, { chosen: true })
    ).toEqual({
      ok: true,
      action: expect.objectContaining({ day: localMidnight(2026, 10, 26), weightKg: 82.4 }),
    });
  });
});

describe('resolveLogMeal', () => {
  it('uses the trimmed transcript as the description', () => {
    expect(
      resolveLogMeal(command({ tool: 'log_meal' }), {
        now: NOW,
        transcript: '  two eggs and toast  ',
        weightUnit: 'kg',
      })
    ).toEqual({
      ok: true,
      action: {
        kind: 'logMeal',
        day: localMidnight(2026, 10, 26),
        mealType: 'lunch',
        description: 'two eggs and toast',
      },
    });
  });

  it('takes the meal from the slot, else from the hour', () => {
    const morning = new Date(2026, 10, 26, 8, 0);
    const named = resolveLogMeal(command({ tool: 'log_meal', meal: 'dinner' }), {
      now: morning,
      transcript: 'dinner',
      weightUnit: 'kg',
    });
    const byHour = resolveLogMeal(command({ tool: 'log_meal' }), {
      now: morning,
      transcript: 'eggs',
      weightUnit: 'kg',
    });

    expect(named.ok && named.action.kind === 'logMeal' && named.action.mealType).toBe('dinner');
    expect(byHour.ok && byHour.action.kind === 'logMeal' && byHour.action.mealType).toBe(
      'breakfast'
    );
  });
});

describe('resolveAddNote', () => {
  it('uses the model wording when nearly all of it was said', () => {
    expect(
      resolveAddNote(command({ tool: 'add_note', text: 'my knee hurt today' }), {
        now: NOW,
        transcript: 'Note that my knee hurt today',
        weightUnit: 'kg',
      })
    ).toEqual({ ok: true, action: { kind: 'addNote', body: 'my knee hurt today' } });
  });

  it('falls back to everything that was said when the wording was not', () => {
    expect(
      resolveAddNote(command({ tool: 'add_note', text: 'completely invented sentence' }), {
        now: NOW,
        transcript: 'Remember the gym key',
        weightUnit: 'kg',
      })
    ).toEqual({ ok: true, action: { kind: 'addNote', body: 'Remember the gym key' } });
  });

  it('uses the transcript when the model gave no text', () => {
    expect(
      resolveAddNote(command({ tool: 'add_note', text: null }), {
        now: NOW,
        transcript: '  buy oats  ',
        weightUnit: 'kg',
      })
    ).toEqual({ ok: true, action: { kind: 'addNote', body: 'buy oats' } });
  });
});

describe('resolveGoTo', () => {
  it('opens the screen said', () => {
    expect(
      resolveVoiceCommand(command({ tool: 'go_to', screen: 'progress' }), {
        now: NOW,
        transcript: 'show my progress',
        weightUnit: 'kg',
      })
    ).toEqual({ ok: true, action: { kind: 'goTo', screen: 'progress' } });
  });

  it('is rejected without a screen unless the person picked the tool', () => {
    expect(resolveGoTo(command({ tool: 'go_to' }), ctx(NOW))).toEqual({
      ok: false,
      reason: 'cantDetermine',
    });
    expect(resolveGoTo(command({ tool: 'go_to' }), { ...ctx(NOW), chosen: true })).toEqual({
      ok: true,
      action: { kind: 'goTo', screen: 'home' },
    });
  });
});
