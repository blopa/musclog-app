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

  it('turns a bad enum value into a null slot, not a rejected command', () => {
    const [command] =
      parseVoiceCommands({
        commands: [{ tool: 'copy_meal', meal: 'brunch', from_day: 'last_week' }],
      }) ?? [];

    expect(command.tool).toBe('copy_meal');
    expect(command.meal).toBeNull();
    expect(command.fromDay).toBeNull();
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
