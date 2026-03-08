import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityRingsChart } from '../../components/charts/ActivityRingsChart';
import {
  AreaChart,
  AreaChartDatum,
  AreaChartSeriesConfig,
} from '../../components/charts/AreaChart';
import { BarChart, BarChartDataPoint } from '../../components/charts/BarChart';
import { BarLineChart, BarLineChartDatum } from '../../components/charts/BarLineChart';
import { CycleTrackingChart } from '../../components/charts/CycleTrackingChart';
import { LineChart, LineChartDataPoint } from '../../components/charts/LineChart';
import {
  MultipleLinesChart,
  MultipleLinesChartDatum,
  MultipleLinesChartSeriesConfig,
} from '../../components/charts/MultipleLinesChart';
import { SpiderChart } from '../../components/charts/SpiderChart';
import { StackedBarChart, StackedBarChartDatum } from '../../components/charts/StackedBarChart';
import {
  StackedBarLineChart,
  StackedBarLineChartDatum,
} from '../../components/charts/StackedBarLineChart';
import { TrainingConsistencyChart } from '../../components/charts/TrainingConsistencyChart';
import { Button } from '../../components/theme/Button';
import { MacrosPizzaChart } from '../../components/theme/MacrosPizzaChart';

export default function GraphsTestScreen() {
  // Sample data for LineChart
  const [lineChartData, setLineChartData] = useState<LineChartDataPoint[]>([
    { x: 0, y: 20 },
    { x: 50, y: 35 },
    { x: 100, y: 28 },
    { x: 150, y: 45 },
    { x: 200, y: 38 },
    { x: 250, y: 52 },
    { x: 300, y: 48 },
    { x: 350, y: 65 },
    { x: 400, y: 58 },
  ]);

  // Sample data for BarChart
  const [barChartData, setBarChartData] = useState<BarChartDataPoint[]>([
    { x: 1, y: 45 },
    { x: 2, y: 62 },
    { x: 3, y: 38 },
    { x: 4, y: 71 },
    { x: 5, y: 54 },
    { x: 6, y: 83 },
  ]);

  // Sample data for StackedBarChart (e.g. spending by category per day)
  const [stackedBarData, setStackedBarData] = useState<StackedBarChartDatum[]>([
    { x: 0, segments: [6, 4, 3, 6] },
    { x: 1, segments: [5, 5, 2, 7] },
    { x: 2, segments: [4, 3, 4, 3] },
    { x: 3, segments: [5, 4, 3, 4] },
    { x: 4, segments: [6, 5, 2, 6] },
    { x: 5, segments: [3, 2, 2, 4] },
    { x: 6, segments: [7, 5, 4, 6] },
  ]);

  // Sample data for AreaChart (Metabolic Flow: fat, carb & protein burn over time)
  const areaChartSeries: AreaChartSeriesConfig[] = [
    { key: 'protein', label: 'Protein', color: '#BF5AF2', value: '23%' },
    { key: 'fats', label: 'Fats', color: '#00E5FF', value: '35%' },
    { key: 'carbs', label: 'Carbs', color: '#00FFA2', value: '42%' },
  ];
  const [areaChartData, setAreaChartData] = useState<AreaChartDatum[]>([
    { x: 0, protein: 20, fats: 50, carbs: 70 },
    { x: 1, protein: 25, fats: 55, carbs: 65 },
    { x: 2, protein: 28, fats: 60, carbs: 55 },
    { x: 3, protein: 30, fats: 65, carbs: 90 },
    { x: 4, protein: 22, fats: 55, carbs: 75 },
  ]);

  // Sample data for MultipleLinesChart (Activity Comparison: Active vs Resting Energy)
  const multipleLinesSeries: MultipleLinesChartSeriesConfig[] = [
    { key: 'active', label: 'Active', color: '#00FFA2', value: '2,450 kcal' },
    { key: 'resting', label: 'Resting', color: '#00E5FF', value: '1,820 kcal', dashed: true },
  ];
  const [multipleLinesData, setMultipleLinesData] = useState<MultipleLinesChartDatum[]>([
    { x: 0, active: 65, resting: 50 },
    { x: 1, active: 45, resting: 55 },
    { x: 2, active: 55, resting: 60 },
    { x: 3, active: 82, resting: 40 },
    { x: 4, active: 45, resting: 40 },
    { x: 5, active: 55, resting: 50 },
    { x: 6, active: 40, resting: 48 },
  ]);

  // Sample data for BarLineChart (steps + heart rate)
  const [barLineChartData, setBarLineChartData] = useState<BarLineChartDatum[]>([
    { x: 0, steps: 6000, heartRate: 75 },
    { x: 1, steps: 8000, heartRate: 80 },
    { x: 2, steps: 5500, heartRate: 70 },
    { x: 3, steps: 10500, heartRate: 85 },
    { x: 4, steps: 7000, heartRate: 75 },
    { x: 5, steps: 9000, heartRate: 80 },
    { x: 6, steps: 6500, heartRate: 70 },
  ]);

  // Sample data for StackedBarLineChart (stacked bars + line, e.g. spending by category + heart rate)
  const [stackedBarLineChartData, setStackedBarLineChartData] = useState<
    StackedBarLineChartDatum[]
  >([
    { x: 0, segments: [4, 3, 2, 5], lineValue: 72 },
    { x: 1, segments: [5, 4, 3, 4], lineValue: 78 },
    { x: 2, segments: [3, 5, 2, 6], lineValue: 68 },
    { x: 3, segments: [6, 4, 4, 5], lineValue: 82 },
    { x: 4, segments: [4, 3, 3, 5], lineValue: 74 },
    { x: 5, segments: [5, 5, 2, 4], lineValue: 76 },
    { x: 6, segments: [4, 4, 4, 5], lineValue: 70 },
  ]);

  // Sample data for SpiderChart (Performance Profile values)
  const [spiderChartValues, setSpiderChartValues] = useState<number[]>([85, 72, 90, 45, 78]);

  // Sample data for TrainingConsistencyChart (12 weeks × 7 days, values 0–5)
  const [consistencyData, setConsistencyData] = useState<number[]>(
    () => Array.from({ length: 12 * 7 }, () => Math.floor(Math.random() * 6)) // 0–5
  );

  // Sample data for MacrosPizzaChart
  const [macrosData, setMacrosData] = useState({
    protein: 120,
    carbs: 180,
    fats: 65,
    fiber: 25,
  });

  // State for different chart configurations
  const [showGridLines, setShowGridLines] = useState(true);
  const [interactive, setInteractive] = useState(true);
  const [showLastPoint, setShowLastPoint] = useState(true);

  // Generate random data for line chart
  const generateRandomLineData = () => {
    const newData: LineChartDataPoint[] = [];
    for (let i = 0; i <= 8; i++) {
      newData.push({
        x: i * 50,
        y: Math.random() * 60 + 20,
      });
    }
    setLineChartData(newData);
  };

  // Generate random bar chart data
  const generateRandomBarData = () => {
    const newData: BarChartDataPoint[] = [];
    for (let i = 1; i <= 6; i++) {
      newData.push({
        x: i,
        y: Math.floor(Math.random() * 60) + 20,
      });
    }
    setBarChartData(newData);
  };

  // Generate random StackedBarChart data
  const generateRandomStackedBarData = () => {
    setStackedBarData(
      Array.from({ length: 7 }, (_, i) => ({
        x: i,
        segments: [
          Math.floor(Math.random() * 8) + 2,
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 5) + 1,
          Math.floor(Math.random() * 7) + 2,
        ] as [number, number, number, number],
      }))
    );
  };

  // Generate random BarLineChart data
  const generateRandomBarLineData = () => {
    setBarLineChartData(
      Array.from({ length: 7 }, (_, i) => ({
        x: i,
        steps: Math.floor(Math.random() * 8000) + 4000,
        heartRate: Math.floor(Math.random() * 50) + 65,
      }))
    );
  };

  // Generate random StackedBarLineChart data
  const generateRandomStackedBarLineData = () => {
    setStackedBarLineChartData(
      Array.from({ length: 7 }, (_, i) => ({
        x: i,
        segments: [
          Math.floor(Math.random() * 5) + 2,
          Math.floor(Math.random() * 4) + 1,
          Math.floor(Math.random() * 3) + 1,
          Math.floor(Math.random() * 5) + 2,
        ] as [number, number, number, number],
        lineValue: Math.floor(Math.random() * 40) + 60,
      }))
    );
  };

  // Generate random macros data
  const generateRandomMacros = () => {
    setMacrosData({
      protein: Math.floor(Math.random() * 150) + 50,
      carbs: Math.floor(Math.random() * 200) + 100,
      fats: Math.floor(Math.random() * 80) + 30,
      fiber: Math.floor(Math.random() * 40) + 10,
    });
  };

  const generateRandomAreaChartData = () => {
    setAreaChartData(
      Array.from({ length: 5 }, (_, i) => ({
        x: i,
        protein: Math.floor(Math.random() * 40) + 15,
        fats: Math.floor(Math.random() * 50) + 40,
        carbs: Math.floor(Math.random() * 50) + 45,
      }))
    );
  };

  // Generate random MultipleLinesChart data
  const generateRandomMultipleLinesData = () => {
    setMultipleLinesData(
      Array.from({ length: 7 }, (_, i) => ({
        x: i,
        active: Math.floor(Math.random() * 60) + 35,
        resting: Math.floor(Math.random() * 50) + 35,
      }))
    );
  };

  // Generate random SpiderChart values
  const generateRandomSpiderData = () => {
    setSpiderChartValues(Array.from({ length: 5 }, () => Math.floor(Math.random() * 50) + 40));
  };

  // Generate random TrainingConsistencyChart data
  const generateRandomConsistencyData = () => {
    setConsistencyData(Array.from({ length: 12 * 7 }, () => Math.floor(Math.random() * 6)));
  };

  // Randomize all charts
  const randomizeAllCharts = () => {
    generateRandomLineData();
    generateRandomBarData();
    generateRandomStackedBarData();
    generateRandomAreaChartData();
    generateRandomMultipleLinesData();
    generateRandomBarLineData();
    generateRandomMacros();
    generateRandomSpiderData();
    generateRandomConsistencyData();
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-6">
          {/* Header */}
          <View className="mb-8">
            <Text className="mb-2 text-3xl font-bold text-text-primary">Graphs Test</Text>
            <Text className="mb-4 text-base text-text-secondary">
              Test various graph components in the app
            </Text>
            <Button
              label="Randomize all charts"
              variant="outline"
              size="sm"
              onPress={randomizeAllCharts}
            />
          </View>

          {/* Bar + Line Chart Section */}
          <View className="mb-8">
            <Text className="mb-2 text-lg font-bold text-text-primary">Bar + Line Chart</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Combined chart with dual Y-axes: steps (bars) and heart rate (line). Touch or hover to
              see tooltips.
            </Text>

            <View className="mb-4 flex-row gap-2">
              <Button
                label="Random Data"
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={generateRandomBarLineData}
              />
            </View>

            <View className="mb-4 rounded-lg border border-border-default bg-bg-card p-4">
              <BarLineChart
                title="Comprehensive Daily Metrics"
                subtitle="Steps Taken vs. Heart Rate"
                data={barLineChartData}
                height={260}
                stepsDomain={[0, 12000]}
                heartRateDomain={[60, 140]}
                leftAxisLabels={['0', '6k', '12k']}
                rightAxisLabels={['60', '100', '140']}
                xAxisLabels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
                barSeriesLabel="Steps Taken"
                lineSeriesLabel="Avg Heart Rate"
                stepsFormatter={(v) => v.toLocaleString()}
                heartRateFormatter={(v) => `${Math.round(v)} bpm`}
                interactive={true}
              />
            </View>
          </View>

          {/* Stacked Bar + Line Chart Section */}
          <View className="mb-8">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Stacked Bar + Line Chart
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Stacked bars (e.g. spending by category) with a line overlay (e.g. heart rate).
            </Text>
            <View className="mb-4 flex-row gap-2">
              <Button
                label="Random Data"
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={generateRandomStackedBarLineData}
              />
            </View>
            <View className="mb-4 rounded-lg border border-border-default bg-bg-card p-4">
              <StackedBarLineChart
                title="Daily Breakdown + Heart Rate"
                subtitle="Stacked total vs. Avg Heart Rate"
                data={stackedBarLineChartData}
                height={260}
                stackedDomain={[0, 25]}
                lineDomain={[60, 100]}
                stackColors={['#3b82f6', '#ef4444', '#eab308', '#22c55e']}
                leftAxisLabels={['0', '10', '20', '25']}
                rightAxisLabels={['60', '80', '100']}
                xAxisLabels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
                barSeriesLabel="Total"
                lineSeriesLabel="Avg Heart Rate"
                totalFormatter={(t) => String(Math.round(t))}
                lineFormatter={(v) => `${Math.round(v)} bpm`}
                interactive={true}
              />
            </View>
          </View>

          {/* Health Overview - Dashboard charts */}
          <View className="mb-10">
            <Text className="mb-2 text-3xl font-bold tracking-tight text-text-primary">
              Health Overview
            </Text>
            <Text className="mb-6 text-base text-text-secondary">
              Daily progress and hormonal cycle tracking.
            </Text>

            <View className="flex-row flex-wrap gap-6">
              <View
                className="flex-1 rounded-[2.5rem] border border-border-default bg-bg-card p-6 shadow-lg"
                style={{ minWidth: 280, maxWidth: 400 }}
              >
                <ActivityRingsChart
                  title="Daily Goals"
                  subtitle="Activity Rings"
                  rings={[
                    { progress: 0.8, color: '#00FFA2', label: 'Move', value: '80%' },
                    { progress: 0.65, color: '#00E5FF', label: 'Steps', value: '65%' },
                    { progress: 0.45, color: '#BF5AF2', label: 'Rest', value: '45%' },
                  ]}
                  centerValue="82"
                  centerLabel="Score"
                  size={224}
                />
              </View>
            </View>

            <View className="mt-6 rounded-[2.5rem] border border-border-default bg-bg-card p-6 shadow-lg">
              <CycleTrackingChart
                title="Cycle Tracking"
                phaseLabel="Follicular Phase • Day 12"
                badge={{ title: 'Conception Chance', value: 'Peak Window' }}
                segments={[
                  { width: 0.2, color: '#BF5AF2', label: 'Menstrual', opacity: 0.6 },
                  { width: 0.3, color: '#00FFA2', label: 'Follicular', opacity: 0.4 },
                  { width: 0.15, color: '#FF9F21', label: 'Ovulatory', opacity: 0.7 },
                  { width: 0.35, color: '#00E5FF', label: 'Luteal', opacity: 0.4 },
                ]}
                todayPosition={0.42}
              />
            </View>
          </View>

          {/* Line Chart Section */}
          <View className="mb-8">
            <Text className="mb-2 text-lg font-bold text-text-primary">Line Chart</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Interactive line chart with touch support and tooltips.
            </Text>

            {/* Line Chart Controls */}
            <View className="mb-4 flex-row gap-2">
              <Button
                label="Random Data"
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={generateRandomLineData}
              />
              <Button
                label={showGridLines ? 'Hide Grid' : 'Show Grid'}
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={() => setShowGridLines(!showGridLines)}
              />
            </View>

            <View className="mb-4 flex-row gap-2">
              <Button
                label={interactive ? 'Disable Touch' : 'Enable Touch'}
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={() => setInteractive(!interactive)}
              />
              <Button
                label={showLastPoint ? 'Hide Point' : 'Show Point'}
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={() => setShowLastPoint(!showLastPoint)}
              />
            </View>

            {/* Line Chart */}
            <View className="mb-4 rounded-lg border border-border-default bg-bg-card p-4">
              <LineChart
                data={lineChartData}
                height={200}
                chartWidth={400}
                chartHeight={100}
                showGridLines={showGridLines}
                interactive={interactive}
                showLastPoint={showLastPoint}
                xAxisLabels={['0', '2', '4', '6', '8']}
                yAxisLabels={[
                  { label: '100', yDomainValue: 100 },
                  { label: '50', yDomainValue: 50 },
                  { label: '0', yDomainValue: 0 },
                ]}
                tooltipFormatter={(point) => `${Math.round(point.y)}g`}
              />
            </View>
          </View>

          {/* Bar Chart Section */}
          <View className="mb-8">
            <Text className="mb-2 text-lg font-bold text-text-primary">Bar Chart</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Vertical bar chart with theme styling and optional X-axis labels.
            </Text>

            <View className="mb-4 flex-row gap-2">
              <Button
                label="Random Data"
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={generateRandomBarData}
              />
            </View>

            <View className="mb-4 rounded-lg border border-border-default bg-bg-card p-4">
              <BarChart
                data={barChartData}
                height={200}
                showGridLines={showGridLines}
                xAxisLabels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']}
                yDomain={[0, 100]}
                yAxisLabels={[
                  { label: '100', yDomainValue: 100 },
                  { label: '75', yDomainValue: 75 },
                  { label: '50', yDomainValue: 50 },
                  { label: '25', yDomainValue: 25 },
                  { label: '0', yDomainValue: 0 },
                ]}
                tooltipFormatter={(point) => `${Math.round(point.y)}`}
              />
            </View>
          </View>

          {/* Stacked Bar Chart Section */}
          <View className="mb-8">
            <Text className="mb-2 text-lg font-bold text-text-primary">Stacked Bar Chart</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Each bar has up to 4 colored segments (e.g. spending by category per day).
            </Text>
            <View className="mb-4 flex-row gap-2">
              <Button
                label="Random Data"
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={generateRandomStackedBarData}
              />
            </View>
            <View className="mb-4 rounded-lg border border-border-default bg-bg-card p-4">
              <StackedBarChart
                data={stackedBarData}
                height={200}
                yDomain={[0, 25]}
                stackColors={['#3b82f6', '#ef4444', '#eab308', '#22c55e']}
                xAxisLabels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
                yAxisLabels={[
                  { label: '25', yDomainValue: 25 },
                  { label: '20', yDomainValue: 20 },
                  { label: '15', yDomainValue: 15 },
                  { label: '10', yDomainValue: 10 },
                  { label: '5', yDomainValue: 5 },
                  { label: '0', yDomainValue: 0 },
                ]}
              />
            </View>
          </View>

          {/* Area Chart Section (Metabolic Flow style) */}
          <View className="mb-8">
            <Text className="mb-2 text-lg font-bold text-text-primary">Area Chart</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Multiple overlapping area series with optional peak marker and legend (e.g. Metabolic
              Flow).
            </Text>
            <View className="mb-4 flex-row gap-2">
              <Button
                label="Random Data"
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={generateRandomAreaChartData}
              />
            </View>
            <View className="mb-4 rounded-lg border border-border-default bg-bg-card p-4">
              <AreaChart
                title="Metabolic Flow"
                subtitle="Fat, Carb & Protein Burn"
                data={areaChartData}
                series={areaChartSeries}
                height={280}
                yDomain={[0, 100]}
                xAxisLabels={['08:00', '12:00', '16:00', '20:00', '00:00']}
                yAxisLabels={[
                  { label: '100', yDomainValue: 100 },
                  { label: '75', yDomainValue: 75 },
                  { label: '50', yDomainValue: 50 },
                  { label: '25', yDomainValue: 25 },
                  { label: '0', yDomainValue: 0 },
                ]}
                peak={{ seriesKey: 'carbs', pointIndex: 3, label: 'Peak' }}
              />
            </View>
          </View>

          {/* Multiple Lines Chart Section (Activity Comparison) */}
          <View className="mb-8">
            <Text className="mb-2 text-lg font-bold text-text-primary">Multiple Lines Chart</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Up to 4 lines with optional callout labels and legend (e.g. Active vs. Resting
              Energy).
            </Text>
            <View className="mb-4 rounded-lg border border-border-default bg-bg-card p-4">
              <MultipleLinesChart
                title="Activity Comparison"
                subtitle="Active vs. Resting Energy"
                data={multipleLinesData}
                series={multipleLinesSeries}
                height={200}
                yDomain={[0, 100]}
                xAxisLabels={['M', 'T', 'W', 'T', 'F', 'S', 'S']}
                yAxisLabels={[
                  { label: '100%', yDomainValue: 100 },
                  { label: '75%', yDomainValue: 75 },
                  { label: '50%', yDomainValue: 50 },
                  { label: '25%', yDomainValue: 25 },
                  { label: '0%', yDomainValue: 0 },
                ]}
                callouts={[
                  { seriesKey: 'active', pointIndex: 3, label: '82%' },
                  { seriesKey: 'active', pointIndex: 0, label: '65%' },
                ]}
              />
            </View>
          </View>

          {/* Training Consistency Chart Section */}
          <View className="mb-8">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Training Consistency Chart
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Grid of intensity cells (e.g. last 12 weeks) with goal percentage.
            </Text>
            <View className="mb-4 flex-row gap-2">
              <Button
                label="Random Data"
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={generateRandomConsistencyData}
              />
            </View>
            <View className="rounded-lg border border-border-default bg-bg-card p-6">
              <TrainingConsistencyChart
                title="Training Consistency"
                subtitle="Last 12 Weeks"
                percentage={
                  consistencyData.length > 0
                    ? Math.round(
                        (consistencyData.reduce((a, b) => a + b, 0) /
                          (5 * consistencyData.length)) *
                          100
                      )
                    : 0
                }
                percentageLabel="GOAL REACHED"
                data={consistencyData}
                rowsPerColumn={7}
                columns={12}
                gridHeight={128}
                accentColor="#00FFA2"
              />
            </View>
          </View>

          {/* Spider Chart Section (Performance Profile) */}
          <View className="mb-8">
            <Text className="mb-2 text-lg font-bold text-text-primary">Spider Chart</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Radar chart for multi-axis comparison (e.g. Performance Profile).
            </Text>
            <View className="rounded-lg border border-border-default bg-bg-card p-6">
              <SpiderChart
                title="Performance Profile"
                subtitle="Weekly Analysis"
                axes={['Strength', 'Stamina', 'Recovery', 'Flexibility', 'Speed']}
                values={spiderChartValues}
                centerScore={88}
                centerScoreLabel="PTS"
                primaryFocus="Power Output"
                areaToImprove="Flexibility"
                dataColor="#00FFA2"
                size={280}
              />
            </View>
          </View>

          {/* Macros Pizza Chart Section */}
          <View className="mb-8">
            <Text className="mb-2 text-lg font-bold text-text-primary">Macros Pizza Chart</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Pie chart showing macronutrient distribution.
            </Text>

            {/* Pizza Chart Controls */}
            <View className="mb-4 flex-row gap-2">
              <Button
                label="Random Macros"
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={generateRandomMacros}
              />
            </View>

            {/* Pizza Chart */}
            <View className="mb-4 items-center rounded-lg border border-border-default bg-bg-card p-4">
              <MacrosPizzaChart
                protein={macrosData.protein}
                carbs={macrosData.carbs}
                fats={macrosData.fats}
                fiber={macrosData.fiber}
                size={120}
                showInsight={true}
              />
            </View>

            {/* Macros Values Display */}
            <View className="rounded-lg border border-border-default bg-bg-card p-4">
              <Text className="mb-2 text-sm font-semibold text-text-primary">Current Values:</Text>
              <View className="space-y-1">
                <Text className="text-sm text-text-secondary">Protein: {macrosData.protein}g</Text>
                <Text className="text-sm text-text-secondary">Carbs: {macrosData.carbs}g</Text>
                <Text className="text-sm text-text-secondary">Fats: {macrosData.fats}g</Text>
                <Text className="text-sm text-text-secondary">Fiber: {macrosData.fiber}g</Text>
              </View>
            </View>
          </View>

          {/* Multiple Charts Section */}
          <View className="mb-8">
            <Text className="mb-2 text-lg font-bold text-text-primary">Multiple Charts</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Display multiple charts together.
            </Text>

            <View className="space-y-4">
              {/* Small Line Chart */}
              <View className="rounded-lg border border-border-default bg-bg-card p-4">
                <Text className="mb-2 text-sm font-semibold text-text-primary">
                  Weight Progress
                </Text>
                <LineChart
                  data={[
                    { x: 0, y: 180 },
                    { x: 100, y: 178 },
                    { x: 200, y: 175 },
                    { x: 300, y: 173 },
                    { x: 400, y: 170 },
                  ]}
                  height={120}
                  chartWidth={400}
                  chartHeight={20}
                  showGridLines={false}
                  showLastPoint={true}
                  lineWidth={2}
                  tooltipFormatter={(point) => `${Math.round(point.y)} lbs`}
                />
              </View>

              {/* Small Pizza Chart */}
              <View className="rounded-lg border border-border-default bg-bg-card p-4">
                <Text className="mb-2 text-sm font-semibold text-text-primary">Todays Macros</Text>
                <View className="items-center">
                  <MacrosPizzaChart
                    protein={85}
                    carbs={120}
                    fats={45}
                    size={80}
                    showInsight={false}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Chart Variants Section */}
          <View className="mb-8">
            <Text className="mb-2 text-lg font-bold text-text-primary">Chart Variants</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Different styling and configuration options.
            </Text>

            <View className="space-y-4">
              {/* Line Chart with different interpolation */}
              <View className="rounded-lg border border-border-default bg-bg-card p-4">
                <Text className="mb-2 text-sm font-semibold text-text-primary">Step Chart</Text>
                <LineChart
                  data={[
                    { x: 0, y: 30 },
                    { x: 100, y: 45 },
                    { x: 200, y: 38 },
                    { x: 300, y: 55 },
                    { x: 400, y: 42 },
                  ]}
                  height={120}
                  interpolation="step"
                  lineWidth={2}
                  showLastPoint={false}
                />
              </View>

              {/* Pizza Chart without fiber */}
              <View className="rounded-lg border border-border-default bg-bg-card p-4">
                <Text className="mb-2 text-sm font-semibold text-text-primary">
                  Basic Macros (No Fiber)
                </Text>
                <View className="items-center">
                  <MacrosPizzaChart
                    protein={100}
                    carbs={150}
                    fats={50}
                    fiber={0}
                    size={80}
                    showInsight={true}
                    insightMessage={{
                      title: 'Balance',
                      subtitle: 'Good Mix',
                    }}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
