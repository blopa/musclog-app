#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * report-modal-issues.js
 *
 * Runs ESLint across the component and app directories and reports only
 * `local/no-sibling-modals` violations — the iOS UIViewController hierarchy bug
 * where sibling modal components cause the second modal to be silently dropped.
 *
 * Usage:
 *   npm run report-modal-issue
 */

const { spawnSync } = require('child_process');
const path = require('path');

const RULE_ID = 'local/no-sibling-modals';
const ROOT = path.resolve(__dirname, '..');

const { stdout, stderr, error } = spawnSync(
    'npx',
    ['eslint', '--format', 'json', 'components', 'app'],
    {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024, // 32 MB — large codebases produce big JSON
    }
);

if (error) {
    process.stderr.write(`Failed to run ESLint: ${error.message}\n`);
    if (stderr) {process.stderr.write(stderr);}
    process.exit(1);
}

let results;
try {
    results = JSON.parse(stdout);
} catch {
    process.stderr.write('Failed to parse ESLint JSON output.\n');
    if (stderr) {process.stderr.write(stderr);}
    process.exit(1);
}

let totalViolations = 0;
let affectedFiles = 0;

for (const result of results) {
    const hits = result.messages.filter((m) => m.ruleId === RULE_ID);
    if (hits.length === 0) {continue;}

    affectedFiles++;
    const relativePath = result.filePath.replace(ROOT + path.sep, '');
    process.stdout.write(`\n${relativePath}\n`);

    for (const msg of hits) {
        // Trim the long message down to just the modal name for readability.
        // Full: "<Foo> is a sibling of another modal component. On iOS…"
        const shortMsg = msg.message.split(' On iOS')[0];
        process.stdout.write(`  ${msg.line}:${msg.column}  ${shortMsg}\n`);
        totalViolations++;
    }
}

if (totalViolations === 0) {
    process.stdout.write('\nNo sibling modal violations found.\n');
} else {
    process.stdout.write(
        `\n${totalViolations} violation(s) across ${affectedFiles} file(s).\n` +
            'See docs/modals-problem-on-ios.md for the fix pattern.\n'
    );
}
