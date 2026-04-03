import { useCallback, useEffect, useState } from 'react';

import { database } from '../../../database';
import UserMetric from '../../../database/models/UserMetric';
import { useSettings } from '../../../hooks/useSettings';
import {
  isLengthMetricType,
  isWeightMetricType,
  kgToDisplay,
  metricValueToDisplay,
  storedHeightToCm,
  storedWeightToKg,
} from '../../../utils/unitConversion';
import type { DataLogModalVariant } from '../DataLogModal';
import { getInitialValues, saveRecord } from './entityEditConfig';
import type { EditFormValues } from './types';

type UseEditRecordResult = {
  initialValues: EditFormValues;
  isLoading: boolean;
  error: string | null;
  save: (values: EditFormValues) => Promise<void>;
};

// Map entity type to table name
const ENTITY_TABLE_MAP: Record<DataLogModalVariant, string> = {
  meal: 'meals',
  nutrition_log: 'nutrition_logs',
  food: 'foods',
  foodPortion: 'food_portions',
  exercise: 'exercises',
  workoutLog: 'workout_logs',
  workoutTemplate: 'workout_templates',
  userMetric: 'user_metrics',
  nutritionGoal: 'nutrition_goals',
  nutritionCheckin: 'nutrition_checkins',
  chatMessage: 'chat_messages',
};

export function useEditRecord(
  entityType: DataLogModalVariant | null,
  recordId: string | null,
  visible: boolean
): UseEditRecordResult {
  const { units } = useSettings();
  const [initialValues, setInitialValues] = useState<EditFormValues>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !entityType || !recordId) {
      setInitialValues({});
      setError(null);
      return;
    }

    const fetchRecord = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const tableName = ENTITY_TABLE_MAP[entityType];
        if (!tableName) {
          throw new Error(`Unknown entity type: ${entityType}`);
        }

        const record = await database.get(tableName).find(recordId);

        if (!record || (record as any).deletedAt) {
          throw new Error('Record not found or deleted');
        }

        let values = await getInitialValues(entityType, record);

        if (entityType === 'userMetric') {
          const type = values.type as string;
          if (isWeightMetricType(type) || isLengthMetricType(type)) {
            const decrypted = await (record as UserMetric).getDecrypted();
            const rawValue = (values.value as number) ?? 0;
            // Normalize legacy stored units to metric, then convert to display
            const normalizedValue = isWeightMetricType(type)
              ? storedWeightToKg(rawValue, decrypted.unit)
              : storedHeightToCm(rawValue, decrypted.unit);
            values = { ...values, value: metricValueToDisplay(normalizedValue, type, units) };
          }
        }

        if (entityType === 'nutritionGoal' && values.targetWeight != null) {
          values = {
            ...values,
            targetWeight: kgToDisplay(values.targetWeight as number, units),
          };
        }

        if (entityType === 'nutritionCheckin' && values.targetWeight != null) {
          values = {
            ...values,
            targetWeight: kgToDisplay(values.targetWeight as number, units),
          };
        }

        setInitialValues(values);
      } catch (err) {
        console.error('Error fetching record for edit:', err);
        setError(err instanceof Error ? err.message : 'Failed to load record');
        setInitialValues({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecord();
  }, [entityType, recordId, visible, units]);

  const save = useCallback(
    async (values: EditFormValues) => {
      if (!entityType || !recordId) {
        throw new Error('Cannot save: missing entity type or record ID');
      }

      await saveRecord(entityType, recordId, values, { units });
    },
    [entityType, recordId, units]
  );

  return {
    initialValues,
    isLoading,
    error,
    save,
  };
}
