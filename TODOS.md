# TODO Map

> Last updated: 2026-03-02 — 25 TODOs across 12 files

---

## services/healthDataSync.ts

| Line                                   | TODO                                                         |
| -------------------------------------- | ------------------------------------------------------------ |
| [498](services/healthDataSync.ts#L498) | Implement writing to Health Connect (sync back to HC format) |

---

## app/workout/

| Line                                      | File                  | TODO                                                 |
| ----------------------------------------- | --------------------- | ---------------------------------------------------- |
| [520](app/workout/workouts.tsx#L520)      | `workouts.tsx`        | Implement share functionality (`onShare` callback)   |
| [97](app/workout/workout-summary.tsx#L97) | `workout-summary.tsx` | Implement share functionality (`handleShareSummary`) |

---

## components/modals/CreateExerciseModal.tsx

| Line                                                | TODO                            |
| --------------------------------------------------- | ------------------------------- |
| [58](components/modals/CreateExerciseModal.tsx#L58) | Implement create exercise logic |
| [68](components/modals/CreateExerciseModal.tsx#L68) | Implement image upload          |
| [73](components/modals/CreateExerciseModal.tsx#L73) | Implement video URL input       |

---

## components/modals/SmartCameraModal.tsx

| Line                                               | TODO                                        |
| -------------------------------------------------- | ------------------------------------------- |
| [122](components/modals/SmartCameraModal.tsx#L122) | Add vibration feedback on barcode detection |

---

## components/modals/BodyMetricsHistoryModal.tsx

| Line                                                      | TODO                                                  |
| --------------------------------------------------------- | ----------------------------------------------------- |
| [300](components/modals/BodyMetricsHistoryModal.tsx#L300) | Open add-new-metric modal/form in `handleNewMetric()` |
| [463](components/modals/BodyMetricsHistoryModal.tsx#L463) | Make X-axis labels dynamic based on actual dates      |

---

## components/modals/GenericEditModal.tsx

| Line                                             | TODO                                            |
| ------------------------------------------------ | ----------------------------------------------- |
| [27](components/modals/GenericEditModal.tsx#L27) | Improve Meals modal to support add/remove foods |
| [28](components/modals/GenericEditModal.tsx#L28) | Improve edit workout template modal             |

---

## components/modals/CreateWorkoutOptionsModal.tsx

| Line                                                        | TODO                                 |
| ----------------------------------------------------------- | ------------------------------------ |
| [107](components/modals/CreateWorkoutOptionsModal.tsx#L107) | Only show AI option if AI is enabled |

To know if AI is enabled, we need to check if:

- User is either authenticated with google and has enabled AI in their settings
- User is not authenticated but has enabled AI in their settings and has a api key for openai or gemini

---

## components/LineChart.tsx

| Line                               | TODO                                                                |
| ---------------------------------- | ------------------------------------------------------------------- |
| [86](components/LineChart.tsx#L86) | Use `lastPointStrokeColor` prop (currently destructured but unused) |
| [87](components/LineChart.tsx#L87) | Use `lastPointStrokeWidth` prop (currently destructured but unused) |

---

## components/

| Line                                               | File                            | TODO                                                    |
| -------------------------------------------------- | ------------------------------- | ------------------------------------------------------- |
| [21](components/WorkoutSummaryCelebration.tsx#L21) | `WorkoutSummaryCelebration.tsx` | Fix UI issue                                            |
| [22](components/cards/NotificationCard.tsx#L22)    | `cards/NotificationCard.tsx`    | Implement different styles based on notification `type` |

---

## hooks/**tests**/useWorkoutForm.test.ts

| Line                                               | TODO                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| [443](hooks/__tests__/useWorkoutForm.test.ts#L443) | Implement edit mode save test (currently skipped with `it.skip`) |
