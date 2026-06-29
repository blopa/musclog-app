/*
 * Shared hardware layout constants for the Musclog Game Boy Color SRAM format.
 * Imported by both decodeGameBoySave.ts and decodeGameBoySave.demo.ts to avoid
 * duplicating values that mirror the C definitions in gameboy/src/data/.
 */

// custom_foods.h: base food-index offset that distinguishes custom-food slots
// from bundled food table indices.
export const CUSTOM_FOOD_BASE = 0x8000;

// custom_foods.h: maximum number of custom food slots in bank 3.
export const MAX_CUSTOM_FOODS = 100;
