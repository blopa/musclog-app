import { View, Text, Image, Pressable, ScrollView } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell,
  Dumbbell,
  UtensilsCrossed,
  Home,
  Calendar,
  BarChart3,
  User,
  ChevronRight,
  Flame,
} from 'lucide-react-native';

import './global.css';

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-[#0a1f1a]" edges={['top']}>
      <StatusBar style="light" />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-6">
          <View className="flex-row items-center gap-3">
            <View className="relative">
              <View className="w-14 h-14 rounded-full bg-[#d4b5a0] overflow-hidden border-4 border-[#22c55e]">
                <Image
                  source={require('./assets/icon.png')}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              </View>
              <View className="absolute bottom-0 right-0 w-3 h-3 bg-[#22c55e] rounded-full border-2 border-[#0a1f1a]" />
            </View>
            <View>
              <Text className="text-sm text-gray-400">Good Evening</Text>
              <Text className="text-xl font-bold text-white">Alex Johnson</Text>
            </View>
          </View>
          <Pressable className="relative p-3 rounded-full bg-[#1a2f2a]">
            <Bell size={24} color="#ffffff" />
            <View className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full" />
          </Pressable>
        </View>

        {/* Daily Summary Card */}
        <View className="mx-6 mb-6">
          <LinearGradient
            colors={['#5b7cf5', '#4a9d8f', '#47d9ba']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 24, padding: 24 }}
          >
            <View className="flex-row items-start justify-between mb-6">
              <Text className="text-white/90 font-semibold text-sm tracking-wide">DAILY SUMMARY</Text>
              <View className="bg-white/25 px-4 py-1.5 rounded-full">
                <Text className="text-xs font-medium text-white">TODAY</Text>
              </View>
            </View>

            <View className="flex-row gap-8">
              {/* Calories */}
              <View className="flex-1">
                <View className="flex-row items-baseline gap-1 mb-2">
                  <Text className="text-5xl font-bold text-white">1,820</Text>
                  <Text className="text-sm text-white/70 uppercase">kcal</Text>
                </View>
                <View className="mb-2">
                  <View className="h-2 bg-white/30 rounded-full overflow-hidden">
                    <View className="h-full bg-white rounded-full" style={{ width: '75%' }} />
                  </View>
                </View>
                <Text className="text-sm text-white/70">620 remaining</Text>
              </View>

              {/* Activity Minutes */}
              <View className="flex-1">
                <View className="flex-row items-baseline gap-1 mb-2">
                  <Text className="text-5xl font-bold text-white">45</Text>
                  <Text className="text-sm text-white/70 uppercase">min</Text>
                </View>
                <View className="mb-2">
                  <View className="h-2 bg-white/30 rounded-full overflow-hidden">
                    <View className="h-full bg-white rounded-full" style={{ width: '50%' }} />
                  </View>
                </View>
                <Text className="text-sm text-white/70">Goal: 90 min</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Action Buttons */}
        <View className="flex-row gap-4 mx-6 mb-8">
          <Pressable className="bg-[#22c55e] rounded-3xl p-6 flex-1 min-h-[180px] justify-between">
            <Dumbbell size={40} color="#0a1f1a" strokeWidth={2.5} />
            <Text className="text-2xl font-bold text-[#0a1f1a] leading-tight">
              Start{'\n'}Workout
            </Text>
          </Pressable>

          <Pressable className="bg-[#1a2f2a] rounded-3xl p-6 flex-1 min-h-[180px] justify-between">
            <UtensilsCrossed size={40} color="#ffffff" strokeWidth={2.5} />
            <Text className="text-2xl font-bold text-white leading-tight">
              Track{'\n'}Food
            </Text>
          </Pressable>
        </View>

        {/* Recent Workouts */}
        <View className="mx-6 mb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-2xl font-bold text-white">Recent Workouts</Text>
            <Pressable>
              <Text className="text-[#22c55e] text-sm font-medium">See all</Text>
            </Pressable>
          </View>

          <View className="gap-3">
            {/* Upper Body Power */}
            <Pressable className="bg-[#1a2f2a] rounded-2xl p-4 flex-row items-center gap-4">
              <View className="w-20 h-20 rounded-xl bg-[#d4b5a0] overflow-hidden flex-shrink-0">
                <Image
                  source={require('./assets/icon.png')}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-lg mb-1">Upper Body Power</Text>
                <Text className="text-gray-400 text-sm mb-2">Yesterday • 1h 10m</Text>
                <View className="flex-row items-center gap-3">
                  <View className="flex-row items-center gap-1">
                    <Flame size={16} color="#f97316" />
                    <Text className="text-orange-500 text-sm font-medium">450</Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Text className="text-xs">💪</Text>
                    <Text className="text-[#22c55e] text-sm font-medium">4 PRS</Text>
                  </View>
                </View>
              </View>
              <ChevronRight size={24} color="#4b5563" />
            </Pressable>

            {/* Morning Run */}
            <Pressable className="bg-[#1a2f2a] rounded-2xl p-4 flex-row items-center gap-4">
              <View className="w-20 h-20 rounded-xl bg-[#8b7d6b] overflow-hidden flex-shrink-0">
                <Image
                  source={require('./assets/icon.png')}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-lg mb-1">Morning Run</Text>
                <Text className="text-gray-400 text-sm mb-2">Tuesday • 28m</Text>
                <View className="flex-row items-center gap-1">
                  <Flame size={16} color="#f97316" />
                  <Text className="text-orange-500 text-sm font-medium">310</Text>
                </View>
              </View>
              <ChevronRight size={24} color="#4b5563" />
            </Pressable>
          </View>
        </View>

        {/* Recent Foods */}
        <View className="mx-6 mb-8">
          <Text className="text-2xl font-bold text-white mb-4">Recent Foods</Text>

          <View className="gap-3">
            {/* Breakfast Burrito */}
            <View className="bg-[#1a2f2a] rounded-2xl p-5">
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-row items-center gap-3">
                  <Text className="text-4xl">🌯</Text>
                  <View>
                    <Text className="text-white font-bold text-lg">Breakfast Burrito</Text>
                    <View className="flex-row gap-2 mt-2">
                      <View className="bg-[#0f251f] px-2.5 py-1 rounded-full">
                        <Text className="text-xs text-gray-400">24G P</Text>
                      </View>
                      <View className="bg-[#0f251f] px-2.5 py-1 rounded-full">
                        <Text className="text-xs text-gray-400">42G C</Text>
                      </View>
                      <View className="bg-[#0f251f] px-2.5 py-1 rounded-full">
                        <Text className="text-xs text-gray-400">18G F</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <Text className="text-white font-bold text-lg">450 kcal</Text>
              </View>
            </View>

            {/* Chicken & Rice Bowl */}
            <View className="bg-[#1a2f2a] rounded-2xl p-5">
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-row items-center gap-3">
                  <Text className="text-4xl">🍔</Text>
                  <View>
                    <Text className="text-white font-bold text-lg">Chicken & Rice Bowl</Text>
                    <View className="flex-row gap-2 mt-2">
                      <View className="bg-[#0f251f] px-2.5 py-1 rounded-full">
                        <Text className="text-xs text-gray-400">45G P</Text>
                      </View>
                      <View className="bg-[#0f251f] px-2.5 py-1 rounded-full">
                        <Text className="text-xs text-gray-400">60G C</Text>
                      </View>
                      <View className="bg-[#0f251f] px-2.5 py-1 rounded-full">
                        <Text className="text-xs text-gray-400">12G F</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <Text className="text-white font-bold text-lg">620 kcal</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom spacing for navigation */}
        <View className="h-24" />
      </ScrollView>

      {/* Bottom Navigation */}
      <View className="absolute bottom-0 left-0 right-0 bg-[#0f251f] border-t border-[#1a2f2a]">
        <SafeAreaView edges={['bottom']}>
          <View className="flex-row items-center justify-around py-4 px-6">
            <Pressable className="items-center gap-1">
              <Home size={24} color="#22c55e" strokeWidth={2.5} />
              <Text className="text-xs text-[#22c55e] font-medium">Home</Text>
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
