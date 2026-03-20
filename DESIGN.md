# Design System

## 1. Brand Identity & Visual Language

**Musclog - Lift, Log, Repeat**
The design of Musclog is built on a "Kinetic Depth" philosophy—combining high-performance aesthetics with data-driven transparency. It is energetic, aspirational, and engineered for precision, focusing on emerald/green tones to evoke health and performance.

## 2. Colors

Musclog uses a rich palette of greens and teals, complemented by semantic colors for status and macro-tracking.

### 2.1 Primary & Surface

- **Performance Gradient**: Indigo 600 (`#4f46e5`) to Emerald 400 (`#34d399` / `#29e08e`). Used for primary actions, success states, and progress markers.
- **Primary Background** (`#0a1f1a`): Main app background (swampGreen).
- **Card Surface** (`#141a17`): Secondary surface for cards and sections (charcoalGreen).
- **Elevated Surface** (`#1a2420`): Higher priority cards (gunmetalGreen).

### 2.2 Functional & Macros

- **Success** (`#22c55e`): Positive feedback and completion.
- **Warning/Energy** (`#f97316` / `#f59e0b`): High-intensity peaks, alerts, and nutritional energy.
- **Error/Recovery** (`#ef4444` / `#da2552`): Destructive actions or rest/recovery contexts.
- **Protein** (`#6366f1`): Indigo.
- **Carbs** (`#10b981`): Jade/Emerald.
- **Fat** (`#f59e0b`): Amber.
- **Fiber** (`#ec4899`): Pink.

## 3. Typography

The system relies on clear hierarchy and high readability, with a heavy emphasis on large numeric data.

- **Typefaces**:
  - **Lexend**: Used for data and headings to provide a modern, athletic feel.
  - **Inter / Manrope**: Used for body text and labels for maximum readability.

- **Scale**:
  - **xxs**: 10px (Badges, small labels)
  - **xs**: 12px (Captions, secondary labels)
  - **sm**: 14px (Supporting text, button labels)
  - **base**: 16px (Body text, primary inputs)
  - **lg - xl**: 18px - 20px (Subheaders and Section headers)
  - **2xl - 8xl**: 24px - 96px (Hero stats: weight, reps, calories)

## 4. Spacing & Layout

A consistent 4px grid ensures alignment and balance.

- **Padding/Gap Scale**: 4px (xs), 8px (sm), 12px (md), 16px (base), 20px (lg), 24px (xl), 32px (2xl).
- **Border Radius**:
  - **Standard**: 12px (md) for inputs and general components.
  - **Large**: 16px (lg) for primary cards.
  - **Pill**: 9999px for status badges and avatars.
- **Touch Targets**: Minimum 48x48dp across all mobile interfaces.

## 5. Components

### 5.1 Buttons

- **Primary**: Full gradient fill (Performance Gradient) with high-contrast text.
- **Secondary**: Outlined or low-opacity surface fill for supporting actions.
- **Destructive**: Rose/Red themed for clear warnings.

### 5.2 Cards & Surfaces

- Uses subtle shadows and semi-transparent "glassmorphic" overlays (`backdrop-blur`) where appropriate.
- Active items feature a subtle Indigo/Emerald glow.

### 5.3 Inputs & Steppers

- **Numeric Steppers**: Integrated "-" and "+" buttons for rapid adjustment during high-intensity gym sessions.
- **Contextual Icons**: Trailing icons for specific data types (e.g., barcode for nutrition).

## 6. Data Visualization

- **Charts**: Standardized bar and line charts using the Indigo/Emerald theme.
- **Progress Rings**: Multi-segment rings for nutrition tracking, providing an "at-a-glance" status of macro goals.
- **Consistency Grid**: A GitHub-style contribution grid for long-term consistency tracking.

## 7. Design Principles

1. **Non-Gendered Performance**: A neutral, high-performance tech aesthetic (Slate/Indigo/Emerald) avoiding stereotypical fitness tropes.
2. **Hormonal Intelligence**: Adaptive training suggestions based on cycle data, shifting from high-intensity to recovery automatically.
3. **AI Transparency**: Clear disclaimers and "context-add" features for AI-powered estimations.
4. **Offline First**: Minimalist interfaces prioritizing quick logging in low-connectivity environments (gyms).

## 8. Screen Inventory Summary

- **Dashboard**: Unified view of daily calories, macros, and recent activity.
- **Workout Tracker**: Non-linear session overview with per-set precision.
- **Nutrition**: AI-assisted camera tracking, barcode scanning, and meal templates.
- **Progress**: Advanced data cross-referencing and trend analytics.
- **Onboarding**: Multi-step registration and goal setting.

## Do's and Don'ts

- **Do** use semantic colors consistently (Protein blue, Fat gold).
- **Do** maintain a minimum contrast ratio of 4.5:1 for readability.
- **Don't** use sharp corners; adhere to the 12px/16px radius scale.
- **Do** use spacing tokens instead of hardcoded pixel values.
