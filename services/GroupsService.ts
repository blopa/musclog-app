import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutService } from '../database/services/WorkoutService';
import { UserService } from '../database/services/UserService';

const GROUPS_STORAGE_KEY = 'groups_data';
const MY_GROUPS_STORAGE_KEY = 'my_groups';

export interface GroupMember {
  id: string;
  name: string;
  avatarIcon?: string;
  avatarColor?: string;
  volume: number;
  frequency: number;
  isCurrentUser?: boolean;
  rank: number;
  subtitle?: string;
}

export interface Group {
  id: string;
  members: string[]; // Member sync IDs
}

const MOCK_MEMBERS = [
  { name: 'Alex "The Hulk"', subtitle: 'Professional Powerlifter', volume: 14250, frequency: 6 },
  { name: 'Sarah Johnson', subtitle: 'Crossfit Athlete', volume: 12890, frequency: 5 },
  { name: 'Marcus Chen', subtitle: 'Heavy Lifter', volume: 11400, frequency: 4 },
  { name: 'Elena Rodriguez', subtitle: 'Fitness Enthusiast', volume: 10150, frequency: 3 },
  { name: 'Robert "Tank" ...', subtitle: 'Strength Training', volume: 9940, frequency: 4 },
];

export class GroupsService {
  private static async getGroups(): Promise<Record<string, Group>> {
    const data = await AsyncStorage.getItem(GROUPS_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  }

  private static async saveGroups(groups: Record<string, Group>) {
    await AsyncStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  }

  static async getMyGroups(): Promise<string[]> {
    const data = await AsyncStorage.getItem(MY_GROUPS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  static async joinGroup(groupId: string): Promise<void> {
    const myGroups = await this.getMyGroups();
    if (!myGroups.includes(groupId)) {
      myGroups.push(groupId);
      await AsyncStorage.setItem(MY_GROUPS_STORAGE_KEY, JSON.stringify(myGroups));
    }

    const groups = await this.getGroups();
    if (!groups[groupId]) {
      groups[groupId] = { id: groupId, members: [] };
    }

    const user = await UserService.getCurrentUser();
    if (user && !groups[groupId].members.includes(user.syncId)) {
      groups[groupId].members.push(user.syncId);
      await this.saveGroups(groups);
    }
  }

  static async createGroup(): Promise<string> {
    const prefixes = ['MUSC', 'FIT', 'LIFT', 'POW'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const id = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

    const groups = await this.getGroups();
    groups[id] = { id, members: [] };
    await this.saveGroups(groups);

    await this.joinGroup(id);
    return id;
  }

  static async getGroupRanking(groupId: string): Promise<GroupMember[]> {
    const user = await UserService.getCurrentUser();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const stats = await WorkoutService.getWorkoutStatistics({
      startDate: sevenDaysAgo,
      endDate: Date.now(),
    });

    const currentUserMember: GroupMember = {
      id: user?.syncId || 'current-user',
      name: user?.fullName ? `You (${user.fullName})` : 'You',
      avatarIcon: user?.avatarIcon,
      avatarColor: user?.avatarColor,
      volume: stats.totalVolume,
      frequency: stats.totalWorkouts,
      isCurrentUser: true,
      rank: 0, // Will be calculated
      subtitle: 'Top 15% this week', // Hardcoded as in design
    };

    const members: GroupMember[] = [currentUserMember];

    // Add mock members
    MOCK_MEMBERS.forEach((m, index) => {
      members.push({
        id: `mock-${index}`,
        name: m.name,
        subtitle: m.subtitle,
        volume: m.volume,
        frequency: m.frequency,
        rank: 0,
      });
    });

    return members;
  }
}
