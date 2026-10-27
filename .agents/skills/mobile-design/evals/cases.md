# Mobile Design Evaluation Cases

Use these cases to forward-test a revision before release. Give the agent only the prompt and any named artifact. Assess the result against the listed signals.

| Case | Prompt | Passing signals |
| --- | --- | --- |
| 01 | Redesign a banking transfer confirmation for iOS and Android. | Explicit amount and recipient, protected irreversible action, restrained motion, platform divergence. |
| 02 | Build a React Native signup form with email, phone, and password. | Autofill, phone-pad advance alternative, keyboard path, preserved validation, loading state. |
| 03 | Review a feed screen containing tiny icon actions and swipe-only delete. | Finds target-size and visible-alternative issues with severity and location. |
| 04 | Design a fitness dashboard for outdoor use. | High contrast, glanceable metrics, reachable actions, no decorative dashboard grid. |
| 05 | Adapt a message list from phone to tablet and foldable. | Window-first layout, list-detail decision, hinge handling, state preservation. |
| 06 | Implement an animated favorite button in React Native. | Press feedback, reduced-motion path, no unnecessary gesture library, accessible toggle state. |
| 07 | Localize a commerce checkout to Arabic and German. | RTL, string expansion, locale-aware money and date formatting, directional icon treatment. |
| 08 | Audit an image-heavy React Native catalog with a slow long list. | Virtualization, measured performance advice, image dimensions/caching, no speculative rewrites. |
| 09 | Design permission onboarding for location and notifications. | Value before request, skip path, denied state, app remains usable. |
| 10 | Implement a reusable destructive-action button. | Semantic variants, disabled/loading/error states, confirmation or undo, accessible naming. |
| 11 | Review a modal checkout flow that loses draft data on dismissal. | Identifies data loss, back/dismiss behavior, focus and recovery requirements. |
| 12 | Redesign a dense support tool for keyboard and pointer users. | Focus order, shortcuts or native keyboard behavior, compact density, non-touch input path. |
| 13 | Design background location tracking with an offline route log for a cycling safety feature. | Runs feasibility preflight, states consent and battery risks, preserves a usable fallback, and names realistic verification. |
| 14 | Redesign a failed payment confirmation for a medical booking app. | Protects trust, preserves the booking, gives recovery and escalation paths, avoids false success or manipulative urgency. |
| 15 | Add the settings screen in SwiftUI after reviewing an Expo prototype. | Separates platform design guidance from implementation, inspects native constraints before code, and does not translate Expo APIs into SwiftUI. |

For each case, record the prompt, output, inspected artifacts, verification performed, and missed signals. A pass requires the relevant signals without unsupported framework APIs or generic decorative substitutions.
