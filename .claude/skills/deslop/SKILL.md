---
name: deslop
description: Remove AI-generated code slop from your codebase. Use when you want to clean up AI-introduced patterns like excessive comments, defensive checks, type casts, or other inconsistencies.
version: 1.0.0
---

# Remove AI Code Slop

Check the diff against main, and remove all AI-generated slop introduced in this branch.

## What to Remove

This includes:
- **Extra comments** that a human wouldn't add or is inconsistent with the rest of the file
- **Extra defensive checks or try/catch blocks** that are abnormal for that area of the codebase (especially if called by trusted / validated codepaths)
- **Casts to `any`** to get around type issues
- **Any other style** that is inconsistent with the file

## Process

1. Check the diff against main branch
2. Review each changed file for AI-generated patterns
3. Remove slop while preserving legitimate changes
4. Ensure code style matches the existing file conventions

## Reporting

Report at the end with only a **1-3 sentence summary** of what you changed.

## When to Use

- After AI pair programming sessions
- Before creating a pull request
- When code review feedback mentions "AI slop"
- As part of your pre-commit workflow

---

Credit: [Eric Zakariasson](https://x.com/ericzakariasson)
