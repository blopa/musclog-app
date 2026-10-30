# Feasibility and Risk

Run this preflight only for features involving permissions, sensors, camera or media, background execution, realtime or offline sync, payments, auth or sensitive data, native modules, hardware-dependent behavior, or performance-sensitive animation and lists. Skip it for ordinary static screens, components, and navigation changes.

## Preflight

Answer these briefly before implementation:

1. What user outcome requires the capability?
2. What happens if permission is declined, the device lacks support, the network is unavailable, or the task is interrupted?
3. Which data is stored, where, and for how long?
4. Does the installed runtime support the capability on every target platform?
5. What will verify the capability on real devices or representative simulators?

## Decide and State

State the primary path, fallback, user control, and verification plan. Keep it task-specific.

| Risk | Required design response |
| --- | --- |
| Permission or sensitive capability | Explain value before the system prompt, provide decline and settings-recovery paths. |
| Offline or unstable network | Preserve local work where safe, show sync state, and provide retry or recovery. |
| Background or long-running work | Explain status, battery and data impact where relevant, plus interruption behavior. |
| Sensitive data or payments | Use secure storage and explicit confirmation; never treat a pending action as success. |
| Unsupported runtime or platform divergence | Do not promise the capability; choose a fallback or state the constraint. |
| Performance-sensitive UI | Define the target device and measurement or screenshot/performance checks before adding complexity. |

Avoid a composite score. A short explicit risk, fallback, and verification statement is more actionable and less likely to hide a release blocker.
