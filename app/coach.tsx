import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { MasterLayout } from '../components/MasterLayout';
import { CoachModal } from '../components/CoachModal';

export default function CoachScreen() {
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Auto-open modal when screen is mounted
  useEffect(() => {
    setIsModalVisible(true);
  }, []);

  return (
    <MasterLayout>
      <View className="flex-1 bg-bg-primary" />
      <CoachModal visible={isModalVisible} onClose={() => setIsModalVisible(false)} />
    </MasterLayout>
  );
}
