import { parseChosenCommand, parseVoiceCommands } from '@/utils/voiceCommand/parse';

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
        weight: null,
        text: null,
        screen: null,
        cameraMode: null,
        activity: null,
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
      weight: null,
      text: null,
      screen: null,
      cameraMode: null,
      activity: null,
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

  it('reads a weight given as a JSON number as its digits', () => {
    const [command] =
      parseVoiceCommands({ commands: [{ tool: 'log_weight', weight: 82.4 }] }) ?? [];

    expect(command.weight).toBe('82.4');
  });

  it('reads a weight given as a string', () => {
    const [command] =
      parseVoiceCommands({ commands: [{ tool: 'log_weight', weight: '82,4' }] }) ?? [];

    expect(command.weight).toBe('82,4');
  });

  it('reads note text and a screen as their slots', () => {
    const [note] = parseVoiceCommands({ commands: [{ tool: 'add_note', text: 'buy oats' }] }) ?? [];
    const [go] = parseVoiceCommands({ commands: [{ tool: 'go_to', screen: 'Progress' }] }) ?? [];

    expect(note.text).toBe('buy oats');
    expect(go.screen).toBe('progress');
  });

  it('reads camera_mode and activity choices', () => {
    const [camera] =
      parseVoiceCommands({ commands: [{ tool: 'open_camera', camera_mode: ' LABEL ' }] }) ?? [];
    const [cardio] =
      parseVoiceCommands({ commands: [{ tool: 'log_cardio', activity: 'WALK' }] }) ?? [];

    expect(camera.cameraMode).toBe('label');
    expect(cardio.activity).toBe('walk');
  });

  it('drops a new-tool command with a value outside its choices', () => {
    expect(
      parseVoiceCommands({ commands: [{ tool: 'open_camera', camera_mode: 'portrait' }] })
    ).toEqual([]);
    expect(parseVoiceCommands({ commands: [{ tool: 'log_cardio', activity: 'cycle' }] })).toEqual(
      []
    );
  });

  it('turns a tool that was not offered into cant_determine_tool with every slot empty', () => {
    const commands = parseVoiceCommands({ commands: [{ tool: 'log_weight', weight: '80' }] }, [
      'search_food',
      'copy_meal',
    ]);

    expect(commands).toEqual([
      {
        tool: 'cant_determine_tool',
        meal: null,
        day: null,
        fromMeal: null,
        fromDay: null,
        food: null,
        weight: null,
        text: null,
        screen: null,
        cameraMode: null,
        activity: null,
      },
    ]);
  });

  it('keeps an offered tool and the two non-actions whatever is offered', () => {
    const [offered] =
      parseVoiceCommands({ commands: [{ tool: 'search_food', food: 'egg' }] }, ['search_food']) ??
      [];
    const [none] = parseVoiceCommands({ commands: [{ tool: 'none' }] }, ['search_food']) ?? [];

    expect(offered.tool).toBe('search_food');
    expect(none.tool).toBe('none');
  });
});

describe('parseChosenCommand', () => {
  it('always answers with the picked tool, leaving unusable slots empty', () => {
    const command = parseChosenCommand(
      { commands: [{ tool: 'none', from_day: 'tomorrow', meal: 'breakfast' }] },
      'copy_meal'
    );

    expect(command).toEqual({
      tool: 'copy_meal',
      meal: 'breakfast',
      day: null,
      fromMeal: null,
      fromDay: null,
      food: null,
      weight: null,
      text: null,
      screen: null,
      cameraMode: null,
      activity: null,
    });
  });

  it('answers the picked tool with nothing filled for an unreadable reply', () => {
    expect(parseChosenCommand(null, 'go_to')).toMatchObject({ tool: 'go_to', screen: null });
  });
});
