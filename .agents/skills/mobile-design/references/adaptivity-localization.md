# Adaptivity, Input, and Localization

Use this for tablets, foldables, multitasking, resized windows, external keyboards, pointer or stylus input, RTL, and localized copy or data.

## Window First

Design for the available app window, not a named device. The same app can move between compact, medium, and expanded widths during rotation, multitasking, fold changes, or window resizing.

| Window | Typical response |
| --- | --- |
| Compact | Single pane, bottom navigation, reachable actions, no horizontal overflow |
| Medium | Wider content measure, optional navigation rail or supporting pane |
| Expanded | List-detail or supporting pane, constrained line length, stable navigation |

- Do not stretch buttons, cards, or text merely because a window is wider.
- Keep the primary task usable at every width; add information or panes only when they improve it.
- Preserve selection, drafts, scroll position, and in-progress work as the layout changes.
- Avoid hinge-obscured content on foldables.
- Support portrait and landscape unless the product has a justified orientation constraint.
- Treat iPad multitasking, external displays, and resizable windows as normal states when iPad is supported.

## Input Beyond Touch

- Keep touch targets accessible, but do not make touch the only path.
- Preserve logical keyboard focus and visible focus feedback.
- Support Tab/Shift-Tab traversal, Enter/Space activation, Escape or platform back dismissal, and sensible shortcuts for frequent desktop-like work.
- Let native controls handle pointer, trackpad, mouse, and stylus behavior where possible.
- Do not use hover as the only way to reveal a required action.

## Localization and RTL

- Use locale-aware date, time, number, currency, unit, and name formatting. Do not concatenate translated fragments to form sentences.
- Design with expansion: labels, errors, tabs, and CTAs must wrap, truncate safely, or reflow without concealing the action.
- Use leading/trailing and start/end rather than left/right for layout and spacing.
- Mirror directional layout and symbols in RTL, but do not mirror universally recognized symbols or media controls without checking their semantics.
- Keep numeric, monetary, and data comparisons readable in both directions.
- Test screen-reader labels in the language being read. On iOS, use `accessibilityLanguage` for mixed-language content when necessary.

## Verification Matrix

Run the smallest relevant matrix, not every combination blindly:

| Concern | Minimum check |
| --- | --- |
| Layout | Compact and expanded widths, plus an intermediate or resized width |
| Orientation | Portrait and landscape when supported |
| Foldable | Open and folded posture; no critical hinge overlap |
| iPad | Full width and a narrowed multitasking window |
| Input | Keyboard traversal and one pointer/trackpad interaction on input-heavy screens |
| Localization | Long-string locale, RTL locale if supported, and real locale formats |

If a platform, locale, or form factor is intentionally unsupported, state that constraint rather than treating it as implicitly tested.
