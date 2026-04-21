# Apple Intelligence Optimization Technical Specification

## Overview

This document outlines the technical improvements implemented to optimize Apple Intelligence (on-device AI) performance in the Musclog app. These changes address issues with context overload, prompt bloat, and memory limitations of local models.

## Architecture

### 1. Provider-Aware Configuration System

AI providers are governed by a `PROVIDER_CONFIGS` registry in `utils/coachAI.ts`. This centralizes limits and feature availability:

- **`maxCharBudget`**: Total character limit for conversation history. On-device is capped at ~2000 chars (~500 tokens).
- **`promptComplexity`**: Minimal (on-device) vs Standard (cloud).
- **`enableFoundationFoods`**: Disabled for on-device AI to prevent massive schema/prompt injection.
- **`enableMemories`**: Disabled for on-device AI to save context window.

### 2. Context Window Management (Budget-Based)

Instead of message count truncation, we use `truncateHistoryByBudget` in `utils/coachAI.ts`. This function traverses history backwards and sums character lengths until the budget is reached, ensuring the model always receives the most recent and relevant messages without exceeding its limits.

### 3. Tiered Prompt & Compressed Context Injection

#### Minimal System Prompt
On-device models use a highly compressed prompt defined in `utils/prompts.ts`. This prompt bypasses the heavy "Loggy PhD" persona in favor of a concise coach persona.

#### Compressed User Stats
Instead of detailed paragraphs, user stats are injected as a compressed tag:
`[User: Male, 85kg, 15%BF, hypertrophy]`

#### Minimal Workout Summaries
Recent workouts are injected as one-line summaries instead of large JSON blocks:
`User finished "Push Day" on 2024-05-20: 5400 kg volume, 6 exercises, 18 sets.`

### 4. Feature Degradation

- **Foundation Foods**: When Apple Intelligence is active, the foundation foods database matching is disabled. This reduces the system prompt size by several thousand characters and simplifies the JSON schema.
- **Memories**: Historical conversation memories are not injected into on-device requests to preserve the context window for the current conversation.

## Implementation Details

- **Location**: Core AI logic resides in `utils/coachAI.ts` and prompt construction in `utils/prompts.ts`.
- **UI Integration**: In `AISettingsModal.tsx`, enabling Apple Intelligence automatically disables and locks the "Send Foundation Foods" toggle to prevent memory-related crashes on-device.
- **Reliability**: Per user directive, the implementation does **not** fall back to cloud providers if on-device fails, treating the local model as a specialized, air-gapped tool.

## Conclusion

By shifting to character budgets and compressed payloads, Musclog provides a fast, private, and reliable AI experience on-device while maintaining the full power of cloud models when configured.
