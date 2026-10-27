# Review Rules

Use this with `review-checklists.md` for code or UI reviews. Report only applicable findings, ordered by severity.

Format each finding as:

`[P1] MD-### file:line — issue. Required fix or verification.`

Use `P1` for a blocked task, accessibility failure, data loss, or platform-breaking behavior; `P2` for a meaningful usability, state, or maintainability issue; `P3` for polish or a non-blocking improvement.

| ID | Rule |
| --- | --- |
| MD-001 | A control must have an accessible name, role, and applicable state. |
| MD-002 | A touch-only critical action must have a visible alternative. |
| MD-003 | Text, controls, safe areas, and keyboard must not clip or conceal the primary task. |
| MD-004 | Loading, error, empty, unavailable, and recovery states must match the workflow. |
| MD-005 | Destructive or irreversible actions must be explicit and protected. |
| MD-006 | Platform back, dismiss, and navigation behavior must match the target platform. |
| MD-007 | Text scaling, contrast, dark mode, and color-independent status must preserve meaning. |
| MD-008 | Lists, images, and motion must avoid unmeasured work in scroll-critical paths. |
| MD-009 | Layout must survive supported window changes, orientation, and input methods. |
| MD-010 | Localized products must support long strings, locale formats, and RTL when applicable. |
| MD-011 | Reusable components must expose a semantic contract and consistent states. |
| MD-012 | New platform or library APIs must match installed versions and current official docs. |

When no issue is found, state the verification performed and the risks that remain unverified. Do not invent findings to fill every rule.
