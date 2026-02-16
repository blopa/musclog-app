# Generic Edit Modal

A config-driven modal for editing database model records.

## Overview

The Generic Edit Modal provides a reusable way to edit any database model by:

1. Fetching the record from the database
2. Rendering a dynamic form based on field configuration
3. Saving changes through the service layer

## Architecture

- **GenericEditModal.tsx**: The UI component that renders the form
- **types.ts**: TypeScript types for field configurations and form values
- **entityEditConfig.ts**: Configuration for each entity type (fields, initial values, save handler)
- **useEditRecord.ts**: Hook for fetching records and handling saves

## Usage

### Basic Integration

```tsx
import { GenericEditModal } from './GenericEditModal';
import { useEditRecord } from './GenericEditModal/useEditRecord';
import { getEditFields } from './GenericEditModal/entityEditConfig';

function MyComponent() {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editRecordId, setEditRecordId] = useState<string | null>(null);

  const { initialValues, isLoading, error, save } = useEditRecord(
    'meal',
    editRecordId,
    editModalVisible
  );

  const fields = getEditFields('meal');

  return (
    <GenericEditModal
      visible={editModalVisible}
      onClose={() => setEditModalVisible(false)}
      title="Edit Meal"
      fields={fields}
      initialValues={initialValues}
      onSave={async (values) => {
        await save(values);
        // Optionally refresh data
      }}
      isLoading={isLoading}
      loadError={error ?? undefined}
    />
  );
}
```

## Adding Support for New Entity Types

To add support for a new entity type:

### 1. Add to `entityEditConfig.ts`

#### Define Fields

Add a case in `getEditFields()`:

```typescript
case 'myEntity':
  return [
    {
      type: 'text',
      key: 'name',
      label: 'myEntity.edit.name',
      required: true,
    },
    {
      type: 'number',
      key: 'value',
      label: 'myEntity.edit.value',
      min: 0,
      step: 1,
    },
  ];
```

#### Define Initial Values

Add a case in `getInitialValues()`:

```typescript
case 'myEntity':
  return {
    name: recordAny.name ?? '',
    value: recordAny.value ?? 0,
  };
```

#### Define Save Handler

Add a case in `saveRecord()`:

```typescript
case 'myEntity':
  await MyEntityService.update(recordId, {
    name: values.name as string | undefined,
    value: values.value as number | undefined,
  });
  break;
```

### 2. Add Table Mapping

Update `ENTITY_TABLE_MAP` in `useEditRecord.ts`:

```typescript
const ENTITY_TABLE_MAP: Record<DataLogModalVariant, string> = {
  // ... existing mappings
  myEntity: 'my_entities',
};
```

### 3. Enable in DataLogModal

Add the variant to `editSupportedVariants` in `DataLogModal.tsx`:

```typescript
const editSupportedVariants: DataLogModalVariant[] = [
  'meal',
  'exercise',
  // ... other variants
  'myEntity',
];
```

## Field Types

### Text

```typescript
{
  type: 'text',
  key: 'name',
  label: 'field.label',
  placeholder: 'field.placeholder', // optional
  multiline: true, // optional
  required: true, // optional
}
```

### Number

```typescript
{
  type: 'number',
  key: 'value',
  label: 'field.label',
  min: 0, // optional
  max: 100, // optional
  step: 0.5, // optional
  unit: 'kg', // optional
  required: true, // optional
}
```

### Boolean

```typescript
{
  type: 'boolean',
  key: 'isActive',
  label: 'field.label',
  subtitle: 'field.subtitle', // optional
}
```

### Select

```typescript
{
  type: 'select',
  key: 'category',
  label: 'field.label',
  options: [
    { value: 'option1', label: 'field.option1' },
    { value: 'option2', label: 'field.option2' },
  ],
  required: true, // optional
}
```

### Date (not yet fully implemented)

```typescript
{
  type: 'date',
  key: 'date',
  label: 'field.label',
  required: true, // optional
}
```

## Phase 1 Supported Entities

Currently supported (Phase 1):

- ✅ Meal (name, description)
- ✅ Exercise (name, description, muscleGroup, equipmentType, mechanicType, loadMultiplier)
- ✅ FoodPortion (name, gramWeight, icon)
- ✅ UserMetric (type, value, date)
- ✅ WorkoutTemplate (name, description, isArchived)

## Phase 2 Planned

Planned for Phase 2:

- Food (name, brand, calories, protein, carbs, fat, fiber)
- NutritionGoal (all nutrition goal fields)
- NutritionLog (amount, meal type, portion)
- WorkoutLog (workout name)
- Full date picker implementation

## Out of Scope

The generic modal is not suitable for:

- Complex nested data (e.g., meal foods, workout sets)
- JSON field editors (e.g., Food.micros)
- Multi-step wizards
- Custom validation logic beyond required/min/max

These should use dedicated modal components.
