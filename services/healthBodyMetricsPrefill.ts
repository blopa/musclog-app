export interface HealthBodyMetrics {
  weightKg?: number;
  heightCm?: number;
  bodyFatPct?: number;
}

export async function fetchHealthBodyMetrics(): Promise<HealthBodyMetrics> {
  return {};
}
