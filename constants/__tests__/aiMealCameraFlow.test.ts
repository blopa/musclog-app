import { SETTINGS } from '../settingDefinitions';
import {
  AI_MEAL_CAMERA_FLOWS,
  AI_MEAL_CAMERA_FLOW_SETTING_TYPE,
  parseAiMealCameraFlow,
} from '../settings';

describe('AI meal camera flow setting', () => {
  it('is stored under its own key and defaults to the detailed flow', () => {
    expect(AI_MEAL_CAMERA_FLOW_SETTING_TYPE).toBe('ai_meal_camera_flow');
    expect(SETTINGS.aiMealCameraFlow.type).toBe(AI_MEAL_CAMERA_FLOW_SETTING_TYPE);
    expect(SETTINGS.aiMealCameraFlow.defaultValue).toBe('detailed');
  });

  it('parses every offered flow and falls back to detailed otherwise', () => {
    for (const flow of AI_MEAL_CAMERA_FLOWS) {
      expect(parseAiMealCameraFlow(flow)).toBe(flow);
    }

    expect(parseAiMealCameraFlow('instant')).toBe('detailed');
    expect(parseAiMealCameraFlow('')).toBe('detailed');
    expect(parseAiMealCameraFlow(null)).toBe('detailed');
    expect(parseAiMealCameraFlow(undefined)).toBe('detailed');
  });

  it('round-trips every flow through its definition', () => {
    const def = SETTINGS.aiMealCameraFlow;
    for (const flow of AI_MEAL_CAMERA_FLOWS) {
      expect(def.parse(def.serialize(flow))).toBe(flow);
    }
  });
});
