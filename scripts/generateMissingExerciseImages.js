// This script generates images for exercises that are missing them using Gemini
require('dotenv').config();
const fs = require('fs');
const https = require('https');
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

// Function to download image from URL and save as webp
async function downloadImage(imageUrl, outputPath) {
    return new Promise((resolve, reject) => {
        // Construct the download URL with API key
        const downloadUrl = `${imageUrl}?key=${EXPO_PUBLIC_GEMINI_API_KEY}`;

        https.get(downloadUrl, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download image: ${res.statusCode}`));
                return;
            }

            const fileStream = fs.createWriteStream(outputPath);
            res.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`  Saved to ${outputPath}`);
                resolve();
            });

            fileStream.on('error', (error) => {
                fs.unlink(outputPath, () => {}); // Delete partial file
                reject(error);
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// Function to generate image using Gemini REST API
async function generateExerciseImage(exerciseName, index) {
    console.log(`Generating image for exercise ${index}: ${exerciseName}...`);

    const prompt = `Generate a flat design image, with only grayscale colors, showing a person performing the "${exerciseName}" exercise.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${EXPO_PUBLIC_GEMINI_API_KEY}`;

    const requestBody = JSON.stringify({
        contents: [{
            parts: [{
                text: prompt,
            }],
        }],
        generationConfig: {
            responseMimeType: 'image/jpeg',
            temperature: 0.9,
            topK: 1,
            topP: 1,
        },
    });

    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                // eslint-disable-next-line no-undef
                'Content-Length': Buffer.byteLength(requestBody),
                'Content-Type': 'application/json',
            },
            method: 'POST',
        };

        const req = https.request(url, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);

                    if (response.error) {
                        console.error(`  Error: ${response.error.message}`);
                        reject(new Error(response.error.message));
                        return;
                    }

                    // Check if we got a valid response
                    const candidate = response.candidates?.[0];
                    if (!candidate) {
                        console.error('  No candidates in response');
                        reject(new Error('No candidates in response'));
                        return;
                    }

                    // Get the file URI from the response
                    const fileUri = candidate.content?.parts?.[0]?.fileData?.fileUri;

                    if (fileUri) {
                        resolve(fileUri);
                    } else {
                        console.error('  No fileUri found in response');
                        reject(new Error('No fileUri in response'));
                    }
                } catch (error) {
                    console.error(`  Error parsing response: ${error.message}`);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error(`  Request error: ${error.message}`);
            reject(error);
        });

        req.write(requestBody);
        req.end();
    });
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

    // Generate images for missing exercises
    let successCount = 0;
    let failCount = 0;

    for (const { index, name } of missingImages) {
        try {
            // Generate image
            const imageUri = await generateExerciseImage(name, index);

            // Download and save image (images are 1-indexed)
            const outputPath = path.join(EXERCISES_DIR, `${index + 1}.webp`);
            await downloadImage(imageUri, outputPath);

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
