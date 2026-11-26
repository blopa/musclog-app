import { parseVoiceCommands } from '@/utils/voiceCommand/parse';

describe('parseVoiceCommands', () => {
  it('returns null for a reply that is not an object', () => {
    expect(parseVoiceCommands(null)).toBeNull();
    expect(parseVoiceCommands('copy_meal')).toBeNull();
    expect(parseVoiceCommands(42)).toBeNull();
  });

  it('returns null for an object with neither commands nor tool', () => {
    expect(parseVoiceCommands({ foo: 1 })).toBeNull();
    expect(parseVoiceCommands({ commands: 'nope' })).toBeNull();
  });

  it('accepts a bare command object', () => {
    expect(parseVoiceCommands({ tool: 'search_food', food: 'egg' })).toEqual([
      {
        tool: 'search_food',
        meal: null,
        day: null,
        fromMeal: null,
        fromDay: null,
        food: 'egg',
      },
    ]);
  });

  it('drops an unknown tool and returns an empty list', () => {
    expect(parseVoiceCommands({ commands: [{ tool: 'delete_everything' }] })).toEqual([]);
  });

  it('tolerates case and spaces in enum values', () => {
    const [command] =
      parseVoiceCommands({
        commands: [
          { tool: ' Search_Food ', meal: ' LUNCH ', day: 'Yesterday', from_day: ' Monday ' },
        ],
      }) ?? [];

    expect(command.tool).toBe('search_food');
    expect(command.meal).toBe('lunch');
    expect(command.day).toBe('yesterday');
    expect(command.fromDay).toBe('monday');
  });

  it('drops a command with a value outside its choices, in any of the four slots', () => {
    const bad = [
      { meal: 'brunch' },
      { day: 'last_week' },
      { from_meal: 'elevenses' },
      { from_day: 'tomorrow' },
      { meal: 5 },
    ];

    for (const slots of bad) {
      expect(parseVoiceCommands({ commands: [{ tool: 'copy_meal', ...slots }] })).toEqual([]);
    }
  });

  it('drops a search_food whose food is not a string', () => {
    expect(parseVoiceCommands({ commands: [{ tool: 'search_food', food: 3 }] })).toEqual([]);
  });

  it('reads missing, null, blank and "null" slots as not said', () => {
    const [command] =
      parseVoiceCommands({
        commands: [
          { tool: 'copy_meal', meal: null, day: ' ', from_meal: 'NULL', from_day: undefined },
        ],
      }) ?? [];

    expect(command).toEqual({
      tool: 'copy_meal',
      meal: null,
      day: null,
      fromMeal: null,
      fromDay: null,
      food: null,
    });
  });

  it('trims food, caps it at 80 characters and reads "null" or blank as no food', () => {
    const [long] =
      parseVoiceCommands({
        commands: [{ tool: 'search_food', food: `  ${'a'.repeat(100)}  ` }],
      }) ?? [];
    expect(long.food).toHaveLength(80);

    for (const food of ['null', 'NULL', '', '   ']) {
      const [command] = parseVoiceCommands({ commands: [{ tool: 'search_food', food }] }) ?? [];
      expect(command.food).toBeNull();
    }
  });

  it('keeps only the first command', () => {
    const commands = parseVoiceCommands({
      commands: [
        { tool: 'search_food', food: 'egg' },
        { tool: 'copy_meal', fromDay: 'yesterday' },
      ],
    });

    expect(commands).toHaveLength(1);
    expect(commands?.[0].tool).toBe('search_food');
  });
});
