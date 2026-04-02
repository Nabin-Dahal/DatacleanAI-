import { Stack } from "expo-router";
import { useAppTheme } from "@/constants/useAppTheme";
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {

  // const { colors } = useAppTheme();
  return (
    <SafeAreaProvider>
    <Stack>
      
      <Stack.Screen
        name="index"
        options={{
          headerShown: false, // This hides the "index" title bar
        }}
      />
      {/* Login screen — no header */}
      <Stack.Screen
        name="login"
        options={{ headerShown: false }}
      />
      {/* Register screen — no header */}
      <Stack.Screen
        name="register"
        options={{ headerShown: true }}
      />
      {/* Forgot Password screen — no header */}
      <Stack.Screen
        name="forgot-password"
        options={{ headerShown: false }}
      />
    </Stack>
    </SafeAreaProvider>
  );
}