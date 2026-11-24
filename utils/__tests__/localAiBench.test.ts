import scenariosFile from '@/data/localAiBench/scenarios.json';
import {
  type BenchScenario,
  type BenchScenarioFile,
  scenarioFileProblems,
  scoreScenario,
} from '../localAiBench';

const file = scenariosFile as unknown as BenchScenarioFile;
const byId = (id: string) => file.scenarios.find((scenario) => scenario.id === id) as BenchScenario;

describe('local AI bench scenarios', () => {
  it('ships a well-formed file with English and Portuguese scenarios', () => {
    expect(scenarioFileProblems(file)).toEqual([]);
    expect(new Set(file.scenarios.map((scenario) => scenario.language))).toEqual(
      new Set(['en', 'pt'])
    );
  });

  it('lists the unsupported asks so they never count as failures', () => {
    expect(file.notSupported.length).toBeGreaterThan(0);
  });

  it('scores a correct meal as valid and correct', () => {
    const score = scoreScenario(byId('track-meal-en'), {
      mealType: 'lunch',
      foods: [
        { name: 'Grilled chicken', grams: 150 },
        { name: 'White rice', grams: 150 },
      ],
    });
    expect(score).toEqual({ schemaValid: true, fieldsCorrect: true, problems: [] });
  });

  it('names the wrong meal and the missing food', () => {
    const score = scoreScenario(byId('track-meal-en'), {
      mealType: 'dinner',
      foods: [{ name: 'chicken', grams: 150 }],
    });
    expect(score.schemaValid).toBe(true);
    expect(score.fieldsCorrect).toBe(false);
    expect(score.problems).toEqual([
      'mealType is dinner, expected lunch',
      'no food named like "rice"',
    ]);
  });

  it('counts a reply that breaks the schema as invalid', () => {
    const score = scoreScenario(byId('track-meal-pt'), { mealType: 'brunch', foods: [] });
    expect(score.schemaValid).toBe(false);
  });

  it('checks a text reply is not empty', () => {
    expect(scoreScenario(byId('yesterday-en'), 'You did legs.').fieldsCorrect).toBe(true);
    expect(scoreScenario(byId('yesterday-en'), '  ').fieldsCorrect).toBe(false);
  });
});
