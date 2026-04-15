# iOS UIViewController Presentation Hierarchy Issue

## The Bug
When **Modal A** is presented in iOS, the OS creates a specific `UIViewController` for it. The parent component that hosted Modal A is then considered "hidden" or "blocked" by iOS. This means the parent cannot present any new modals. 

A second modal can only be presented by **Modal A's own UIViewController** (i.e., it must be triggered from within the active modal's hierarchy).

---

## Why `GoalsManagementModal` breaks on iOS
In `GoalsManagementModal.tsx:304-403`, the sub-modals are rendered as **siblings** of the outer `FullScreenModal`, rather than inside it:

```tsx
return (
  <>
    <FullScreenModal visible={visible} ...>  {/* Modal A — presented */}
      {/* tabs/content only */}
    </FullScreenModal>

    {/* ❌ Siblings — presented from the blocked host, iOS silently drops these */}
    <GoalCreationMethodModal visible={creationMethodModalVisible} ... />
    <GoalWizardModal visible={wizardModalVisible} ... />
    <NutritionGoalsModal visible={nutritionGoalsModalVisible} ... />
    <ExerciseGoalCreationModal visible={exerciseGoalCreationModalVisible} ... />
    <ConfirmationModal visible={confirmDeleteVisible} ... />
  </>
);
```

**The Result:** When you press "New Goal", the state updates correctly (`creationMethodModalVisible = true`), but iOS refuses to present the new modal because the host component is already occupied. The action is silently swallowed.

---

## Why `FoodSearchModal` works on iOS
In `FoodSearchModal.tsx:929-1639`, all child modals are rendered **inside** the `FullScreenModal` component tree:

```tsx
return (
  <>
    <FullScreenModal visible={visible} ...>
      {/* ... search UI ... */}

      {/* ✅ Children — presented from Modal A's UIViewController, iOS allows this */}
      {selectedFood ? <FoodMealDetailsModal visible={isFoodDetailsVisible} ... /> : null}
      {selectedMeal ? <FoodMealDetailsModal visible={isMealDetailsVisible} ... /> : null}
      <RecentNutritionHistoryModal ... />
      <ConfirmationModal ... />
    </FullScreenModal>
  </>
);
```

**The Result:** Because these are children of the outer `FullScreenModal`, React Native presents them from Modal A's active `UIViewController`, allowing them to stack correctly.

---

## The Fix
Move all sibling sub-modals into the `FullScreenModal` children in `GoalsManagementModal`. Since `FullScreenModal` renders children inside a `<View className="flex-1" pointerEvents="box-none">`, these extra non-visual modal nodes will not interfere with your layout. 

*Let me know when you'd like me to implement it.*
```
