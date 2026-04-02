import { View, Text } from "react-native";
import { useAppTheme } from "@/constants/useAppTheme";


export default function Home() {
  const { colors } = useAppTheme();
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <Text style={{ color: colors.textPrimary }}>Home Dashboard (Coming Tomorrow!)</Text>
    </View>
    );
}


