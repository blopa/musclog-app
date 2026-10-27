# Mobile Design

Mobile Design is an agent skill for designing, implementing, and reviewing professional mobile UI for React Native, Expo, iOS, and Android apps.

**Interactive showcase:** [rubenglez.github.io/mobile-design-showcase](https://rubenglez.github.io/mobile-design-showcase/)

It gives coding agents a mobile-product design process with platform-aware guidance for navigation, forms, typography, color, accessibility, touch targets, gestures, haptics, motion, safe areas, and React Native implementation details.

The separate showcase repository contains four interactive fictional product cases, including offline location tracking, RTL checkout, fintech confirmation, and a design-audit before/after. It is intentionally kept outside this installed skill so visual assets and demo code do not add installation weight.

## Install

Install with the skills CLI:

```bash
npx skills add RubenGlez/mobile-design
```

Then ask your agent for mobile UI work, for example:

```text
Use the mobile-design skill to redesign this checkout screen for iOS and Android.
```

## What It Covers

- React Native and Expo mobile UI implementation
- iOS and Android platform conventions
- Navigation, screen structure, forms, search, filters, and state design
- Typography, color, dark mode, visual hierarchy, and design tokens
- Touch targets, accessibility, Dynamic Type, screen readers, and motor access
- Gesture handling, haptics, motion, loading states, and Reduce Motion support
- Mobile design reviews with platform, accessibility, and polish checklists

## Skill Structure

```text
SKILL.md
evals/
  cases.md
references/
  accessibility-touch.md
  adaptivity-localization.md
  design-process.md
  feasibility-risk.md
  forms.md
  motion-haptics.md
  navigation.md
  platform-android.md
  platform-ios.md
  react-native-implementation.md
  review-checklists.md
  review-rules.md
  screen-patterns.md
  source-map.md
  typography-color.md
  visual-system.md
```

`SKILL.md` contains the trigger metadata and operating loop. The `references/` files are loaded selectively by the agent based on the mobile task.

`evals/cases.md` is a maintainer-facing suite for forward-testing skill revisions before release.

`SKILL.md` lives at the repo root, so `npx skills add` copies the whole repository (this README, `LICENSE`, `AGENTS.md`, `CLAUDE.md`, and `references/`) into the consumer's skill folder, not just the skill bundle. This is intentional; only add new files to the repo root if you are comfortable shipping them to every installer.

## Best Use Cases

- Redesigning mobile screens or flows
- Building React Native or Expo components with production-level states
- Reviewing app UI for usability, accessibility, and platform fit
- Translating a rough product idea into a mobile-native interaction model
- Checking iOS HIG, Material Design, and current mobile library guidance before implementation advice
