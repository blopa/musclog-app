import { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import { MasterLayout } from '../components/MasterLayout';
import { WorkoutCard } from '../components/WorkoutCard';
import { FeaturedWorkoutCard } from '../components/FeaturedWorkoutCard';
import { FilterTabs } from '../components/FilterTabs';
import { CreateTemplateCard } from '../components/CreateTemplateCard';
import { GradientText } from '../components/GradientText';
import { FloatingActionButton } from '../components/FloatingActionButton';

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
      <View className="flex-1">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="px-6 pt-8">
            <View className="flex-row items-center justify-between">
              <GradientText
                colors={['#a78bfa', '#60a5fa', '#34d399']}
                style={{ fontSize: 36, fontWeight: 'bold' }}>
                My Workouts
              </GradientText>
              <View className="ml-4 flex-row gap-4">
                <Pressable className="rounded-lg p-2">
                  <Search size={24} color="#ffffff" />
                </Pressable>
                <Pressable className="rounded-lg p-2">
                  <SlidersHorizontal size={24} color="#ffffff" />
                </Pressable>
              </View>
            </View>
            {/* Add spacing below header */}
            <View style={{ height: 20 }} />
            {/* Filter Tabs */}
            <FilterTabs tabs={FILTER_TABS} activeTab={activeFilter} onTabChange={setActiveFilter} />
          </View>

          {/* Workouts List */}
          <View className="mx-6 mb-8 gap-4">
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

          {/* Bottom spacing for navigation and FAB */}
          <View className="h-32" />
        </ScrollView>

        {/* Floating Action Button */}
        <FloatingActionButton position="right" bottom={100} />
      </View>
    </MasterLayout>
  );
}
