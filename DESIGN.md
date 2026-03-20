# Design System

## Overview
A modern, high-density dark-themed interface for Musclog, a fitness and nutrition tracker. The design emphasizes focus, performance, and deep emerald/green tones to evoke a sense of health and energy. It uses a 4px grid system and a layered approach to surfaces to maintain hierarchy.

## Colors
Musclog uses a rich palette of greens and teals, complemented by semantic colors for status and macro-tracking.

### Surface & Brand
- **Primary Background** (`#0a1f1a`): Main app background (swampGreen).
- **Card Surface** (`#141a17`): Secondary surface for cards and sections (charcoalGreen).
- **Accent Primary** (`#22c55e`): High-energy green for key actions and progress (green500).
- **Accent Secondary** (`#10b981`): Balanced emerald for supporting actions (jade).
- **Accent Tertiary** (`#14b8a6`): Calm teal for hydration and variety (teal500).

### Text
- **On-Surface Primary** (`#ffffff`): Primary text on dark backgrounds.
- **On-Surface Secondary** (`#9ca3af`): Supporting text and metadata (gray400).
- **Muted** (`#6b7280`): Disabled or very low importance text (gray500).

### Status
- **Success** (`#22c55e`): Positive feedback, completion, and growth.
- **Warning** (`#f97316`): Alerts, attention required, or high intensity.
- **Error** (`#ef4444`): Destructive actions, errors, or missing data.
- **Info** (`#3b82f6`): Neutral information and tips.

### Macros
- **Protein** (`#6366f1`): Indigo/Purple.
- **Carbs** (`#10b981`): Jade/Emerald.
- **Fat** (`#f59e0b`): Amber/Gold.
- **Fiber** (`#ec4899`): Pink/Rose.

## Typography
The system relies on clear hierarchy and high readability.

- **Scale**:
  - **xxs**: 10px (Badges, small labels)
  - **xs**: 12px (Captions, secondary labels)
  - **sm**: 14px (Supporting text, button labels)
  - **base**: 16px (Body text, primary inputs)
  - **lg**: 18px (List items, subheaders)
  - **xl**: 20px (Section headers)
  - **2xl - 8xl**: 24px - 96px (Large displays, hero stats)

- **Weights**:
  - **Normal**: 400
  - **Medium**: 500
  - **Semi-Bold**: 600
  - **Bold**: 700
  - **Extra-Bold**: 800
  - **Black**: 900

## Spacing & Layout
A consistent 4px grid ensures alignment and balance.

- **Padding/Gap Scale**: 4px (xs), 8px (sm), 12px (md), 16px (base), 20px (lg), 24px (xl), 32px (2xl), 48px (3xl).
- **Border Radius**:
  - **xs**: 4px (Small controls)
  - **md**: 12px (Standard inputs)
  - **lg**: 16px (Primary cards)
  - **xl - 2xl**: 20px - 24px (Large modals, big buttons)
  - **Full**: 9999px (Pills, circular avatars)

## Components

### Buttons
- **Accent**: Solid gradient (jade to green500), primary call-to-action.
- **Outline**: 1px border, transparent background, secondary actions.
- **Secondary**: Dark overlay background, subtle tertiary actions.
- **Discard**: Red background, used for destructive or "cancel" actions.
- **Gradient CTA**: Vibrant indigo-to-mint gradient for premium or highlighted features.

### Cards
- **Base Card**: `charcoalGreen` background with a subtle `gray600Alpha50` border.
- **Elevated Card**: `gunmetalGreen` background for higher visual priority.

### Inputs
- **Standard**: Minimal background, clear labels, and `md` (12px) rounding.
- **Numerical**: Uses a specialized `useRepeatPress` hook for fast adjustments on mobile.

## Do's and Don'ts
- **Do** use semantic colors (Protein blue, Fat gold) consistently across all screens.
- **Do** maintain a minimum contrast ratio of 4.5:1 for all readable text.
- **Don't** use sharp corners; follow the established radius scale to maintain a friendly, modern feel.
- **Do** use spacing tokens (base, md, etc.) instead of hardcoded pixel values.
- **Don't** introduce new colors without mapping them to a theme token.
