import { View, Text } from 'react-native';

type MacroCardProps = {
  name: string;
  percentage: number;
  amount: string;
  color: string;
  progressColor: string;
};

export function MacroCard({ name, percentage, amount, color, progressColor }: MacroCardProps) {
  return (
    <View className="rounded-2xl border border-gray-800/50 bg-[#1a2520] p-4">
      <View className="mb-1 flex-row items-baseline gap-1">
        <Text className="text-sm text-gray-400">{name}</Text>
        <Text className={`text-sm font-semibold ${color}`}>{percentage}%</Text>
      </View>
      <Text className="mb-3 text-3xl font-bold text-white">{amount}</Text>
      <View className="h-1.5 overflow-hidden rounded-full bg-gray-800/50">
        <View
          className={`h-full rounded-full ${progressColor}`}
          style={{ width: `${percentage}%` }}
        />
      </View>
    </View>
  );
}
