# iOS UIViewController Presentation Hierarchy Issue

## The Bug

When **Modal A** is presented on iOS, React Native mounts it in a dedicated `UIViewController`.
At that point, the original host that presented Modal A is no longer the active presenter.

If a second modal is rendered as a **sibling** of Modal A, iOS often tries to present it from the
blocked original host instead of from Modal A's active controller. The state updates correctly, but
the modal presentation can be silently ignored.

The safe rule is:

- If a modal can open another modal, the second modal should be rendered **inside the first modal's children tree**.
- It does **not** need to be visually nested.
- It just needs to live somewhere under the active modal in the React tree so React Native presents
  it from the correct native controller.

## Known Good Pattern

`FoodSearchModal` is the reference implementation.

In `components/modals/FoodSearchModal.tsx:930-1639`, follow-up modals are rendered inside the
outer `FullScreenModal`:

```tsx
<FullScreenModal visible={visible} ...>
  {/* content */}

  {selectedFood ? <FoodMealDetailsModal ... /> : null}
  {selectedMeal ? <FoodMealDetailsModal ... /> : null}
  <RecentNutritionHistoryModal ... />
  <ConfirmationModal ... />
</FullScreenModal>
```

This works on iOS because the child modals are presented from the active modal's
`UIViewController`.

## Already Fixed

### `GoalsManagementModal`

Fixed in `components/modals/GoalsManagementModal.tsx`.

Before:

```tsx
<>
  <FullScreenModal ... />
  <GoalCreationMethodModal ... />
  <GoalWizardModal ... />
  <NutritionGoalsModal ... />
  <ExerciseGoalCreationModal ... />
  <ConfirmationModal ... />
</>
```

After:

```tsx
<FullScreenModal ...>
  {/* content */}
  <GoalCreationMethodModal ... />
  <GoalWizardModal ... />
  <NutritionGoalsModal ... />
  <ExerciseGoalCreationModal ... />
  <ConfirmationModal ... />
</FullScreenModal>
```

### Workout template confirmation flow

Fixed in:

- `app/workout/workouts.tsx`
- `components/modals/BrowseTemplatesModal.tsx`

`BrowseTemplatesModal` now owns the "create from template" confirmation modal, instead of leaving
that confirmation as a sibling on the screen.

## Confirmed Remaining Cases

These were manually checked during a repo-wide scan. They are the places that still match the same
iOS-risk pattern.

### 1. `AdvancedSettingsModal` is a modal hub with many sibling follow-up modals

File:

- `components/modals/AdvancedSettingsModal.tsx:350-886`

Problem:

- Outer `FullScreenModal` at `:350`
- Sibling confirmation/input modals at `:665`, `:724`, `:771`
- Sibling data-management modals at `:850-886`
- Sibling `LocalBackupsModal` at `:886`

Why it is risky:

- Buttons inside `AdvancedSettingsModal` open these follow-up modals while the advanced settings
  modal is still on screen.
- On iOS, those sibling presentations can be dropped.

Fix:

- Move the export/import/disable-encryption modals and the data-management modals inside the
  `FullScreenModal` children.
- `LocalBackupsModal` should also be rendered inside the `AdvancedSettingsModal` tree.

### 2. `LocalBackupsModal` opens menus and confirmations as siblings

File:

- `components/modals/LocalBackupsModal.tsx:180-257`

Problem:

- Outer `FullScreenModal` at `:180`
- Sibling `BottomPopUpMenu` at `:239`
- Sibling delete confirmation at `:246`
- Sibling restore confirmation at `:257`

Why it is risky:

- These are all opened from buttons inside `LocalBackupsModal`.

Fix:

- Render the `BottomPopUpMenu` and both `ConfirmationModal`s inside the `FullScreenModal`.

### 3. `CheckinDetailsModal` opens `NutritionGoalsModal` as a sibling

File:

- `components/modals/CheckinDetailsModal.tsx:195-200`
- `components/modals/CheckinDetailsModal.tsx:233-553`

Problem:

- Outer `FullScreenModal`
- Sibling `NutritionGoalsModal` in both the loading and loaded branches

Why it is risky:

- The "Readjust" action is triggered from inside `CheckinDetailsModal`, but the nutrition goals
  editor is not rendered inside that modal tree.

Fix:

- Move `NutritionGoalsModal` inside the `FullScreenModal` in both branches.

### 4. `CycleLogModal` opens the date picker as a sibling

File:

- `components/modals/CycleLogModal.tsx:168-253`

Problem:

- Outer `CenteredModal` at `:168`
- Sibling `DatePickerModal` at `:253`

Why it is risky:

- The date picker is opened from a control inside the centered log modal.

Fix:

- Render `DatePickerModal` inside the `CenteredModal` children.

### 5. `LogMealModal` opens follow-up modals as siblings

File:

- `components/modals/LogMealModal.tsx:153-264`

Problem:

- Outer `FullScreenModal` at `:153`
- Sibling `DatePickerModal` at `:252`
- Sibling ingredients `CenteredModal` at `:264`

Why it is risky:

- Both follow-up modals are launched from controls inside the meal logging modal.

Fix:

- Move both follow-up modals inside the `FullScreenModal`.

### 6. `MealEstimationModal` opens delete confirmation as a sibling

File:

- `components/modals/MealEstimationModal.tsx:120-154`

Problem:

- Outer `FullScreenModal` at `:120`
- Sibling `ConfirmationModal` at `:154`

Why it is risky:

- Delete actions are triggered from inside the estimation modal.

Fix:

- Render the confirmation modal inside the `FullScreenModal`.

### 7. `PortionSizesPickerModal` opens `CreateFoodPortionModal` as a sibling

File:

- `components/modals/PortionSizesPickerModal.tsx:144-256`

Problem:

- Outer `FullScreenModal` at `:144`
- Sibling `CreateFoodPortionModal` at `:256`

Why it is risky:

- The "Add New" action is triggered from inside the portion picker.

Fix:

- Render `CreateFoodPortionModal` inside the `FullScreenModal`.

### 8. `ViewExerciseModal` opens menu/edit/delete flows as siblings

File:

- `components/modals/ViewExerciseModal.tsx:385-648`

Problem:

- Outer `FullScreenModal` at `:385`
- Sibling delete `ConfirmationModal` at `:636`
- Sibling `GenericEditModal` at `:648`
- The menu is currently inside the `FullScreenModal` at `:627`, which is correct

Why it is risky:

- Edit and delete are triggered from the exercise modal's menu.

Fix:

- Move `ConfirmationModal` and `GenericEditModal` inside the `FullScreenModal`.

### 9. `VisualSettingsModal` opens the picker menu as a sibling

File:

- `components/modals/VisualSettingsModal.tsx:124-149`

Problem:

- Outer `FullScreenModal` at `:124`
- Sibling `BottomPopUpMenu` at `:149`

Why it is risky:

- Slot pickers are opened from inside the visual settings modal.

Fix:

- Render the `BottomPopUpMenu` inside the `FullScreenModal`.

### 10. `FoodMealDetailsModal` mixes a safe child modal and an unsafe sibling popup

File:

- `components/modals/FoodMealDetailsModal.tsx:2172-2323`

Problem:

- Outer `FullScreenModal` at `:2172`
- Child `DatePickerModal` at `:2310`, which is already correct
- Sibling `BottomPopUp` at `:2323`

Why it is risky:

- The edit sheet is opened from inside the food details modal, but it is rendered outside the
  active modal tree.

Fix:

- Move the `BottomPopUp` inside the `FullScreenModal`.

### 11. `DataLogModal` is another modal hub with many sibling follow-up modals

File:

- `components/modals/DataLogModal.tsx:1368-1611`

Problem:

- Outer `FullScreenModal` at `:1368`
- Sibling item menu at `:1478`
- Sibling delete confirmation at `:1488`
- Sibling edit modal at `:1504`
- Sibling `PastWorkoutDetailModal` at `:1517`
- Sibling create menu at `:1530`
- Sibling create flows at `:1540-1611`

Why it is risky:

- `DataLogModal` is a management hub; most actions inside it open another modal without closing the
  parent first.

Fix:

- Move all follow-up modals and menus inside the `FullScreenModal`.
- This is the biggest remaining hotspot and probably the best place to standardize a reusable
  pattern.

## Pattern To Use Everywhere

Unsafe:

```tsx
return (
  <>
    <FullScreenModal visible={visible} ...>
      {/* content */}
    </FullScreenModal>

    <ConfirmationModal visible={confirmVisible} ... />
    <DatePickerModal visible={dateVisible} ... />
  </>
);
```

Safe:

```tsx
return (
  <FullScreenModal visible={visible} ...>
    {/* content */}

    <ConfirmationModal visible={confirmVisible} ... />
    <DatePickerModal visible={dateVisible} ... />
  </FullScreenModal>
);
```

The same rule applies to `CenteredModal`, `BottomPopUp`, `BottomPopUpMenu`, and any wrapper that
ultimately uses React Native's `Modal`.

## Practical Notes

- If a modal is only opened from a screen while no other modal is active, sibling placement is
  usually fine.
- The bug matters when a modal is opened **from inside another modal**.
- A child modal can be rendered anywhere inside the active modal tree. It does not need to be
  visually inside the section that triggers it.
- `pointerEvents="box-none"` in `FullScreenModal` is already compatible with this pattern, so
  non-visual child modal nodes do not interfere with layout.
