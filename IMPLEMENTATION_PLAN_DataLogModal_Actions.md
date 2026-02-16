# Implementation Plan: DataLogModal Menu Actions

## Overview
This plan outlines the implementation of Edit, Duplicate, Delete, and Favorite toggle actions for all models in `DataLogModal.tsx`. These modals are used in `AdvancedSettingsModal.tsx` for data management.

## Current State Analysis

### ✅ Already Implemented
1. **Favorite Toggle** (`handleToggleFavorite`)
   - ✅ Works for: `meal`, `food`
   - ✅ Uses: `MealService.toggleMealFavorite()`, `FoodService.toggleFavorite()`
   - ✅ Refreshes data after toggle

2. **Duplicate** (`handleDuplicate`)
   - ✅ Works for: `meal`, `food`, `foodPortion`, `exercise`, `workoutTemplate`, `workoutLog`, `nutrition_log`
   - ✅ Uses service methods: `duplicateMeal()`, `duplicateFood()`, `duplicatePortion()`, `duplicateExercise()`, `duplicateTemplate()`, `duplicateWorkoutLog()`, `duplicateNutritionLog()`
   - ✅ Shows loading state (`isDuplicating`)
   - ✅ Refreshes data after duplicate
   - ❌ Missing: `userMetric`, `nutritionGoal` (these variants don't support duplicate per code)

3. **Delete** (`handleDelete` / `handleConfirmDelete`)
   - ✅ Works for: All variants (`meal`, `food`, `foodPortion`, `exercise`, `workoutTemplate`, `workoutLog`, `nutrition_log`, `userMetric`, `nutritionGoal`)
   - ✅ Uses: `ConfirmationModal` for confirmation
   - ✅ Shows loading state (`isDeleting`)
   - ✅ Refreshes data after delete
   - ❌ Missing: Dependency checks before deletion
   - ❌ Missing: Error toast notifications

4. **Edit** (`handleEdit`)
   - ❌ Only logs to console
   - ❌ Needs to open appropriate edit modal based on variant

### Existing Edit/Create Modals Available
- ✅ `CreateMealModal.tsx` - Can be reused for editing meals
- ✅ `CreateCustomFoodModal.tsx` - Can be reused for editing foods
- ✅ `CreateFoodPortionModal.tsx` - Can be reused for editing portions
- ✅ `CreateExerciseModal.tsx` - Can be reused for editing exercises
- ✅ `CreateWorkoutModal.tsx` - Can be reused for editing workout templates
- ✅ `EditPastWorkoutDataModal.tsx` - For editing workout logs
- ❓ Need to check/create: Edit modals for `nutrition_log`, `userMetric`, `nutritionGoal`

### Toast/Snackbar System
- ✅ `SnackbarContext` with `useSnackbar()` hook
- ✅ `showSnackbar(type, message, options)` utility function
- ✅ Supports: `'success'` and `'error'` types with optional subtitle

---

## Implementation Tasks

### Phase 1: Edit Functionality

#### Task 1.1: Make Create Modals Support Edit Mode
**Files to modify:**
- `components/modals/CreateMealModal.tsx`
- `components/modals/CreateCustomFoodModal.tsx`
- `components/modals/CreateFoodPortionModal.tsx`
- `components/modals/CreateExerciseModal.tsx`
- `components/modals/CreateWorkoutModal.tsx`

**Changes needed:**
1. Add optional `editMode?: boolean` prop
2. Add optional `itemId?: string` prop (for loading existing data)
3. When `editMode === true`:
   - Load existing item data on mount
   - Pre-fill form fields
   - Change title/button text to "Edit" instead of "Create"
   - On save, call update service method instead of create
   - Show success toast: "Meal updated successfully" (or appropriate message)

**Example pattern:**
```typescript
type CreateMealModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave?: () => void;
  editMode?: boolean;
  mealId?: string; // Required if editMode is true
};
```

#### Task 1.2: Implement handleEdit in DataLogModal
**File:** `components/modals/DataLogModal.tsx`

**Changes:**
1. Add state for edit modals: `[editModalVisible, setEditModalVisible]` and `[editItemId, setEditItemId]`
2. Update `handleEdit()`:
   ```typescript
   const handleEdit = () => {
     if (!selectedItem) return;
     setShowMenu(false);
     setEditItemId(selectedItem.id);
     setEditModalVisible(true);
   };
   ```
3. Render appropriate edit modal based on variant:
   - `meal` → `CreateMealModal` with `editMode={true}` and `mealId={editItemId}`
   - `food` → `CreateCustomFoodModal` with `editMode={true}` and `foodId={editItemId}`
   - `foodPortion` → `CreateFoodPortionModal` with `editMode={true}` and `portionId={editItemId}`
   - `exercise` → `CreateExerciseModal` with `editMode={true}` and `exerciseId={editItemId}`
   - `workoutTemplate` → `CreateWorkoutModal` with `editMode={true}` and `templateId={editItemId}`
   - `workoutLog` → `EditPastWorkoutDataModal` (already exists, check props)
   - `nutrition_log` → **TODO: Create EditNutritionLogModal** (or check if exists)
   - `userMetric` → **TODO: Create EditUserMetricModal** (or check if exists)
   - `nutritionGoal` → **TODO: Create EditNutritionGoalModal** (or check if exists)

#### Task 1.3: Create Missing Edit Modals (if needed)
**Check first if these exist:**
- Edit modals for `nutrition_log`, `userMetric`, `nutritionGoal`

**If missing, create:**
- `components/modals/EditNutritionLogModal.tsx`
- `components/modals/EditUserMetricModal.tsx`
- `components/modals/EditNutritionGoalModal.tsx`

**Pattern:** Similar to existing edit modals, load data by ID, pre-fill form, update on save.

---

### Phase 2: Dependency Checking Before Deletion

#### Task 2.1: Create Dependency Check Service Methods
**Files to create/modify:**
- `database/services/MealService.ts`
- `database/services/FoodService.ts`
- `database/services/FoodPortionService.ts`
- `database/services/ExerciseService.ts`
- `database/services/WorkoutTemplateService.ts`
- `database/services/WorkoutService.ts`
- `database/services/NutritionGoalService.ts`

**New methods to add:**

1. **MealService.checkMealInUse(mealId: string): Promise<{ inUse: boolean; usageCount: number; details: string }>**
   - Check `nutrition_logs` table for entries using this meal
   - Return count and details (e.g., "Used in 5 nutrition logs")

2. **FoodService.checkFoodInUse(foodId: string): Promise<{ inUse: boolean; usageCount: number; details: string }>**
   - Check `meal_foods` table (meals using this food)
   - Check `nutrition_logs` table (nutrition logs using this food)
   - Return combined count and details

3. **FoodPortionService.checkPortionInUse(portionId: string): Promise<{ inUse: boolean; usageCount: number; details: string }>**
   - Check `food_food_portions` table (foods using this portion)
   - Check `meal_foods` table (meals using this portion)
   - Check `nutrition_logs` table (nutrition logs using this portion)
   - Return combined count and details

4. **ExerciseService.checkExerciseInUse(exerciseId: string): Promise<{ inUse: boolean; usageCount: number; details: string }>**
   - Check `workout_template_sets` table (templates using this exercise)
   - Check `workout_log_sets` table (workout logs using this exercise)
   - Return combined count and details

5. **WorkoutTemplateService.checkTemplateInUse(templateId: string): Promise<{ inUse: boolean; usageCount: number; details: string }>**
   - Check `schedules` table (active schedules using this template)
   - Check `workout_logs` table (workout logs created from this template)
   - Return combined count and details

6. **WorkoutService.checkWorkoutLogInUse(logId: string): Promise<{ inUse: boolean; isActive: boolean; details: string }>**
   - Check if this is the currently active workout
   - Return details

7. **NutritionGoalService.checkGoalInUse(goalId: string): Promise<{ inUse: boolean; isActive: boolean; details: string }>**
   - Check if this is the current active goal
   - Return details

**Example implementation pattern:**
```typescript
static async checkMealInUse(mealId: string): Promise<{
  inUse: boolean;
  usageCount: number;
  details: string;
}> {
  const nutritionLogs = await database
    .get<NutritionLog>('nutrition_logs')
    .query(
      Q.where('meal_id', mealId),
      Q.where('deleted_at', Q.eq(null))
    )
    .fetch();
  
  const count = nutritionLogs.length;
  return {
    inUse: count > 0,
    usageCount: count,
    details: count > 0 
      ? `Used in ${count} nutrition log${count > 1 ? 's' : ''}`
      : 'Not in use',
  };
}
```

#### Task 2.2: Update handleConfirmDelete with Dependency Checks
**File:** `components/modals/DataLogModal.tsx`

**Changes:**
1. Before deletion, call dependency check method
2. If `inUse === true`:
   - Show enhanced `ConfirmationModal` with warning message including `details`
   - Add warning text: "This item is currently in use. Deleting it may affect related data."
   - Still allow deletion but make it clear it's destructive
3. Update delete confirmation message to include dependency info

**Example:**
```typescript
const handleConfirmDelete = async () => {
  if (!selectedItem) return;
  
  // Check dependencies
  let dependencyInfo = null;
  try {
    switch (variant) {
      case 'meal':
        dependencyInfo = await MealService.checkMealInUse(selectedItem.id);
        break;
      // ... other variants
    }
  } catch (error) {
    console.error('Dependency check failed:', error);
  }
  
  // Show enhanced confirmation if in use
  if (dependencyInfo?.inUse) {
    // Update confirmation modal message with dependency details
    setDeleteWarningMessage(
      `${translations.deleteDesc}\n\n${dependencyInfo.details}`
    );
  }
  
  // Proceed with deletion...
};
```

---

### Phase 3: Error Handling & Toast Notifications

#### Task 3.1: Add Toast Notifications to Actions
**File:** `components/modals/DataLogModal.tsx`

**Changes:**
1. Import: `import { showSnackbar } from '../../utils/snackbarService';`
2. Update `handleToggleFavorite`:
   - Show success toast: "Added to favorites" / "Removed from favorites"
   - Show error toast on catch: "Failed to update favorites"
3. Update `handleDuplicate`:
   - Show success toast: "Duplicated successfully"
   - Show error toast on catch: "Failed to duplicate"
4. Update `handleConfirmDelete`:
   - Show success toast: "Deleted successfully"
   - Show error toast on catch: "Failed to delete"

**Example:**
```typescript
import { showSnackbar } from '../../utils/snackbarService';

const handleDuplicate = async () => {
  // ... existing code ...
  try {
    // ... duplicate logic ...
    showSnackbar('success', t('common.duplicatedSuccessfully', 'Duplicated successfully'));
    await refresh();
  } catch (error) {
    console.error('Duplicate failed:', error);
    showSnackbar('error', t('common.duplicateFailed', 'Failed to duplicate'), {
      subtitle: error instanceof Error ? error.message : undefined,
    });
  } finally {
    setIsDuplicating(false);
  }
};
```

#### Task 3.2: Add Translation Keys
**File:** `lang/locales/en-us.json`

**Add to `common` section:**
```json
{
  "common": {
    "duplicatedSuccessfully": "Duplicated successfully",
    "duplicateFailed": "Failed to duplicate",
    "deletedSuccessfully": "Deleted successfully",
    "deleteFailed": "Failed to delete",
    "addedToFavorites": "Added to favorites",
    "removedFromFavorites": "Removed from favorites",
    "favoriteUpdateFailed": "Failed to update favorites",
    "deleteConfirmMessage": "Are you sure you want to delete {{name}}?",
    "deleteWarningInUse": "This item is currently in use. Deleting it may affect related data."
  }
}
```

---

### Phase 4: Service Method Updates

#### Task 4.1: Add Update Methods (if missing)
**Check if these service methods exist:**
- `MealService.updateMeal(mealId, updates)`
- `FoodService.updateFood(foodId, updates)`
- `FoodPortionService.updateFoodPortion()` (already exists)
- `ExerciseService.updateExercise(exerciseId, updates)`
- `WorkoutTemplateService.updateTemplate(templateId, updates)`
- `NutritionService.updateNutritionLog(logId, updates)`
- `UserMetricService.updateMetric(metricId, updates)`
- `NutritionGoalService.updateGoal(goalId, updates)`

**If missing, create them following the pattern:**
```typescript
static async updateMeal(
  mealId: string,
  updates: {
    name?: string;
    // ... other fields
  }
): Promise<Meal> {
  return await database.write(async () => {
    const meal = await database.get<Meal>('meals').find(mealId);
    if (meal.deletedAt) {
      throw new Error('Cannot update deleted meal');
    }
    await meal.update((record) => {
      if (updates.name !== undefined) record.name = updates.name;
      // ... update other fields
      record.updatedAt = Date.now();
    });
    return meal;
  });
}
```

---

## Implementation Order

### Priority 1 (Critical - Core Functionality)
1. ✅ **Phase 3.1**: Add toast notifications (quick win, improves UX)
2. ✅ **Phase 1.2**: Implement `handleEdit` to open modals (even if modals don't support edit mode yet)
3. ✅ **Phase 1.1**: Make create modals support edit mode (one at a time, starting with most used)

### Priority 2 (Important - Safety)
4. ✅ **Phase 2.1**: Create dependency check methods
5. ✅ **Phase 2.2**: Update delete confirmation with dependency warnings

### Priority 3 (Nice to Have)
6. ✅ **Phase 1.3**: Create missing edit modals for `nutrition_log`, `userMetric`, `nutritionGoal`
7. ✅ **Phase 4.1**: Add missing update service methods

---

## Testing Checklist

For each variant, test:
- [ ] Edit opens correct modal with pre-filled data
- [ ] Edit saves changes and refreshes list
- [ ] Duplicate creates copy and refreshes list
- [ ] Delete shows confirmation modal
- [ ] Delete with dependencies shows warning
- [ ] Delete removes item and refreshes list
- [ ] Favorite toggle updates star icon
- [ ] Success toasts appear after successful actions
- [ ] Error toasts appear on failures
- [ ] Loading states work correctly during async operations

---

## Notes

1. **Edit Modals**: The create modals can be reused for editing by adding `editMode` prop. This avoids code duplication.

2. **Dependency Checks**: These are important for data integrity but shouldn't block deletion - just warn the user.

3. **Toast Notifications**: Use the existing `showSnackbar` utility for consistent UX.

4. **Error Handling**: Always wrap async operations in try-catch and show user-friendly error messages.

5. **Refresh**: After any mutation (edit, duplicate, delete, favorite), call `refresh()` to update the list.

6. **Loading States**: Already implemented for duplicate and delete - ensure edit also has loading state.

---

## Estimated Effort

- **Phase 1**: 8-12 hours (edit functionality)
- **Phase 2**: 6-8 hours (dependency checks)
- **Phase 3**: 2-3 hours (toasts)
- **Phase 4**: 4-6 hours (service methods)
- **Total**: ~20-29 hours

---

## Questions to Resolve

1. Do edit modals for `nutrition_log`, `userMetric`, and `nutritionGoal` already exist?
2. Should we prevent deletion if dependencies exist, or just warn?
3. Should duplicate work for `userMetric` and `nutritionGoal`? (Currently disabled)
4. What fields should be editable for each model type?
