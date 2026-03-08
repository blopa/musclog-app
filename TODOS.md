# TODO Map

> Last updated: 2026-03-02 — 25 TODOs across 12 files

---

## 🔥 High Priority

### services/healthDataSync.ts

| Line                                   | TODO                                                         | Priority |
| -------------------------------------- | ------------------------------------------------------------ | -------- |
| [498](services/healthDataSync.ts#L498) | Implement writing to Health Connect (sync back to HC format) | High     |

### components/modals/CreateExerciseModal.tsx

| Line                                                | TODO                            | Priority |
| --------------------------------------------------- | ------------------------------- | -------- |
| [58](components/modals/CreateExerciseModal.tsx#L58) | Implement create exercise logic | High     |

---

## 🟡 Medium Priority

### components/modals/CreateExerciseModal.tsx

| Line                                                | TODO                      | Priority |
| --------------------------------------------------- | ------------------------- | -------- |
| [68](components/modals/CreateExerciseModal.tsx#L68) | Implement image upload    | Medium   |
| [73](components/modals/CreateExerciseModal.tsx#L73) | Implement video URL input | Medium   |

### app/workout/

| Line                                      | File                  | TODO                                                 | Priority |
| ----------------------------------------- | --------------------- | ---------------------------------------------------- | -------- |
| [520](app/workout/workouts.tsx#L520)      | `workouts.tsx`        | Implement share functionality (`onShare` callback)   | Medium   |
| [97](app/workout/workout-summary.tsx#L97) | `workout-summary.tsx` | Implement share functionality (`handleShareSummary`) | Medium   |

### components/modals/BodyMetricsHistoryModal.tsx

| Line                                                      | TODO                                                  | Priority |
| --------------------------------------------------------- | ----------------------------------------------------- | -------- |
| [300](components/modals/BodyMetricsHistoryModal.tsx#L300) | Open add-new-metric modal/form in `handleNewMetric()` | Medium   |

### components/modals/CreateWorkoutOptionsModal.tsx

| Line                                                        | TODO                                 | Priority |
| ----------------------------------------------------------- | ------------------------------------ | -------- |
| [107](components/modals/CreateWorkoutOptionsModal.tsx#L107) | Only show AI option if AI is enabled | Medium   |

To know if AI is enabled, we need to check if:

- User is either authenticated with google and has enabled AI in their settings
- User is not authenticated but has enabled AI in their settings and has a api key for openai or gemini

### components/

| Line                                               | File                            | TODO         | Priority |
| -------------------------------------------------- | ------------------------------- | ------------ | -------- |
| [21](components/WorkoutSummaryCelebration.tsx#L21) | `WorkoutSummaryCelebration.tsx` | Fix UI issue | Medium   |

---

## 🔵 Low Priority

### components/modals/GenericEditModal.tsx

| Line                                             | TODO                                            | Priority |
| ------------------------------------------------ | ----------------------------------------------- | -------- |
| [27](components/modals/GenericEditModal.tsx#L27) | Improve Meals modal to support add/remove foods | Low      |
| [28](components/modals/GenericEditModal.tsx#L28) | Improve edit workout template modal             | Low      |

### components/modals/SmartCameraModal.tsx

| Line                                               | TODO                                        | Priority |
| -------------------------------------------------- | ------------------------------------------- | -------- |
| [122](components/modals/SmartCameraModal.tsx#L122) | Add vibration feedback on barcode detection | Low      |

### components/modals/BodyMetricsHistoryModal.tsx

| Line                                                      | TODO                                             | Priority |
| --------------------------------------------------------- | ------------------------------------------------ | -------- |
| [463](components/modals/BodyMetricsHistoryModal.tsx#L463) | Make X-axis labels dynamic based on actual dates | Low      |

### components/LineChart.tsx

| Line                                      | TODO                                                                | Priority |
| ----------------------------------------- | ------------------------------------------------------------------- | -------- |
| [86](components/charts/LineChart.tsx#L86) | Use `lastPointStrokeColor` prop (currently destructured but unused) | Low      |
| [87](components/charts/LineChart.tsx#L87) | Use `lastPointStrokeWidth` prop (currently destructured but unused) | Low      |

### components/

| Line                                            | File                         | TODO                                                    | Priority |
| ----------------------------------------------- | ---------------------------- | ------------------------------------------------------- | -------- |
| [22](components/cards/NotificationCard.tsx#L22) | `cards/NotificationCard.tsx` | Implement different styles based on notification `type` | Low      |

### hooks/**tests**/useWorkoutForm.test.ts

| Line                                               | TODO                                                             | Priority |
| -------------------------------------------------- | ---------------------------------------------------------------- | -------- |
| [443](hooks/__tests__/useWorkoutForm.test.ts#L443) | Implement edit mode save test (currently skipped with `it.skip`) | Low      |
