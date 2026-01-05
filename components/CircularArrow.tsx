import { View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

export function CircularArrow() {
  return (
    <View className="h-8 w-8 items-center justify-center rounded-full bg-[#243d37]">
      <ChevronRight size={18} color="#9ca3af" />
    </View>
  );
}
