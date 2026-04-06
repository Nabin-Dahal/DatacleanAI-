import { use, useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from "../supabaseClient"; // Ensure this path is correct

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {

      const currentSegment = segments[0] // Check if the current route is part of the auth group 
      const isAuthPage =  !currentSegment || // If there's no segment, we're at the root which is the login page
                          currentSegment === 'login' ||   // If the segment is 'register' or 'forgot-password', it's also an auth page
                          currentSegment === 'register' || // If the segment is 'forgot-password', it's also an auth page
                          currentSegment === 'forgot-password' ; // If the segment is 'home', it's not an auth page
                          

      if (!session && !isAuthPage) { 
        router.replace("/");
      } else if (session && isAuthPage) {
        router.replace("/home");
      }
    });
    
    return () => subscription.unsubscribe();
    }, [segments]);

    return(
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="home" />
        </Stack>
      </SafeAreaProvider>
    );
}


