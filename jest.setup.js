jest.mock('lucide-react-native', () => ({
  User: jest.fn(() => 'User'),
  Dumbbell: jest.fn(() => 'Dumbbell'),
}));
