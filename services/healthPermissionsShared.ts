/**
 * Shared health permission descriptors (Android record types + iOS mapping uses same labels).
 */
export type HealthPermissionDescriptor = {
  accessType: 'read' | 'write';
  recordType: string;
};

export const REQUIRED_HEALTH_PERMISSIONS: readonly HealthPermissionDescriptor[] = [
  { accessType: 'read', recordType: 'Height' },
  { accessType: 'write', recordType: 'Height' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'write', recordType: 'Weight' },
  { accessType: 'read', recordType: 'BodyFat' },
  { accessType: 'write', recordType: 'BodyFat' },
  { accessType: 'read', recordType: 'Nutrition' },
  { accessType: 'write', recordType: 'Nutrition' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'BasalMetabolicRate' },
  { accessType: 'write', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'LeanBodyMass' },
  { accessType: 'write', recordType: 'LeanBodyMass' },
];
