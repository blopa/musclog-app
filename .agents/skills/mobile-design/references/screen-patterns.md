# Screen Patterns

Use this when the task asks for a whole mobile screen, flow, or redesign. These are templates for thinking, not finished visual styles.

## Universal Screen Anatomy

Every screen should answer:

- Where am I?
- What matters most?
- What can I do next?
- What state is the system in?
- What happens if content is empty, loading, unavailable, or errored?

Default structure:

1. System-safe container with background.
2. App/navigation header only when it helps orientation.
3. Primary content area.
4. Reachable primary action when the screen has a linear job.
5. Secondary actions placed by priority and risk.
6. State surfaces for loading, empty, error, offline, and permission cases.

## Feed or List Screen

Use for inboxes, products, workouts, recipes, transactions, chats, tasks, search results.

Structure:

- Header with title and one high-value action, not a toolbar full of icons.
- Search/filter only if the list is large enough to need it.
- Content list with stable row hierarchy: title, key metadata, status/action.
- Pull-to-refresh when remote content changes.
- Empty state that explains how to create or discover content.
- Error state with retry and any cached data preserved if available.

Design choices:

- Dense operational lists: separators, compact rows, fewer cards.
- Visual discovery lists: image-led rows/cards and varied feature item.
- Risk/finance lists: explicit amounts, dates, statuses, and no ambiguous color-only signals.

Checklist:

- First visible row communicates the list's purpose.
- Row tap area meets platform minimum.
- Swipe actions have visible alternatives.
- Filters have clear applied/empty states.
- Long names and large text do not break rows.

## Detail Screen

Use for product, profile, article, booking, transaction, recipe, task, workout, or media details.

Structure:

- Strong identifying content at top: name/image/status/key number.
- Contextual metadata under the primary identity.
- Primary action close to thumb zone if action-oriented.
- Secondary actions grouped and de-emphasized.
- Related content or history below the main decision area.

Design choices:

- Product/detail commerce: image inspection, price, variants, availability, return/delivery confidence.
- Transaction/finance: amount, merchant, date, status, dispute/support path.
- Profile/social: identity, relationship state, recent activity, privacy controls.
- Recipe/media: image or playback first, then steps/details.

Checklist:

- The primary entity is unmistakable in the first viewport.
- Primary action is visible without fighting content.
- Sticky action bar only if users need it after scrolling.
- Dangerous actions are separated and confirmed.
- Loading state preserves the expected detail layout.

## Form, Checkout, or Creation Screen

Use this with `references/forms.md`.

Structure:

- Clear title that names the task.
- Fields grouped by mental model, not backend schema.
- Inline helper/error text.
- Keyboard-aware scroll and focus movement.
- Primary submit action reachable and stateful.
- Review/confirmation step for irreversible or payment flows.

Design choices:

- Short forms can be one screen.
- Long forms should chunk into sections or steps.
- Checkout needs cost transparency, edit paths, and trust markers.
- Creation flows should preserve drafts.

Checklist:

- Correct keyboard type and autocomplete per field.
- Return key moves to next field or submits at the right time.
- Submit disabled state explains what is missing.
- Errors are field-specific when possible.
- No entered data is lost on navigation or retry.

## Onboarding Screen or Flow

Use onboarding only when it reduces future confusion or collects necessary setup. Do not block users with marketing slides when task-first entry works.

Alternatives to generic centered slides:

- Task-first: start with the core action, explain while doing.
- Progressive permission: ask for permissions at the moment of value.
- Single immersive setup: one screen that sets goal, preference, or account type.
- Sample-data preview: show a realistic finished state, then let users personalize.
- Guided checklist: for complex tools where setup is genuinely multi-step.

Rules:

- Never ask for notification/location/health/photo permissions before explaining user value.
- Avoid more than 3 screens unless onboarding is the product.
- Let users skip nonessential education.
- Keep primary CTA concrete: `Set running goal`, `Import contacts`, `Start trial`.
- Design empty states so skipped onboarding still works.

## Dashboard or Home Screen

Use for repeated status checks, operational apps, finance, health, productivity.

Structure:

- Most important status or next action first.
- Secondary modules ordered by frequency and urgency.
- No equal-weight grid of unrelated cards.
- Alerts interrupt only when action is needed.
- Personalization should improve speed, not create mystery.

Checklist:

- User can identify what changed since last visit.
- Critical state is not hidden below decorative content.
- Metrics have labels, units, and trend context.
- Empty modules collapse or explain setup.

## Screen Verification

- Screenshot at small and large phone widths.
- Large text enabled.
- Dark mode.
- Empty/loading/error states.
- Keyboard open for form screens.
- Back/dismiss behavior.
- Screen reader focus order for primary flow.
