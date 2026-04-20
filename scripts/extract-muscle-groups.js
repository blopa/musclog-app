#!/usr/bin/env node
/* eslint-disable no-undef */

const fs = require('fs');
const path = require('path');

// Load the exercises data
const exercisesPath = path.join(__dirname, '../data/exercisesEnUS.json');
const exercises = JSON.parse(fs.readFileSync(exercisesPath, 'utf8'));

// Sets to store unique muscle groups
const primaryMuscleGroups = new Set();
const targetMuscles = new Set();

// Extract muscle groups from each exercise
exercises.forEach((exercise) => {
  // Add primary muscle group if it exists
  if (exercise.muscleGroup) {
    primaryMuscleGroups.add(exercise.muscleGroup);
  }

  // Add target muscles if they exist
  if (exercise.targetMuscles && Array.isArray(exercise.targetMuscles)) {
    exercise.targetMuscles.forEach((muscle) => {
      targetMuscles.add(muscle);
    });
  }
});

// Convert to arrays and sort alphabetically
const sortedPrimaryGroups = Array.from(primaryMuscleGroups).sort();
const sortedTargetMuscles = Array.from(targetMuscles).sort();

// Display results
console.log('Primary Muscle Groups (muscleGroup):');
console.log('=====================================');
sortedPrimaryGroups.forEach((muscle, index) => {
  console.log(`${index + 1}. ${muscle}`);
});

console.log(`\nTotal primary muscle groups: ${sortedPrimaryGroups.length}`);

console.log('\nTarget Muscles:');
console.log('================');
sortedTargetMuscles.forEach((muscle, index) => {
  console.log(`${index + 1}. ${muscle}`);
});

console.log(`\nTotal target muscles: ${sortedTargetMuscles.length}`);

// Show overlap
const overlap = sortedPrimaryGroups.filter((muscle) => sortedTargetMuscles.includes(muscle));
console.log(`\nMuscles that appear in both categories: ${overlap.length}`);
if (overlap.length > 0) {
  overlap.forEach((muscle) => console.log(`  - ${muscle}`));
}
