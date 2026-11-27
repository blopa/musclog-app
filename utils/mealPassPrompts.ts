import { FunctionDeclaration } from '@google/genai';
import OpenAI from 'openai';

import { foodLookupProperties } from './prompts';
import type { MealSchemaDialect } from './structuredDialect';

/**
 * The second look at a meal estimate (Thinking: High and up). Structured output, so persona-free.
 * The model sees the estimate and the person's description or photo and names only what the
 * evidence shows is missing or off; empty lists are a complete answer.
 */
export const getMealReviewPrompt = (
  meal: {
    mealName?: string;
    ingredients: {
      name: string;
      grams: number;
      kcal: number;
      protein: number;
      carbs: number;
      fat: number;
    }[];
  },
  language?: string
): string => {
  const sections = [
    'You are an expert nutritionist reviewing a meal estimate.',
    `The meal is "${meal.mealName ?? 'a meal'}". Its estimated ingredients are:`,
    '```json',
    JSON.stringify(
      meal.ingredients.map(({ name, grams, kcal, protein, carbs, fat }) => ({
        name,
        grams,
        kcal,
        protein,
        carbs,
        fat,
      })),
      null,
      2
    ),
    '```',
    '',
    "Compare it with the person's description and/or the photo and answer two things:",
    '1. missingIngredients: things that were eaten but are not listed (cooking oil, butter, sauce, dressing, a drink). Only list one when the description or photo gives evidence for it; never invent ingredients. Give each one its "englishName" too: its plain English food name, used only to look the food up in a database and never shown (repeat "name" when that is already English).',
    '2. corrections: listed ingredients whose gram amount looks clearly wrong, with the corrected grams. Use the exact listed name.',
    'Empty lists are a valid, often correct answer. Do not return macros.',
  ];

  if (language) {
    sections.push(`Ingredient names must be in ${language}.`);
  }

  return sections.join('\n');
};

export const getMealReviewFunctions = (
  dialect: MealSchemaDialect = 'gemini'
): FunctionDeclaration[] | OpenAI.Chat.ChatCompletionCreateParams.Function[] => {
  const added = foodLookupProperties(dialect, { foodId: false, englishName: true });

  return [
    {
      name: 'reviewMealEstimate',
      description:
        'Name the ingredients missing from a meal estimate and the portions that look wrong.',
      parameters: {
        type: 'object',
        properties: {
          missingIngredients: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Name of the ingredient that was eaten' },
                grams: { type: 'number', description: 'Estimated weight in grams' },
                ...added.properties,
              },
              required: ['name', 'grams', ...added.required],
            },
          },
          corrections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'The listed ingredient name, exactly' },
                grams: { type: 'number', description: 'The corrected weight in grams' },
              },
              required: ['name', 'grams'],
            },
          },
        },
        required: ['missingIngredients', 'corrections'],
      },
    },
  ];
};

/**
 * The first look at a meal (Thinking: Tokenmaxxing). Structured output, so persona-free.
 * Seeing is kept apart from estimating: the answer holds no calories and no weight of any food, and
 * is handed to the recipe extraction as notes. The scene comes first because portion weights are
 * only as good as the sense of scale behind them: the container, how big it is, how it is held and
 * where it was served say more about a portion than the food names do.
 */
export const getMealObservationPrompt = (language?: string): string => {
  const sections = [
    'You are looking at a meal, from a photo and/or a written description, before anyone estimates it.',
    'Describe the scene first, then what is in it. Do NOT return calories, macros or the weight in grams of any food.',
    '1. scene: one or two plain sentences, as a person would describe the picture: how the food is held or served, the container, where it was taken and from what angle. For example: "A hand holding a regular-size dinner plate with rice and curry, taken at a restaurant, from above." With no photo, one sentence restating how the meal was described.',
    '2. setting: where the meal was served (restaurant, canteen, home, takeaway, packaged, street food and so on) or "unknown". Restaurant and takeaway portions are often larger than home ones.',
    '3. container: what holds the food (plate, bowl, takeaway box, cup, wrapper, hand) or "unknown".',
    '4. containerSize: how big the container is, judged from the picture, in words or centimetres (the container, never the food). For example "regular dinner plate, about 26 cm across" or "small bowl, about 12 cm". Use things of known size to judge it: a standard dinner plate is about 25 to 28 cm, a fork about 19 cm, an adult hand about 18 cm long, a soda can about 12 cm tall. "unknown" when you cannot tell.',
    '5. scaleCues: the things in the picture you used to judge size (cutlery, a hand, a can, packaging, the table).',
    '6. items: everything visible or stated. For each give the name, the portion in VISUAL words including how much of the container it fills (for example "a third of the plate", "heaped, about 3 cm deep", "two slices"), how it was prepared if you can tell, and your confidence (high, medium or low).',
    '7. addedFats: visible added fats, sauces, dressings, toppings and drinks.',
    '8. extras: other things that are visibly or explicitly part of the meal and do not fit above.',
    '9. uncertain: things that might be present but you cannot tell.',
    'For a written description with no photo, also add the usual hidden parts (cooking oil, butter, dressing) as items with low confidence.',
    'Never invent foods that neither the photo nor the description supports.',
    'If the input shows several separate meals, set mealCount to how many.',
  ];

  if (language) {
    sections.push(`Your response must be in ${language}.`);
  }

  return sections.join('\n');
};

export const getMealObservationFunctions = ():
  FunctionDeclaration[] | OpenAI.Chat.ChatCompletionCreateParams.Function[] => [
  {
    name: 'observeMeal',
    description: 'Describe the scene and contents of a meal in detail, without calories or grams.',
    parameters: {
      type: 'object',
      properties: {
        mealCount: { type: 'number', description: 'How many separate meals the input shows' },
        scene: {
          type: 'string',
          description:
            'One or two plain sentences describing the picture: how the food is held or served, the container, the place, the angle',
        },
        setting: {
          type: 'string',
          description: 'Where the meal was served (restaurant, home, takeaway, ...) or "unknown"',
        },
        container: {
          type: 'string',
          description: 'What holds the food (plate, bowl, box, cup, hand, ...) or "unknown"',
        },
        containerSize: {
          type: 'string',
          description:
            'How big the container is, in words or centimetres, never the food: for example "regular dinner plate, about 26 cm across", or "unknown"',
        },
        scaleCues: {
          type: 'array',
          items: { type: 'string' },
          description: 'The things in the picture used to judge size',
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the food' },
              portion: {
                type: 'string',
                description:
                  'The portion in visual words, including how much of the container it fills, never grams',
              },
              preparation: {
                type: 'string',
                description: 'How it was prepared, or an empty string when unknown',
              },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
            required: ['name', 'portion', 'preparation', 'confidence'],
          },
        },
        addedFats: { type: 'array', items: { type: 'string' } },
        extras: { type: 'array', items: { type: 'string' } },
        uncertain: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'mealCount',
        'scene',
        'setting',
        'container',
        'containerSize',
        'scaleCues',
        'items',
        'addedFats',
        'extras',
        'uncertain',
      ],
    },
  },
];

/**
 * The note every request of a multi-photo meal estimate carries in its user message, so the system
 * prompts can keep saying "the photo": several photos are one meal seen more than once, and a food
 * that shows up in two of them is still one food. Empty for a single photo.
 */
export function getMultiPhotoMealNote(photoCount: number): string {
  if (photoCount <= 1) {
    return '';
  }

  return [
    `These ${photoCount} photos show ONE meal: different angles, parts or close-ups of the same food.`,
    'A photo may show a menu, a label or a receipt instead of the food; use it as information about the meal.',
    'Count each food once, even when it appears in several photos, and judge its amount from the photo that shows it best.',
  ].join(' ');
}
