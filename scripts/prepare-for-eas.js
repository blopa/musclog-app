#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * Strips local Xcode 26 patches from project.pbxproj before running EAS cloud builds.
 *
 * WHY THIS EXISTS:
 * fix-ios-project.js adds a PBXTargetDependency (cross-project dep on Pods.xcodeproj)
 * to fix Xcode 26's broken implicit dependency detection for local simulator builds.
 * That entry has no "target" field (cross-project deps only have "targetProxy"), but
 * the EAS CLI parser expects a "target" field on every dependency and throws:
 *   "Could not find target with id 'undefined' in project.pbxproj"
 *
 * EAS cloud runs on Xcode 15/16 which doesn't have the Xcode 26 regression, so the
 * PBXTargetDependency isn't needed there anyway.
 *
 * Run this automatically via the build-ios* scripts in package.json.
 */

const fs = require('fs');
const path = require('path');

const projectPath = path.join(
  __dirname,
  '..',
  'ios',
  'MusclogLiftLogRepeat.xcodeproj',
  'project.pbxproj'
);

if (!fs.existsSync(projectPath)) {
  console.log('[prepare-for-eas] project.pbxproj not found, nothing to strip');
  process.exit(0);
}

let content = fs.readFileSync(projectPath, 'utf-8');
let changed = false;

// 1. Remove PBXTargetDependency from the main target's dependencies array
//    Changes: dependencies = ( AF0E8295EA1C4ED79216E101 /* PBXTargetDependency */, )
//    Back to: dependencies = ( )
if (content.includes('AF0E8295EA1C4ED79216E101 /* PBXTargetDependency */')) {
  content = content.replace(
    /\n\t\t\t\tAF0E8295EA1C4ED79216E101 \/\* PBXTargetDependency \*\/,\n\t\t\t\)/,
    '\n\t\t\t)'
  );
  changed = true;
  console.log('[prepare-for-eas] ✅ Removed PBXTargetDependency from main target dependencies');
}

// 2. Remove PBXTargetDependency section
if (content.includes('/* Begin PBXTargetDependency section */')) {
  content = content.replace(
    /\/\* Begin PBXTargetDependency section \*\/\n[\s\S]*?\/\* End PBXTargetDependency section \*\/\n\n/,
    ''
  );
  changed = true;
  console.log('[prepare-for-eas] ✅ Removed PBXTargetDependency section');
}

// 3. Remove PBXContainerItemProxy section
if (content.includes('/* Begin PBXContainerItemProxy section */')) {
  content = content.replace(
    /\/\* Begin PBXContainerItemProxy section \*\/\n[\s\S]*?\/\* End PBXContainerItemProxy section \*\/\n\n/,
    ''
  );
  changed = true;
  console.log('[prepare-for-eas] ✅ Removed PBXContainerItemProxy section');
}

// 4. Remove Pods.xcodeproj file reference
if (content.includes('E8E11EA3CEC44DF7A02CE491 /* Pods.xcodeproj */')) {
  content = content.replace(
    /\t\tE8E11EA3CEC44DF7A02CE491 \/\* Pods\.xcodeproj \*\/ = \{[^}]+\};\n/,
    ''
  );
  // Also remove from group children if present
  content = content.replace(/\t\t\t\tE8E11EA3CEC44DF7A02CE491 \/\* Pods\.xcodeproj \*\/,\n/, '');
  changed = true;
  console.log('[prepare-for-eas] ✅ Removed Pods.xcodeproj file reference');
}

if (changed) {
  fs.writeFileSync(projectPath, content);
  console.log('[prepare-for-eas] ✅ project.pbxproj ready for EAS build');
} else {
  console.log('[prepare-for-eas] ℹ️  No Xcode 26 patches found, project.pbxproj already clean');
}
