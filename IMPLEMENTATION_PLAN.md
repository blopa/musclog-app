# Implementation Plan: Create Workouts from Template JSON

## Overview

When a user selects a template from `BrowseTemplatesModal`, we need to:

1. Show a confirmation modal asking if they want to create workouts based on the template
2. If confirmed, parse the template JSON and create multiple workout templates (one per day)
3. Each workout template should contain the exercises, sets, reps, and weight (hardcoded to 50 kg) from the template

## Key Understanding

### Template JSON Structure

- Templates are stored in `data/workoutTemplatesEnUS.json`
- Each template has:
  - `title`: Template name
  - `difficulty`: Beginner/Intermediate/Advanced
  - `duration`: Number (minutes)
  - `exercises`: Array of exercise objects with:
    - `exerciseId`: Numeric ID (needs to be converted to string for database lookup)
    - `day`: Day number (1, 2, 3, etc.) - groups exercises into separate workouts
    - `sets`: Number of sets
    - `reps`: Number of reps per set
  - `icon`: Material icon name

### Database Schema

- **workout_templates**: Stores workout template metadata (name, description)
- **workout_template_sets**: Stores individual sets with:
  - `template_id`: Links to workout_templates
  - `exercise_id`: String ID (must convert from numeric JSON ID)
  - `target_reps`: Number of reps
  - `target_weight`: Weight in kg (hardcoded to 50)
  - `set_order`: Sequential order across all sets
  - `rest_time_after`: Optional rest time

### Example

The first template "5-Day Hypertrophy Split" has:

- Day 1: 3 exercises (exerciseId: 1, 2, 6)
- Day 2: 4 exercises (exerciseId: 5, 11, 13, 26)
- Day 3: 4 exercises (exerciseId: 4, 17, 30, 49)
- Day 4: 6 exercises (exerciseId: 9, 10, 16, 7, 35, 19)
- Day 5: 4 exercises (exerciseId: 14, 20, 15, 22)

This should create **5 separate workout templates** in the database.

## Implementation Steps

### Step 1: Create Service Function

**File**: `database/services/WorkoutTemplateService.ts`

Add a new static method:

```typescript
static async createWorkoutsFromJsonTemplate(
  templateIndex: number,
  templateData: RawWorkoutTemplate
): Promise<WorkoutTemplate[]>
```

**Logic**:

1. Parse `templateData.exercises` array
2. Group exercises by `day` field
3. For each day:
   - Create a new `WorkoutTemplate` with name: `"{templateData.title} - Day {day}"`
   - For each exercise in that day:
     - Verify exercise exists in database (using `exerciseId.toString()`)
     - Create `WorkoutTemplateSet` entries for each set (e.g., if `sets: 3`, create 3 entries)
     - Set `target_weight` to 50 kg
     - Set `target_reps` from exercise data
     - Calculate `set_order` sequentially
4. Return array of created templates

**Error Handling**:

- If exerciseId doesn't exist in database, log warning and skip that exercise
- Wrap in database transaction for atomicity

### Step 2: Add Confirmation Modal State

**File**: `app/workout/workouts.tsx`

Add state variables:

```typescript
const [isCreateFromTemplateVisible, setIsCreateFromTemplateVisible] = useState(false);
const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number | null>(null);
const [selectedTemplateData, setSelectedTemplateData] = useState<RawWorkoutTemplate | null>(null);
```

### Step 3: Update BrowseTemplatesModal Handler

**File**: `app/workout/workouts.tsx`

In the `onTemplateSelect` handler:

1. Find the template index in the JSON array
2. Get the raw template data from `workoutTemplatesEnUS`
3. Set state variables and show confirmation modal
4. Don't close `BrowseTemplatesModal` yet (close it after confirmation)

### Step 4: Create Confirmation Modal

**File**: `app/workout/workouts.tsx`

Add `ConfirmationModal` component:

- Title: "Create Workouts from Template"
- Message: "This will create {N} workout templates based on '{templateName}'. Continue?"
- Show count of days/workouts that will be created
- On confirm: Call service function, show loading state, handle success/error
- On cancel: Just close modal

### Step 5: Add Translation Keys

**File**: `lang/locales/en-us.json`

Add under `workouts` section:

```json
"createFromTemplate": {
  "title": "Create Workouts from Template",
  "message": "This will create {{count}} workout template(s) based on '{{templateName}}'. Continue?",
  "confirm": "Create Workouts",
  "cancel": "Cancel",
  "success": "Successfully created {{count}} workout template(s)",
  "error": "Failed to create workout templates"
}
```

### Step 6: Handle Success/Error

**File**: `app/workout/workouts.tsx`

After successful creation:

- Close both modals
- Optionally show success toast/notification
- The reactive hook `useWorkoutTemplates` should automatically refresh the list

On error:

- Show error message
- Keep modals open so user can retry

## Technical Considerations

### Exercise ID Conversion

- JSON uses numeric `exerciseId` (e.g., `1`, `2`, `26`)
- Database uses string IDs
- Convert: `exerciseId.toString()` when querying database
- Verify exercise exists before creating sets

### Set Order Calculation

- `set_order` should be sequential across all sets in a template
- Example for Day 1 with 3 exercises, 3 sets each:
  - Exercise 1: sets 1, 2, 3 (orders 1, 2, 3)
  - Exercise 2: sets 1, 2, 3 (orders 4, 5, 6)
  - Exercise 3: sets 1, 2, 3 (orders 7, 8, 9)

### Weight Handling

- Hardcode to 50 kg as specified
- For bodyweight exercises, weight should be 0 (but user said hardcode to 50, so follow that)
- Actually, check if exercise is bodyweight and set to 0 if so (more logical)

### Template Naming

- Format: `"{originalTitle} - Day {dayNumber}"`
- Example: "5-Day Hypertrophy Split - Day 1"

### Transaction Safety

- Wrap entire operation in `database.write()` transaction
- If any day fails, rollback all changes
- Or: Create days individually, but log which ones succeeded

## Questions for User

1. **Weight for bodyweight exercises**: Should bodyweight exercises have weight 0 or 50 kg? (I recommend 0)
2. **Error handling**: If one day fails to create, should we:
   - Rollback all days (atomic transaction)?
   - Or create successful days and skip failed ones?
3. **Duplicate prevention**: Should we check if templates with the same name already exist and prevent duplicates?
4. **Rest time**: Should we set a default rest time (e.g., 60 seconds) for all sets?

## Files to Modify

1. `database/services/WorkoutTemplateService.ts` - Add `createWorkoutsFromJsonTemplate` method
2. `app/workout/workouts.tsx` - Add confirmation modal and handler logic
3. `lang/locales/en-us.json` - Add translation keys
4. `components/modals/BrowseTemplatesModal.tsx` - May need to expose raw template data

## Testing Checklist

- [ ] Select template with single day → creates 1 workout template
- [ ] Select template with multiple days → creates N workout templates
- [ ] Verify exercise IDs are correctly converted and found in database
- [ ] Verify sets are created with correct reps and weight
- [ ] Verify set_order is sequential
- [ ] Test error handling (invalid exerciseId, database error)
- [ ] Test cancellation flow
- [ ] Verify templates appear in workout list after creation
- [ ] Test with template that has many exercises per day
