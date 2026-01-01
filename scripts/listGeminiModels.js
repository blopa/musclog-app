// Quick script to list available models in Google's OpenAI-compatible endpoint
require('dotenv').config();
const OpenAI = require('openai');

const { EXPO_PUBLIC_GEMINI_API_KEY } = process.env;

if (!EXPO_PUBLIC_GEMINI_API_KEY) {
    console.error('Error: EXPO_PUBLIC_GEMINI_API_KEY not found');
    process.exit(1);
}

const openai = new OpenAI({
    apiKey: EXPO_PUBLIC_GEMINI_API_KEY,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

async function listModels() {
    try {
        console.log('Fetching available models...\n');
        const models = await openai.models.list();
        
        console.log('Available models:');
        for await (const model of models) {
            console.log(`  - ${model.id}`);
        }
    } catch (error) {
        console.error('Error listing models:', error.message);
    }
}

listModels();

