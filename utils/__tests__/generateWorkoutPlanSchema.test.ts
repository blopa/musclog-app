import { getGenerateWorkoutPlanFunctions } from '@/utils/prompts';

describe('generate workout plan schema', () => {
  it('requires planTitle and every declared top-level property for strict providers', () => {
    const declaration = getGenerateWorkoutPlanFunctions()[0] as any;
    const properties = declaration.parameters.properties;

    expect(properties.planTitle).toEqual(expect.objectContaining({ type: 'string' }));
    expect(new Set(declaration.parameters.required)).toEqual(new Set(Object.keys(properties)));
  });
});
