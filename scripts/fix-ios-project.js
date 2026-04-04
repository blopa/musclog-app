#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * Script to apply PBXTargetDependency fix to project.pbxproj
 * Run this after `expo prebuild` to restore the iOS simulator build fix
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
  console.error('❌ project.pbxproj not found. Run expo prebuild first.');
  process.exit(1);
}

let content = fs.readFileSync(projectPath, 'utf-8');

// Check if already patched
if (content.includes('AF0E8295EA1C4ED79216E101')) {
  console.log('✅ project.pbxproj already has PBXTargetDependency fix');
  process.exit(0);
}

console.log('🔧 Applying PBXTargetDependency fix to project.pbxproj...');

// 1. Add PBXFileReference for Pods.xcodeproj
if (!content.includes('E8E11EA3CEC44DF7A02CE491')) {
  const fileRef =
    '\t\tE8E11EA3CEC44DF7A02CE491 /* Pods.xcodeproj */ = {isa = PBXFileReference; lastKnownFileType = "wrapper.pb-project"; name = Pods.xcodeproj; path = Pods/Pods.xcodeproj; sourceTree = "<group>"; };\n';
  content = content.replace(
    '/* End PBXFileReference section */',
    fileRef + '/* End PBXFileReference section */'
  );
}

// 1b. Add the file reference to the main group (so it's part of the project structure)
// Find the main group (the one with children that contains the Products group)
if (!content.includes('E8E11EA3CEC44DF7A02CE491') || !content.match(/children = \([\s\S]*?E8E11EA3CEC44DF7A02CE491/)) {
  // Find a good spot in the main group's children array
  // Look for the "Products" entry in children and add before it
  content = content.replace(
    /(children = \([\s\S]*?)(\t\t\t\t83CBBA001A601CBA00E9B192 \/\* Products \*\/;)/,
    '$1\t\t\t\tE8E11EA3CEC44DF7A02CE491 /* Pods.xcodeproj */,\n$2'
  );
}

// 2. Add PBXContainerItemProxy section
if (!content.includes('51214D45C20A4F599D6C7371')) {
  const containerProxy = `/* Begin PBXContainerItemProxy section */\n\	\t51214D45C20A4F599D6C7371 /* PBXContainerItemProxy */ = {\n\	\t\tisa = PBXContainerItemProxy;\n\	\t\tcontainerPortal = E8E11EA3CEC44DF7A02CE491 /* Pods.xcodeproj */;\n\	\t\tproxyType = 1;\n\	\t\tremoteGlobalIDString = 4B963AE7B5F67531C95022CA7ABE42D0;\n\	\t\tremoteInfo = "Pods-MusclogLiftLogRepeat";\n\	\t};\n/* End PBXContainerItemProxy section */\n\n`;
  content = content.replace(
    '/* Begin PBXFrameworksBuildPhase section */',
    containerProxy + '/* Begin PBXFrameworksBuildPhase section */'
  );
}

// 3. Add PBXTargetDependency section
if (!content.includes('AF0E8295EA1C4ED79216E101')) {
  const targetDep = `/* Begin PBXTargetDependency section */\n\	\tAF0E8295EA1C4ED79216E101 /* PBXTargetDependency */ = {\n\	\t\tisa = PBXTargetDependency;\n\	\t\tname = "Pods-MusclogLiftLogRepeat";\n\	\t\ttargetProxy = 51214D45C20A4F599D6C7371 /* PBXContainerItemProxy */;\n\	\t};\n/* End PBXTargetDependency section */\n\n`;
  content = content.replace(
    '/* Begin PBXProject section */',
    targetDep + '/* Begin PBXProject section */'
  );
}

// 4. Update the main target's dependencies array
const depsPattern =
  /(13B07F861A680F5B00A75B9A \/\* MusclogLiftLogRepeat \*\/ = \{[\s\S]*?dependencies = )\(\s*\)/;
if (depsPattern.test(content)) {
  content = content.replace(
    depsPattern,
    '$1(\n\t\t\t\tAF0E8295EA1C4ED79216E101 /* PBXTargetDependency */,\n\t\t\t)'
  );
}

// 5. Update objectVersion and LastUpgradeCheck for Xcode 26 compatibility
content = content.replace(/objectVersion = \d+;/, 'objectVersion = 63;');
content = content.replace(/LastUpgradeCheck = \d+;/, 'LastUpgradeCheck = 1600;');

// 6. Add SUPPORTED_PLATFORMS if not present
if (!content.includes('SUPPORTED_PLATFORMS')) {
  // Add after LD_RUNPATH_SEARCH_PATHS in build settings
  // Handle multiline format
  content = content.replace(
    /(LD_RUNPATH_SEARCH_PATHS = \(\s*"[^"]+",\s*"@executable_path\/Frameworks",\s*\);)([\s\S]*?)(MARKETING_VERSION)/g,
    '$1\n\t\t\t\tSUPPORTED_PLATFORMS = "iphonesimulator iphoneos";$2$3'
  );
}

fs.writeFileSync(projectPath, content);

// Verify
const verifyContent = fs.readFileSync(projectPath, 'utf-8');
if (verifyContent.includes('AF0E8295EA1C4ED79216E101')) {
  console.log('✅ project.pbxproj updated with PBXTargetDependency fix');
} else {
  console.error('❌ Failed to apply fix');
  process.exit(1);
}
