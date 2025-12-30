const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const DIRNAME = __dirname;

const generateHash = (length = 32) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const charactersLength = characters.length;
    let result = '';

    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
};

const NUTRITION_TYPES = {
    FULL_DAY: 'full_day',
    MEAL: 'meal',
};

const USER_METRICS_SOURCES = {
    HEALTH_CONNECT: 'health_connect',
    USER_INPUT: 'user_input',
};

function convertCsvToJson(csvFilePath, outputJsonFilePath) {
    const results = [];

    fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
            const mealTypeMapping = {
                breakfast: 'meal',
                dinner: 'meal',
                lunch: 'meal',
                snack: 'meal',
            };

            const entry = {
                calories: parseFloat(row.calories),
                carbs: parseFloat(row.carbs),
                // createdAt: new Date().toISOString(),
                // dataId: generateHash(),
                date: row.date,
                fat: parseFloat(row.fat),
                fiber: row.carbs_fiber ? parseFloat(row.carbs_fiber) : 0,
                // id: generateHash(),
                monounsaturatedFat: 0,
                name: row.title || 'Unnamed Food Item',
                polyunsaturatedFat: 0,
                protein: parseFloat(row.protein),
                saturatedFat: row.fat_saturated ? parseFloat(row.fat_saturated) : 0,
                source: USER_METRICS_SOURCES.USER_INPUT,
                sugar: row.carbs_sugar ? parseFloat(row.carbs_sugar) : 0,
                transFat: 0,
                type: mealTypeMapping[row.meal_type.toLowerCase()] || NUTRITION_TYPES.MEAL,
                unsaturatedFat: row.fat_unsaturated ? parseFloat(row.fat_unsaturated) : 0,
            };

            results.push(entry);
        })
        .on('end', () => {
            fs.writeFileSync(outputJsonFilePath, JSON.stringify(results, null, 2));
            console.log('CSV file successfully converted to JSON!');
        });
}

const csvFilePath = path.resolve(DIRNAME, '..', 'dumps', 'lifesum.csv');
const outputJsonFilePath = path.resolve(DIRNAME, '..', 'dumps', 'lifesum.json');
convertCsvToJson(csvFilePath, outputJsonFilePath);
