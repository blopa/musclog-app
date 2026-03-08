import { AreaChart, AreaChartDatum, AreaChartSeriesConfig } from './AreaChart';

export type MetabolicFlowChartProps = {
  /** Data points with x, protein, carbohydrates (or use default sample) */
  data?: AreaChartDatum[];
  /** Height of the chart (default: 280) */
  height?: number;
  /** Override title (default: 'Metabolic Flow') */
  title?: string;
  /** Override subtitle (default: 'Burn Composition') */
  subtitle?: string;
  className?: string;
};

const DEFAULT_SERIES: AreaChartSeriesConfig[] = [
  { key: 'protein', label: 'Protein', color: '#BF5AF2' },
  { key: 'carbohydrates', label: 'Carbohydrates', color: '#00FFA2' },
];

const DEFAULT_DATA: AreaChartDatum[] = [
  { x: 0, protein: 60, carbohydrates: 40 },
  { x: 125, protein: 70, carbohydrates: 50 },
  { x: 250, protein: 50, carbohydrates: 85 },
  { x: 375, protein: 65, carbohydrates: 70 },
  { x: 500, protein: 55, carbohydrates: 55 },
];

export function MetabolicFlowChart({
  data = DEFAULT_DATA,
  height = 280,
  title = 'Metabolic Flow',
  subtitle = 'Burn Composition',
  className,
}: MetabolicFlowChartProps) {
  return (
    <AreaChart
      className={className}
      title={title}
      subtitle={subtitle}
      data={data}
      series={DEFAULT_SERIES}
      height={height}
      xDomain={[0, 500]}
      yDomain={[0, 100]}
      xAxisLabels={['0', '100', '200', '300', '400', '500']}
      showGridLines={false}
      marginTop={0}
      marginBottom={8}
    />
  );
}
