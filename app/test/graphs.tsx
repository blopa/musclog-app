import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarChart, BarChartDataPoint } from '../../components/BarChart';
import { LineChart, LineChartDataPoint } from '../../components/LineChart';
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

  // Generate random macros data
  const generateRandomMacros = () => {
    setMacrosData({
      protein: Math.floor(Math.random() * 150) + 50,
      carbs: Math.floor(Math.random() * 200) + 100,
      fats: Math.floor(Math.random() * 80) + 30,
      fiber: Math.floor(Math.random() * 40) + 10,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-6">
          {/* Header */}
          <View className="mb-8">
            <Text className="mb-2 text-3xl font-bold text-text-primary">Graphs Test</Text>
            <Text className="text-base text-text-secondary">
              Test various graph components in the app
            </Text>
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
            <View className="mb-4 rounded-lg bg-bg-card p-4">
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

            <View className="mb-4 rounded-lg bg-bg-card p-4">
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
            <View className="mb-4 items-center rounded-lg bg-bg-card p-4">
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
            <View className="rounded-lg bg-bg-card p-4">
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
              <View className="rounded-lg bg-bg-card p-4">
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
              <View className="rounded-lg bg-bg-card p-4">
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
              <View className="rounded-lg bg-bg-card p-4">
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
              <View className="rounded-lg bg-bg-card p-4">
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
