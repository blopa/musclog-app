import { FunctionDeclaration } from '@google/genai';
import OpenAI from 'openai';

/** On-device prompts: a tiny model is best at a nutrition-facts label per 100 g, by name only. */
export const getOnDeviceLabelPrompt = (names: string[]): string =>
  `Nutrition facts labels, per 100 g, for each food in this list:\n${JSON.stringify(names)}`;

export const getOnDeviceLabelUserMessage = (): string => 'Answer in JSON.';

export const getOnDeviceLabelFunctions = ():
  FunctionDeclaration[] | OpenAI.Chat.ChatCompletionCreateParams.Function[] => [
  {
    name: 'estimateLabels',
    description: 'Nutrition facts label per 100 g for each food.',
    parameters: {
      type: 'object',
      properties: {
        foods: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the food' },
              kcal: { type: 'number', description: 'Kilocalories per 100 g' },
              protein: { type: 'number', description: 'Protein in grams per 100 g' },
              carbs: { type: 'number', description: 'Carbohydrates in grams per 100 g' },
              fat: { type: 'number', description: 'Fat in grams per 100 g' },
            },
            required: ['name', 'kcal', 'protein', 'carbs', 'fat'],
          },
        },
      },
      required: ['foods'],
    },
  },
];

export const getOnDeviceFiberPrompt = (names: string[]): string =>
  `Dietary fiber on the nutrition facts label, grams per 100 g, for each food in this list:\n${JSON.stringify(names)}`;

export const getOnDeviceFiberFunctions = ():
  FunctionDeclaration[] | OpenAI.Chat.ChatCompletionCreateParams.Function[] => [
  {
    name: 'estimateFiber',
    description: 'Dietary fiber in grams per 100 g for each food.',
    parameters: {
      type: 'object',
      properties: {
        foods: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the food' },
              fiber: { type: 'number', description: 'Dietary fiber in grams per 100 g' },
            },
            required: ['name', 'fiber'],
          },
        },
      },
      required: ['foods'],
    },
  },
];
