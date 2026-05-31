---
name: deslop
description: Remove AI-generated code slop from your codebase. Use when you want to clean up AI-introduced patterns like excessive comments, defensive checks, type casts, React anti-patterns, or other inconsistencies.
version: 1.1.0
---

# Remove AI Code Slop

Check the diff against main, and remove all AI-generated slop introduced in this branch.

## What to Remove & Fix

### 1. Surface-Level Slop

- **State-the-Obvious Comments:** Remove "polite" comments that explain _what_ the code is doing (e.g., `// Fetch user data`) rather than _why_. Code should be self-documenting.
- **Type Escapes:** Remove unnecessary `as any` casts, blind non-null assertions (`!`), or hallucinated TypeScript interfaces that over-specify unused fields.
- **Div Soup:** Remove useless wrapper `<div>` tags or non-semantic HTML used where proper semantic tags or React Fragments (`<>`) should be used.

### 2. Defensive & Error Handling Slop

- **Swallowed Errors:** Remove generic `try/catch` blocks that just `console.log(error)` and fail silently. Errors should either be properly handled, thrown to an Error Boundary, or reported to a telemetry service.
- **Band-Aid Guard Clauses:** Remove naive boolean gating (e.g., `if (!data) return null;`) that hides upstream data pipeline issues unless explicitly intended for loading states.

### 3. React & Hook Anti-Patterns

- **Derived State `useEffect`s:** Remove `useEffect` blocks used solely to update one state variable based on another. Calculate these derived values directly during the render phase.
- **Over-Optimization Spam:** Strip out useless `useCallback` and `useMemo` wrappers around simple functions or primitive values.
- **Improper `useRef`:** Remove refs that are mutated directly during the render phase or used needlessly where standard controlled state should exist.
- **Stale Closures:** Fix empty dependency arrays `[]` in `useEffect`s that reference state variables inside timers or intervals.

### 4. Memory & Performance Killers

- **Inline Reference Nukes:** Extract inline objects or functions passed directly into Context API Providers (`value={{...}}`) or React Native `FlatList` props (`renderItem={() => ...}`).
- **Missing Cleanups:** Ensure any `useEffect` containing API fetches or event listeners includes proper cleanup functions (e.g., `AbortController`, `removeEventListener`) to prevent memory leaks on unmount.

## Process

1. Check the diff against the main branch.
2. Review each changed file for the specific AI-generated patterns listed above.
3. Refactor or remove the slop while strictly preserving the intended business logic and legitimate human changes.
4. Ensure the final code style matches the existing file conventions perfectly.

## Reporting

Report at the end with only a **1-3 sentence summary** of what you changed.

## When to Use

- After AI pair programming sessions
- Before creating a pull request
- When code review feedback mentions "AI slop" or performance issues
- As part of your pre-commit workflow
