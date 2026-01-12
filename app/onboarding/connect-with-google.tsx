import { View, Text, ScrollView } from 'react-native';
import { ConnectGoogleAccountBody } from '../../components/ConnectGoogleAccountBody';

export default function ConnectWithGoogle() {
  return (
    <ScrollView>
      <View className="px-6 pb-2 pt-4">
        <Text className="text-2xl font-bold tracking-tight text-white">
          Connect Your Google Account
        </Text>
      </View>
      <ConnectGoogleAccountBody onMaybeLater={() => {}} onConnect={() => {}} onClose={() => {}} />
    </ScrollView>
  );
}
