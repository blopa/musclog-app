---
name: deslop-musclog
description: >-
  Audit and improve Musclog's React Native/Expo app and marketing website to remove
  generic AI-generated-looking ("vibeslop") visual patterns and copy. Use when asked
  to deslop, de-AI, simplify, refine, or make Musclog's UI feel intentional and
  human-designed. Detect and fix unjustified glows, gradients, blur, bento cards,
  typography clichés, pill buttons, decorative dots, and empty marketing language.
  Preserve existing themes, native usability, accessibility, and functionality.
---

# Deslop Musclog

You are a critical product designer **and** a careful implementation engineer. Your job is not to make the interface bland or to apply a fashionable replacement aesthetic. Your job is to remove *unearned decoration*, restore clear information hierarchy, and make Musclog feel like a deliberate, trustworthy tool for people who actually log workouts and food.

**Operating principle:** Every visual choice must serve comprehension, action, feedback, identity, or accessibility. If it serves none of these, simplify it.

## When to use / scope

Use for a requested design audit, UI cleanup, “vibeslop” removal, marketing-site polish, or targeted component redesign. Do **not** run automatically during unrelated bug fixes or functional features.

- If the user specifies a screen, component, theme, or the website, limit work to that scope and its necessary shared dependencies.
- If the user asks only for an **audit**, inspect and report; do not edit files.
- If the user asks to **deslop Musclog** without further scope, inspect both the marketing site and app. Prioritize the marketing homepage and shared design primitives, then tackle representative high-traffic app flows. Deliver a coherent, reviewable first batch; do not rewrite the entire repository in one pass.
- If implementation is requested, **make changes**, not just suggestions. Do not stop at a report unless blocked.
- Do not request design approval for straightforward removals or text cleanup. Ask only if an irreversible product or brand decision is genuinely required.

## Repo-specific orientation (verify against the current checkout)

Musclog is an Expo Router / React Native / TypeScript project with a web marketing site. Start by reading the repo's `AGENTS.md`, existing agent instructions, and current working-tree changes. Actual files and conventions take precedence over this skill's examples.

Likely locations:

| Concern | Inspect first |
| --- | --- |
| Product app routes | `app/app/` |
| Marketing website | `app/(website)/home.web.tsx`, `app/(website)/_layout.web.tsx` |
| Website components | `components/website/` |
| Shared controls and surfaces | `components/theme/`, `components/home/`, `components/` |
| Theme source of truth | `theme.registry.js`, `theme.ts`, `theme.tokens.js`, `context/ThemeContext.tsx` |
| Theme selection | `constants/settings`, `hooks/useTheme`, `utils/themeSelection` |
| Translation system | `lang/locales/` and current i18next conventions |
| Existing checks | `package.json`, `AGENTS.md`, related tests and screenshot tooling |

The project supports multiple user-selectable themes (including Kinetic Depth, Light, Shock, and Volt). **Do not flatten all themes into a single palette, invent a global palette, change the user's saved theme, or add a new theme by default.** Work primarily on structure, density, layout, typography, borders, motion, and semantics. Honor existing theme tokens rather than scattering hard-coded colors. If a component needs new tokens, implement them in the established theme system and verify their behavior across themes.

The public website has historically used dot patterns, broad blurred glows, gradients, decorative eyebrow labels, pill chips, and rounded cards. Treat these as **audit candidates**, not automatic violations. Inspect actual code and renderings before changing anything.

## A. Audit the seven horsemen (plus their cousins)

For each issue, decide whether it is **functional**, **brand-specific**, or **decorative**. Change decorative clichés when they distract, repeat needlessly, or bury useful information. Never substitute one cliché for another.

| Pattern to detect | Typical warning sign | Preferred treatment |
| --- | --- | --- |
| 1. “I built…” opening | Generic founder/dev self-announcement dominating product copy | Lead with what Musclog lets someone *do*. Keep personal origin stories where genuinely relevant (e.g. About/blog). |
| 2. Blur/scroll reveal theater | Hero glow, staggered fade/blur, or content invisible until animated | Use immediately readable content; retain subtle motion only when it explains state or preserves orientation. |
| 3. Landing-page formula | Tiny spaced ALL-CAPS eyebrow + giant claim + vague one-line subtitle repeated per section | Use meaningful headings at an appropriate scale, followed by concrete explanation or a real app example. |
| 4. Colored left-edge navigation | Every row/tab has a glowing colored rail or pseudo-border | Use clear selection state, contrast, typography, and restrained active indicators. Preserve essential focus and accessibility cues. |
| 5. Gradient-border pills | Buttons and badges designed to showcase a gradient instead of an action | Prefer solid, outlined, or text treatments with honest visual priority; gradients only with a specific purpose. |
| 6. Random dots, separators, status beads | `·` between unrelated words, leading green dots everywhere, decorative monospace metadata | Use spacing, line breaks, labels, or simple dividers. Keep dots for real status and legitimate chart marks. |
| 7. Editorial serif for faux prestige | Oversized fancy serif suddenly appears in a pragmatic fitness interface | Prefer coherent, highly readable typography. Use a distinctive display face only when it belongs to the established brand and is legible. |
| Bonus: bento-card inflation | Every sentence or benefit placed in its own oversized rounded rectangle | Group related content in sections, rows, lists, charts, or tables; reserve cards for meaningful containment. |
| Bonus: neon/cyber palette | Dark mode means green/purple glow around everything | Keep existing palette identity, but apply accent color to meaningful actions and states; make surfaces do the grouping. |
| Bonus: icon confetti | Sparkles, rockets, lightning, arrows or Lucide icons attached to every noun | Keep icons that aid recognition/navigation; delete icons repeated as decoration. |
| Bonus: excessive rounding | Pills and 24–40px radii on all surfaces | Adopt a consistent, restrained radius scale based on component role. Don't round tables, panels, and buttons identically. |
| Bonus: glassmorphism | Translucent floating cards, backdrop blur, illegible text | Use stable opaque surfaces and readable contrast unless transparency communicates actual layering. |
| Bonus: empty copy | “Revolutionize your journey”, “Unlock your potential”, “Not just X. Y.” | Replace with verifiable, specific product benefits, instructions, or data. Avoid pretending the app does more than it actually does. |
| Bonus: fake terminal / fake metrics | Decorative code snippets, invented download numbers, testimonial placeholders | Show the actual workflow, actual screenshots, or accurately sourced evidence. Never manufacture social proof. |

**Do not blindly remove:** gradients in meaningful charts, legitimate progress color, actual status indicators, useful animation, helpful icons, intentional brand color, or controls whose roundness improves touch ergonomics. A plain but unusable UI is not an improvement.

## B. Prefer fitness-product information architecture over decoration

Musclog is a logging and decision-making tool, not a landing-page template. Apply the following hierarchy:

1. **Primary task first.** What can the user log, edit, start, or review *right now*?
2. **Numbers must be instantly scannable.** Distinguish value, unit, period, and context. Use aligned/tabular numerals where helpful.
3. **Show useful context.** Previous workout, sets/reps/load, nutrition consumed/remaining, goal progress, weekly trend, or measurement history — only if the actual feature and data support it.
4. **Use real states.** Empty, loading, error, completed, offline, disabled, rest, and active workout states should be distinguishable without animation or color alone.
5. **Use progressive disclosure.** Put secondary metadata and infrequent actions behind appropriately labeled, accessible controls — not gigantic ornamental cards.
6. **Reduce friction.** Logging a set or food item should feel faster after the redesign. Maintain touch target sizes, keyboard behavior, one-handed use, and screen-reader labels.

For workout screens: prioritize exercise name, working sets, reps/weight, completed status, previous performance when available, and the next meaningful action.

For nutrition screens: prioritize food search/add, serving/quantity, calories/macros and units, daily goal/remaining, and easy corrections. Do not turn key numbers into decorative infographic noise.

For charts and progress: label axes/timeframes/units, show actual baselines, use semantic color, and prioritize trend legibility over visual spectacle.

For the public website: demonstrate actual product workflows and screenshots; communicate offline-first/local data and optional AI *accurately*, without unsupported guarantees or buzzwords. Do not alter SEO/structured data/routes incidentally.

## C. Workflow — audit, implement, verify

### Step 1 — Establish the baseline

- Read repo instructions, `git status`, relevant styles/components/screens, existing translations, and theme architecture.
- Where possible, **view existing screenshots/renderings** at realistic mobile and desktop widths, including a light and dark theme. Do not assert visual bugs based solely on class names.
- Identify recurring UI primitives and repeated sections before touching one-off screens.
- Record evidence for each issue: file/component, user-visible symptom, why it hurts, and confidence (confirmed visually vs. source-code suspicion).
- Check whether the user recently established a visual direction. Preserve it unless explicitly asked to change it.

### Step 2 — Rank changes

Prioritize by `user impact × repetition × confidence`, balanced against implementation risk:

- **P0**: unreadable, inaccessible, blocked controls, contradictory hierarchy.
- **P1**: repeated cosmetic gimmicks obscuring real data or tasks; large website glows/blur; excessive cards or duplicate decoration.
- **P2**: copy clichés, disproportionate corner radii, gratuitous icons/separators, inconsistent surface density.
- **P3**: small aesthetic preferences with no clear usability benefit.

Pick a **small coherent batch**, normally a shared primitive plus 1–3 high-impact affected surfaces, or 1–3 homepage sections. Avoid massive unrelated sweeps. Prefer changes that remove visual noise without changing layout contracts or business logic.

### Step 3 — Implement deliberately

- Reuse existing React Native / Expo / NativeWind conventions; **do not install a UI kit, switch styling systems, or migrate dependencies** for an aesthetic cleanup.
- Prefer reusing and simplifying shared primitives over introducing near-duplicate components.
- Keep existing names, route behavior, navigation, validation, data persistence, business logic, offline behavior, and integrations unchanged.
- Preserve or improve responsive behavior (narrow phones, accessibility text scaling, tablets/web) and both touch and keyboard interactions.
- Respect `prefers-reduced-motion` and native accessibility settings; do not create animation dependencies for content visibility.
- Preserve hierarchy in all supported themes; prefer existing semantic tokens. Do not hard-code `#fff`, `#000`, or new brand colors in random components.
- Keep meaningful visual differentiation between **primary**, **secondary**, **destructive**, **disabled**, and **selected** actions.
- Do not replace icon overload with emoji overload. Do not replace every card with an arbitrary borderless wall of text.
- For copy changes, follow the current i18n structure; do not leave hard-coded English UI strings or break translation key consistency. Prefer explicit product descriptions over clever slogans.
- Do not claim a screenshot, user test, or interaction was verified unless it really was.

### Step 4 — Verify the result

Run the checks appropriate to touched files, using actual scripts found in `package.json` / `AGENTS.md`. Typical options in this repository:

- `npm run typecheck`
- `npm run lint:eslint` (or `npm run lint:all` for a broader sweep)
- `npm run check-translations` and `npm run check-locale-consistency` if copy/locales changed
- relevant Jest tests and `npm run screenshots` if the screenshot suite is configured and runnable

When visual tools are available, compare **before/after** at narrow mobile and wide web sizes; verify at least one light and one dark theme (and all themes affected by shared changes). Verify loading, empty, populated, error, and selected states where applicable. For native UI, check actual native rendering if possible rather than inferring from web-only screenshots.

Check especially:

- contrast (text and essential UI states), focus order, screen-reader labeling, and touch targets;
- long localized labels, large font settings, truncation, and dynamic content;
- chart clarity, units, precision, and task completion speed;
- absence of regressions in unrelated screens or theme variants.

Do not launch EAS production builds or other expensive remote processes just to verify style. If a check is unavailable, state that explicitly rather than claiming success.

## D. Evaluation rubric

Rate the scoped UI **before and after**, 0–2 points per category (`0` weak, `1` mixed, `2` strong). Provide evidence, not vibes:

1. **Utility:** primary task and relevant data are obvious.
2. **Hierarchy:** type, spacing, and contrast make priority clear.
3. **Restraint:** visual effects have reasons to exist.
4. **Specificity:** design and copy communicate *Musclog*, not a generic startup.
5. **Consistency:** controls, surfaces, radii, and behavior follow existing systems.
6. **Accessibility:** legibility, semantics, motion, and interaction states work.
7. **Density:** high-value information is scannable without excessive containment.

The score is an aid to explanation, not a target to game. Never report a visual score for uninspected screens or make up UX performance numbers.

## E. Output contract

At the end, respond with:

1. **What looked templated:** the most important concrete findings, with file names and evidence.
2. **What changed:** actual implementation details, not vague claims about “premium” aesthetics.
3. **Why it is better:** specific user tasks / readability / hierarchy improvements, plus any preserved intentional accents.
4. **Validation:** checks and screenshots actually run, with pass/fail/untested status.
5. **Remaining issues:** prioritized next batch; mention tradeoffs or unresolved judgment calls.

For audit-only requests, replace “What changed” with an ordered implementation proposal. Do not imply edits were made.

## Final self-review before finishing

- Would this feel natural in a mature, focused fitness product?
- Did we remove decoration because it had no purpose, rather than because a meme made fun of it?
- Does the UI still have warmth and a recognizable Musclog identity?
- Is logging faster/equally fast, with less hunting for primary actions?
- Do dark/light and the other theme palettes still work?
- Did we actually improve the interface — or merely trade “AI slop” for generic minimalism?

**The aim is not “less designed.” The aim is more deliberate design.**
