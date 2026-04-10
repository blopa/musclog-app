#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * Script to generate missing exercise images using Google's Gemini API.
 *
 * Usage:
 *   GEMINI_API_KEY=your_key node scripts/generate-missing-exercise-images.js
 *
 * The script will:
 * 1. Load exercises from data/exercisesEnUS.json
 * 2. Check which images exist in assets/exercises/
 * 3. Generate missing images one at a time using Gemini
 *
 * Image naming: exercise{N}.png where N is array index + 1
 * (index 0 -> exercise1.png, index 1 -> exercise2.png, etc.)
 */

const fs = require('fs');
const path = require('path');

// --- Configuration ---
const EXERCISES_JSON_PATH = path.join(__dirname, '..', 'data', 'exercisesEnUS.json');
const EXERCISES_ASSETS_DIR = path.join(__dirname, '..', 'assets', 'exercises');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-image';

// --- Helper Functions ---

/**
 * Loads exercises from the JSON file.
 * @returns {Array<{name: string, muscleGroup: string, type: string, description: string, targetMuscles: string[], loadMultiplier: number}>}
 */
function loadExercises() {
  console.log(`Loading exercises from: ${EXERCISES_JSON_PATH}`);
  const jsonData = fs.readFileSync(EXERCISES_JSON_PATH, 'utf8');
  const exercises = JSON.parse(jsonData);
  console.log(`Loaded ${exercises.length} exercises.`);
  return exercises;
}

/**
 * Gets the list of existing exercise image numbers.
 * @returns {Set<number>}
 */
function getExistingImageNumbers() {
  const existing = new Set();

  if (!fs.existsSync(EXERCISES_ASSETS_DIR)) {
    console.log(`Creating exercises directory: ${EXERCISES_ASSETS_DIR}`);
    fs.mkdirSync(EXERCISES_ASSETS_DIR, { recursive: true });
    return existing;
  }

  const files = fs.readdirSync(EXERCISES_ASSETS_DIR);
  for (const file of files) {
    const match = file.match(/^exercise(\d+)\.png$/i);
    if (match) {
      existing.add(parseInt(match[1], 10));
    }
  }

  return existing;
}

/**
 * Generates an art prompt for an exercise.
 * @param {Object} exercise
 * @param {number} index - The exercise index (0-based)
 * @returns {string}
 */
function generateArtPrompt(exercise, index) {
  const styleKeywords = [
    'high-contrast grayscale digital illustration',
    'clean vector art style',
    'thick bold black outlines',
    'distinct cell-shading',
    'anatomical detail',
    'fitness infographic style',
    'flat textured grey background',
    'studio lighting',
    'polished and clean',
    'full body figure',
    'professional exercise demonstration',
  ];

  const targetMusclesText = exercise.targetMuscles
    ? exercise.targetMuscles.join(', ').replace(/_/g, ' ')
    : 'various muscles';

  return `${styleKeywords.join(', ')} | A central athletic figure performing the "${exercise.name}" exercise (${exercise.description}). The figure demonstrates proper form and technique. Target muscles highlighted through subtle shading: ${targetMusclesText}. Muscle group: ${exercise.muscleGroup}. Clean, professional fitness illustration style suitable for a mobile fitness app. CRITICAL: NO text, NO words, NO letters, NO labels, NO captions, NO titles, NO watermarks, NO typography anywhere in the image. Purely visual illustration only.`.trim();
}

/**
 * Generates an image using Google's Gemini API.
 * @param {string} prompt - The image generation prompt
 * @param {string} outputPath - Where to save the image
 * @returns {Promise<boolean>}
 */
async function generateImageWithGemini(prompt, outputPath) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['Text', 'Image'],
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Extract image data from response
  // The response structure has candidates -> content -> parts -> inlineData
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('No candidates in Gemini response');
  }

  const candidate = data.candidates[0];
  if (!candidate.content || !candidate.content.parts) {
    throw new Error('No content parts in Gemini response');
  }

  // Find the inline data (image) part
  const imagePart = candidate.content.parts.find(part => part.inlineData);
  if (!imagePart || !imagePart.inlineData) {
    throw new Error('No image data in Gemini response');
  }

  // Decode base64 image data
  const imageData = imagePart.inlineData.data;
  const imageBuffer = Buffer.from(imageData, 'base64');

  fs.writeFileSync(outputPath, imageBuffer);

  return true;
}

/**
 * Sleeps for a specified number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main execution function.
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Exercise Image Generation Script (Gemini)');
  console.log('='.repeat(60));

  // Check for API key
  if (!GEMINI_API_KEY) {
    console.error('\n❌ Error: GEMINI_API_KEY environment variable is not set.');
    console.error('Please set it before running the script:');
    console.error('  GEMINI_API_KEY=your_key node scripts/generate-missing-exercise-images.js\n');
    console.error('Or use EXPO_PUBLIC_GEMINI_API_KEY from your .env file.\n');
    process.exit(1);
  }

  // Load exercises
  let exercises;
  try {
    exercises = loadExercises();
  } catch (err) {
    console.error(`❌ Failed to load exercises: ${err.message}`);
    process.exit(1);
  }

  // Get existing images
  const existingImages = getExistingImageNumbers();
  console.log(`Found ${existingImages.size} existing exercise images.`);

  // Find missing images
  const missingExercises = [];
  for (let i = 0; i < exercises.length; i++) {
    const imageNumber = i + 1; // Array index 0 -> exercise1.png
    if (!existingImages.has(imageNumber)) {
      missingExercises.push({
        index: i,
        imageNumber: imageNumber,
        exercise: exercises[i],
      });
    }
  }

  if (missingExercises.length === 0) {
    console.log('\n✅ All exercise images already exist! Nothing to generate.');
    return;
  }

  console.log(`\n📝 Found ${missingExercises.length} missing exercise images.`);
  console.log(`Missing: ${missingExercises.map(m => m.imageNumber).join(', ')}\n`);

  // Generate missing images one at a time
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < missingExercises.length; i++) {
    const { index, imageNumber, exercise } = missingExercises[i];
    const outputFilename = `exercise${imageNumber}.png`;
    const outputPath = path.join(EXERCISES_ASSETS_DIR, outputFilename);

    console.log(`\n[${i + 1}/${missingExercises.length}] Generating: ${outputFilename}`);
    console.log(`  Exercise: ${exercise.name}`);
    console.log(`  Muscle Group: ${exercise.muscleGroup}`);

    try {
      const prompt = generateArtPrompt(exercise, index);
      console.log(`  Prompt length: ${prompt.length} chars`);

      await generateImageWithGemini(prompt, outputPath);

      console.log(`  ✅ Saved to: ${outputPath}`);
      successCount++;

      // Rate limiting: wait between requests (avoid hitting rate limits)
      if (i < missingExercises.length - 1) {
        console.log('  ⏳ Waiting 4 seconds before next request...');
        await sleep(4000);
      }
    } catch (err) {
      console.error(`  ❌ Error generating ${outputFilename}: ${err.message}`);
      failCount++;

      // Continue with next image even if one fails
      if (i < missingExercises.length - 1) {
        console.log('  ⏳ Waiting 4 seconds before next request...');
        await sleep(4000);
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Generation Complete!');
  console.log('='.repeat(60));
  console.log(`✅ Successfully generated: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total processed: ${missingExercises.length}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
