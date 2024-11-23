// This script doesn't really work because the translation file is too large for OpenAI to handle.
// It's better to use a service like Google Translate API for this.
require('dotenv').config();
const fs = require('fs');
const OpenAI = require('openai');
const path = require('path');

const DIRNAME = __dirname;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Main function
async function main() {
    const inputFilePath = path.join(DIRNAME, '..', 'lang', 'locales', 'en-us.json');
    const outputFilePath = path.join(DIRNAME, '..', 'lang', 'locales', 'it.json');

    // Load the input JSON file
    const content = fs.readFileSync(inputFilePath, 'utf8');

    // Translate the content
    const translatedContent = await translateContent(content, 'Italian');

    // Save the translated content to a new file
    fs.writeFileSync(outputFilePath, translatedContent, 'utf8');

    console.log(`Translation completed and saved to ${outputFilePath}`);
}

// Function to translate the content
async function translateContent(content, targetLanguage) {
    const messages = [
        {
            content: `Translate the following JSON keys and values to ${targetLanguage}. Only translate the values, not the keys.`,
            role: 'system',
        },
        {
            content: content,
            role: 'user',
        },
    ];

    const response = await openai.chat.completions.create({
        function_call: { name: 'translate' },
        functions: [{
            description: 'Translates the given JSON object values to the specified language.',
            name: 'translate',
            parameters: {
                properties: {
                    translatedContent: {
                        description: 'The translated JSON content.',
                        type: 'object',
                    },
                },
                required: ['translatedContent'],
                type: 'object',
            },
        }],
        messages,
        model: 'gpt-4o',
    });

    const result = JSON.parse(response?.choices?.[0]?.message?.function_call?.arguments || '{}');

    if (result.translatedContent) {
        return JSON.stringify(result.translatedContent);
    }

    return response?.choices?.[0]?.message?.function_call?.arguments;
}

// Execute the main function
main().catch(console.error);
