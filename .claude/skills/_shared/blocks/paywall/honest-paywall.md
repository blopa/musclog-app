---
name: honest-paywall
category: paywall
dial_compatibility:
  expression: [4, 9]
  motion: [2, 5]
  density: [2, 4]
platforms: [ios, android]
when_to_use: "Subscription apps at the moment a premium feature is touched, or post-value onboarding step."
not_for: "Cold-start paywalls before any value moment; one-time-purchase apps (use a simpler sheet)."
stack: ["expo-router", "nativewind"]
---

# Honest Paywall

## Sketch
```
[ X ]                          ← close visible within ~2s, top corner, 44pt
[ product visual / feature demo ]
Unlock <concrete thing>        ← headline names the capability, not "Go Premium!"
• bullet (max 4, concrete)
[ Yearly  $59.99/yr  ·  $5/mo equivalent ]   ← price-per-period honesty
[ Monthly $9.99/mo ]
[ Continue ]                   ← ONE primary CTA
Restore purchases · Terms · Privacy          ← restore is MANDATORY (App Review)
```

## Route API
Fullscreen modal route (`paywall.tsx`), presented at feature-touch or post-onboarding.
Params: `source` for analytics.

## Rules (these are the taste)
- **Close affordance visible immediately.** Hiding the X for 5 seconds is a dark pattern
  and an App Review risk.
- **Restore purchases visible without scrolling.**
- **No fake urgency:** no countdown timers that reset, no "83% claimed" counters.
- **Price honesty:** yearly plans show the per-month equivalent; the pre-selected plan
  is visually distinct but not the only readable option; trial terms state price and
  renewal date plainly.
- **Max 4 feature bullets**, each concrete ("Export to PDF", not "Unlock everything").
- Selected-plan state is obvious in both modes (border + fill, not color alone).

## Platform notes
Purchases via RevenueCat or StoreKit/Billing wrappers - never hand-rolled receipt logic.
Android back dismisses the paywall (never trap).

## Motion variants
MOTION 4-5: plan cards spring-select; feature demo may autoplay once. Never looped
attention-grabbing pulses on the CTA.

## Dark mode
Paywalls are brand surfaces - both modes still required; check CTA contrast on both.

## Anti-patterns
- Indigo-gradient background (tell #2). Emoji bullets (tell #1). "Unleash premium!"
  (6.7). Timer urgency. Hidden close. Missing restore. Pre-checked trial with buried
  renewal price.

## References
Things (one-time clarity), Overcast (low-pressure), Flighty (concrete feature bullets).
