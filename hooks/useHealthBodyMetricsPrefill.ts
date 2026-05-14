import { UserMetricService } from '@/database/services';
import { fetchHealthBodyMetrics } from '@/services/healthBodyMetricsPrefill';
import { roundToDecimalPlaces } from '@/utils/roundDecimal';
import { cmToDisplay, kgToDisplay } from '@/utils/unitConversion';

export interface HealthPrefillResult {
  weight: string;
  height: string;
  bodyFat: number | null;
}

/**
 * Fetches the latest body metrics from the local DB (post-sync) or directly
 * from Health Connect / HealthKit, then converts to display units.
 *
 * Call this AFTER resolving the user's unit preference from AsyncStorage so
 * the conversion uses the correct unit system from the start.
 */
export async function getHealthBodyMetricsPrefill(
  units: 'metric' | 'imperial'
): Promise<HealthPrefillResult> {
  try {
    const [weightMetric, heightMetric, bodyFatMetric] = await Promise.all([
      UserMetricService.getLatest('weight'),
      UserMetricService.getLatest('height'),
      UserMetricService.getLatest('body_fat'),
    ]);

    let weightKg: number | undefined;
    let heightCm: number | undefined;
    let bodyFatPct: number | undefined;

    if (weightMetric) {
      weightKg = (await weightMetric.getDecrypted()).value;
    }

    if (heightMetric) {
      heightCm = (await heightMetric.getDecrypted()).value;
    }

    if (bodyFatMetric) {
      bodyFatPct = (await bodyFatMetric.getDecrypted()).value;
    }

    if (!weightMetric && !heightMetric && !bodyFatMetric) {
      const hc = await fetchHealthBodyMetrics();
      weightKg = hc.weightKg;
      heightCm = hc.heightCm;
      bodyFatPct = hc.bodyFatPct;
    }

    return {
      weight: weightKg != null ? String(roundToDecimalPlaces(kgToDisplay(weightKg, units), 1)) : '',
      height: heightCm != null ? String(roundToDecimalPlaces(cmToDisplay(heightCm, units), 1)) : '',
      bodyFat: bodyFatPct != null ? roundToDecimalPlaces(bodyFatPct, 1) : null,
    };
  } catch {
    return { weight: '', height: '', bodyFat: null };
  }
}
