import { View, Pressable, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Home, Dumbbell, BarChart3, Calendar, User } from 'lucide-react-native';
import { ReactNode } from 'react';

type MasterLayoutProps = {
  children: ReactNode;
};

export function MasterLayout({ children }: MasterLayoutProps) {
  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-[#0a1f1a]" edges={['top']}>
        <StatusBar style="light" />
        {children}

        {/* Bottom Navigation */}
        <View className="absolute bottom-0 left-0 right-0 border-t border-[#1a2f2a] bg-[#0f251f]">
          <SafeAreaView edges={['bottom']}>
            <View className="flex-row items-center justify-around px-6 py-4">
              <Pressable className="items-center gap-1">
                <Home size={24} color="#22c55e" strokeWidth={2.5} />
                <Text className="text-xs font-medium text-[#22c55e]">Home</Text>
              </Pressable>

              <Pressable className="items-center gap-1">
                <Dumbbell size={24} color="#4b5563" strokeWidth={2} />
                <Text className="text-xs text-gray-600">Workouts</Text>
              </Pressable>

              <Pressable className="items-center gap-1">
                <BarChart3 size={24} color="#4b5563" strokeWidth={2} />
                <Text className="text-xs text-gray-600">Progress</Text>
              </Pressable>

              <Pressable className="items-center gap-1">
                <Calendar size={24} color="#4b5563" strokeWidth={2} />
                <Text className="text-xs text-gray-600">Schedule</Text>
              </Pressable>

              <Pressable className="items-center gap-1">
                <User size={24} color="#4b5563" strokeWidth={2} />
                <Text className="text-xs text-gray-600">Profile</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
