// This script generates images for exercises that are missing them using Gemini native SDK
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const DIRNAME = __dirname;

// Paths
const EXERCISES_JSON_PATH = path.join(DIRNAME, '..', 'data', 'exercisesEnUS.json');
const EXERCISES_DIR = path.join(DIRNAME, '..', 'assets', 'exercises');

// Get API key from environment
const { EXPO_PUBLIC_GEMINI_API_KEY } = process.env;

if (!EXPO_PUBLIC_GEMINI_API_KEY) {
    console.error('Error: EXPO_PUBLIC_GEMINI_API_KEY not found in environment variables');
    console.error('Please create a .env file with EXPO_PUBLIC_GEMINI_API_KEY=your_api_key');
    process.exit(1);
}

// Function to generate image using Gemini native SDK
// Based on: https://ai.google.dev/gemini-api/docs/image-generation#javascript
async function generateExerciseImage(genAI, exerciseName, index) {
    console.log(`Generating image for exercise ${index}: ${exerciseName}...`);

    const prompt = `Generate a flat design image, with only grayscale colors, showing a person performing the "${exerciseName}" exercise.`;

    try {
        // Use gemini-2.5-flash-image model for image generation
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-image',
        });

        const result = await model.generateContent({
            contents: [{
                parts: [{
                    text: prompt,
                }],
                role: 'user',
            }],
        });

        if (result.response?.promptFeedback?.blockReason) {
            throw new Error(`Blocked: ${result.response.promptFeedback.blockReason}`);
        }

        const candidate = result.response?.candidates?.[0];
        if (!candidate) {
            throw new Error('No candidates in response');
        }

        // Get the image data from inlineData (as per official docs)
        const parts = candidate.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData) {
                // Return base64 image data
                return part.inlineData.data;
            }
        }

        throw new Error('No image data found in response');
    } catch (error) {
        throw error;
    }
}

// Function to check if image exists for an exercise index
// Note: images are 1-indexed (exercise at index 0 has image 1.webp)
function imageExists(index) {
    const imagePath = path.join(EXERCISES_DIR, `${index + 1}.webp`);
    return fs.existsSync(imagePath);
}

// Main function
async function main() {
    console.log('Starting exercise image generation...\n');

    // Load exercises JSON
    if (!fs.existsSync(EXERCISES_JSON_PATH)) {
        console.error(`Error: Exercises file not found at ${EXERCISES_JSON_PATH}`);
        process.exit(1);
    }

    const exercises = JSON.parse(fs.readFileSync(EXERCISES_JSON_PATH, 'utf8'));
    console.log(`Loaded ${exercises.length} exercises from ${EXERCISES_JSON_PATH}\n`);

    // Ensure exercises directory exists
    if (!fs.existsSync(EXERCISES_DIR)) {
        console.log(`Creating exercises directory at ${EXERCISES_DIR}`);
        fs.mkdirSync(EXERCISES_DIR, { recursive: true });
    }

    // Find missing images
    const missingImages = [];
    for (let i = 0; i < exercises.length; i++) {
        if (!imageExists(i)) {
            missingImages.push({ index: i, name: exercises[i].name });
        }
    }

    if (missingImages.length === 0) {
        console.log('All exercises already have images! ✓');
        return;
    }

    console.log(`Found ${missingImages.length} exercises missing images:\n`);
    missingImages.forEach(({ index, name }) => {
        console.log(`  [${index + 1}.webp] ${name}`);
    });
    console.log('');

    // Initialize Gemini AI with native SDK
    const genAI = new GoogleGenerativeAI(EXPO_PUBLIC_GEMINI_API_KEY);

    // Generate images for missing exercises
    let successCount = 0;
    let failCount = 0;

    for (const { index, name } of missingImages) {
        try {
            // Generate image (returns base64 data)
            const imageData = await generateExerciseImage(genAI, name, index);

            // Save image directly from base64 (images are 1-indexed)
            const outputPath = path.join(EXERCISES_DIR, `${index + 1}.webp`);
            // eslint-disable-next-line no-undef
            const buffer = Buffer.from(imageData, 'base64');
            fs.writeFileSync(outputPath, buffer);
            console.log(`  Saved to ${outputPath}`);

            successCount++;

            // Add a small delay between requests to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`  Failed to generate image for ${name}: ${error.message}`);
            failCount++;
        }
    }

    console.log('\n=== Summary ===');
    console.log(`Successfully generated: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Total missing: ${missingImages.length}`);
}

// Execute the main function
main().catch(console.error);
