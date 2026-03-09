#!/usr/bin/env node
/* eslint-disable no-undef */

const fs = require('fs');
const path = require('path');

// Target the 'exercise' folder in the same directory as this script
const directoryPath = path.join(__dirname, 'assets/exercises/');

fs.readdir(directoryPath, (err, files) => {
  if (err) {
    return console.error(
      'Error reading the directory. Make sure the folder is named "exercise" and is in the same location as this script. Details: ',
      err
    );
  }

  let renamedCount = 0;

  files.forEach((file) => {
    // Only target .png files and skip files that already have the prefix
    if (file.endsWith('.png') && !file.startsWith('exercise-')) {
      const oldPath = path.join(directoryPath, file);
      const newPath = path.join(directoryPath, `exercise-${file}`);

      try {
        fs.renameSync(oldPath, newPath);
        console.log(`✅ Renamed: ${file}  ->  exercise-${file}`);
        renamedCount++;
      } catch (renameErr) {
        console.error(`❌ Failed to rename ${file}:`, renameErr);
      }
    }
  });

  console.log(`\n🎉 All done! Successfully renamed ${renamedCount} files.`);
});
