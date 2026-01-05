import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Search, SlidersHorizontal, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MasterLayout } from '../components/MasterLayout';
import { WorkoutCard } from '../components/WorkoutCard';
import { FeaturedWorkoutCard } from '../components/FeaturedWorkoutCard';
import { FilterTabs } from '../components/FilterTabs';
import { CreateTemplateCard } from '../components/CreateTemplateCard';

const WORKOUTS_DATA = {
  featured: {
    name: 'Push Day A',
    lastCompleted: '2 Days Ago',
    exerciseCount: 5,
    duration: '45 mins',
    image: require('../assets/icon.png'),
  },
  workouts: [
    {
      id: '1',
      name: 'Leg Hypertrophy',
      lastCompleted: '5 days ago',
      exerciseCount: 7,
      duration: '60 mins',
      image: require('../assets/icon.png'),
    },
    {
      id: '2',
      name: 'Full Body Cardio',
      lastCompleted: 'Yesterday',
      exerciseCount: 3,
      duration: '30 mins',
      image: require('../assets/icon.png'),
    },
    {
      id: '3',
      name: 'Pull Day B',
      lastCompleted: '2 weeks ago',
      exerciseCount: 6,
      duration: '50 mins',
      image: require('../assets/icon.png'),
    },
  ],
};

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'strength', label: 'Strength' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'flexibility', label: 'Flexibility' },
];

export default function WorkoutsScreen() {
  const [activeFilter, setActiveFilter] = useState('all');

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pb-6 pt-8">
          <View className="flex-1">
            <Text className="text-4xl font-bold text-white">My Workouts</Text>
          </View>
          <View className="flex-row gap-4">
            <Pressable className="rounded-lg p-2">
              <Search size={24} color="#ffffff" />
            </Pressable>
            <Pressable className="rounded-lg p-2">
              <SlidersHorizontal size={24} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        {/* Filter Tabs */}
        <FilterTabs tabs={FILTER_TABS} activeTab={activeFilter} onTabChange={setActiveFilter} />

        {/* Workouts List */}
        <View className="gap-4 px-5">
          {/* Featured Workout */}
          <FeaturedWorkoutCard
            name={WORKOUTS_DATA.featured.name}
            lastCompleted={WORKOUTS_DATA.featured.lastCompleted}
            exerciseCount={WORKOUTS_DATA.featured.exerciseCount}
            duration={WORKOUTS_DATA.featured.duration}
            image={WORKOUTS_DATA.featured.image}
          />

          {/* Regular Workouts */}
          {WORKOUTS_DATA.workouts.map((workout) => (
            <WorkoutCard
              key={workout.id}
              name={workout.name}
              lastCompleted={workout.lastCompleted}
              exerciseCount={workout.exerciseCount}
              duration={workout.duration}
              image={workout.image}
            />
          ))}

          {/* Create Template Card */}
          <CreateTemplateCard />
        </View>

        {/* Bottom spacing for navigation */}
        <View className="h-24" />
      </ScrollView>

      {/* Floating Action Button */}
      <Pressable className="absolute bottom-28 right-5 h-16 w-16 rounded-full shadow-lg">
        <LinearGradient
          colors={['#34d399', '#22d3ee']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="h-full w-full items-center justify-center rounded-full">
          <Plus size={28} color="#000000" strokeWidth={3} />
        </LinearGradient>
      </Pressable>
    </MasterLayout>
  );
}
