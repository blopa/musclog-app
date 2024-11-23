const fs = require('fs');
const path = require('path');

const DIRNAME = __dirname;

// Path to the JSON file
const jsonFilePath = path.join(DIRNAME, '..', 'data', 'exercisesEnUS.json');

// Function to generate HTML content
function generateHTML(jsonData) {
    let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exercise List</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { text-align: center; }
        ul { list-style-type: none; padding: 0; }
        li { background: #f4f4f4; margin: 5px 0; padding: 10px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Exercise List</h1>
    <ul>`;

    jsonData.forEach((exercise, index) => {
        const image = `${index + 1}.webp`;
        htmlContent += `<li><h1>${exercise.name} - ${image}</h1><br/><img src="exercises/${image}"/></li>\n`;
    });

    htmlContent += `
    </ul>
</body>
</html>`;
    return htmlContent;
}

// Read the JSON file
fs.readFile(jsonFilePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading the JSON file:', err);
        return;
    }

    try {
        const jsonData = JSON.parse(data);
        const htmlContent = generateHTML(jsonData);

        // Write the HTML content to a file
        fs.writeFile(path.join(DIRNAME, '..', 'assets', 'exercises.html'), htmlContent, 'utf8', (err) => {
            if (err) {
                console.error('Error writing the HTML file:', err);
                return;
            }
            console.log('HTML file has been generated successfully.');
        });
    } catch (parseErr) {
        console.error('Error parsing the JSON file:', parseErr);
    }
});
