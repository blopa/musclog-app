const fs = require('fs');
const path = require('path');

function getFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getFiles(filePath, fileList);
        } else {
            fileList.push(filePath);
        }
    });

    return fileList;
}

function searchFile(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const regex = /t\(['"]([^'"]+)['"]\)/g;
    let match;

    while ((match = regex.exec(fileContent)) !== null) {
        console.log(`"${match[1]}": "${match[1]}",`);
    }
}

function searchInDirectory(directory) {
    const files = getFiles(directory);
    files.forEach((file) => {
        searchFile(file);
    });
}

searchInDirectory('components');
