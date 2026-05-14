#!/usr/bin/env node
/* eslint-disable no-undef */

const fs = require('fs');
const path = require('path');

// Path to data directory relative to scripts folder
const dataDir = path.join(__dirname, '..', 'data');

// Get all exercises*.json files
const exerciseFiles = fs
  .readdirSync(dataDir)
  .filter((file) => file.startsWith('exercises') && file.endsWith('.json'))
  .sort();

console.log(`Found ${exerciseFiles.length} exercise files:`);
exerciseFiles.forEach((file) => console.log(`  - ${file}`));
console.log('');

// Load all exercise data
const exerciseData = {};
let totalExercises = null;
let hasErrors = false;

for (const file of exerciseFiles) {
  const filePath = path.join(dataDir, file);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    exerciseData[file] = data;

    if (totalExercises === null) {
      totalExercises = data.length;
      console.log(`Reference file ${file} has ${totalExercises} exercises`);
    } else if (data.length !== totalExercises) {
      console.error(`❌ ERROR: ${file} has ${data.length} exercises, expected ${totalExercises}`);
      hasErrors = true;
    } else {
      console.log(`✅ ${file} has correct count: ${data.length} exercises`);
    }
  } catch (error) {
    console.error(`❌ ERROR reading ${file}: ${error.message}`);
    hasErrors = true;
  }
}

console.log('');

if (hasErrors) {
  console.log('❌ Validation failed due to count errors');
  process.exit(1);
}

// Compare fields by index
const fieldsToCheck = ['muscleGroup', 'type', 'targetMuscles', 'loadMultiplier'];
const referenceFile = exerciseFiles[0];
const referenceData = exerciseData[referenceFile];

console.log(`Comparing fields using ${referenceFile} as reference:`);

for (let i = 0; i < totalExercises; i++) {
  const referenceExercise = referenceData[i];
  let exerciseHasErrors = false;

  for (const file of exerciseFiles.slice(1)) {
    const currentExercise = exerciseData[file][i];

    for (const field of fieldsToCheck) {
      const refValue = referenceExercise[field];
      const currentValue = currentExercise[field];

      // Deep comparison for arrays
      const isEqual =
        Array.isArray(refValue) && Array.isArray(currentValue)
          ? JSON.stringify(refValue.sort()) === JSON.stringify(currentValue.sort())
          : refValue === currentValue;

      if (!isEqual) {
        console.error(`❌ Exercise ${i + 1} (${referenceExercise.name}) - ${field}:`);
        console.error(`   ${referenceFile}: ${JSON.stringify(refValue)}`);
        console.error(`   ${file}: ${JSON.stringify(currentValue)}`);
        exerciseHasErrors = true;
        hasErrors = true;
      }
    }
  }
}

console.log('');

if (hasErrors) {
  console.log('❌ Validation failed - field mismatches found');
  process.exit(1);
} else {
  console.log('✅ All validations passed!');
  console.log(`- All ${exerciseFiles.length} files have ${totalExercises} exercises`);
  console.log(`- All fields match by index: ${fieldsToCheck.join(', ')}`);
}
