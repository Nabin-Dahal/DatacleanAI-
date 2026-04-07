import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { useAppTheme } from '../../constants/useAppTheme'; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../supabaseClient';
import { ScrollView } from 'react-native';

const HomeScreen = () => {
  const { colors, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('User');
  const [message, setMessage] = useState('');

  // 1. Get the logged-in user's name
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        // Takes 'john' from 'john@email.com'
        setUsername(user.email.split('@')[0]);
      }
    };
    fetchUser();
  }, []);

  // 2. Simple Logout function
  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Your _layout.tsx will automatically see the session is gone and move you to Login
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style="light" />
      
      {/* HEADER AREA */}
      <View style={[styles.header, { paddingHorizontal: spacing.lg, marginTop: spacing.md }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.textMuted }]}>Welcome back,</Text>
          <Text style={[styles.username, { color: colors.textPrimary }]}>{username}</Text>
        </View>


        {/* LOGOUT BUTTON */}
        <TouchableOpacity 
          onPress={handleLogout}
          style={[styles.logoutBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="logout" size={22} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* We will add the main content card here in the next step */}

      <ScrollView 
  contentContainerStyle={{ padding: spacing.lg }}
  showsVerticalScrollIndicator={false}
>
  {/* ACTION CARD */}
  <TouchableOpacity 
    style={[
      styles.actionCard, 
      { backgroundColor: colors.surface, borderColor: colors.border }
    ]}
    activeOpacity={0.8}
  >
    <View style={[styles.iconCircle, { backgroundColor: colors.accent + '20' }]}>
      <MaterialCommunityIcons name="file-upload-outline" size={32} color={colors.accent} />
    </View>
    
    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
      Clean Your First Dataset
    </Text>
    <Text style={[styles.cardSub, { color: colors.textMuted }]}>
      Upload a CSV or Excel file to let the AI identify and fix errors.
    </Text>

    <View style={[styles.startBtn, { backgroundColor: colors.accent }]}>
      <Text style={styles.startBtnText}>Get Started</Text>
      <MaterialCommunityIcons name="arrow-right" size={18} color="white" />
    </View>
  </TouchableOpacity>

  {/* Placeholder for Step 4: The Stats/Recent Activity row */}

<View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
    Recent Activity
  </Text>
  <TouchableOpacity>
    <Text style={{ color: colors.accent, fontWeight: '600' }}>See All</Text>
  </TouchableOpacity>
</View>

{/* EMPTY STATE (Placeholder for now) */}
<View style={[styles.emptyState, { backgroundColor: colors.surface + '50', borderColor: colors.border }]}>
  <MaterialCommunityIcons name="database-outline" size={40} color={colors.textMuted} />
  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
    No recent activity found.
  </Text>
</View>




{/* EMPTY STATE BOX */}
        <View style={[
          styles.emptyStateBox, 
          { backgroundColor: colors.surface, borderColor: colors.border }
        ]}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.background }]}>
            <MaterialCommunityIcons name="database-off-outline" size={28} color={colors.textMuted} />
          </View>
          
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            No datasets yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Your cleaned files and AI insights will appear here.
          </Text>
        </View>

        {/* This adds invisible space so you can scroll past the AI bar */}
        <View style={{ height: 120 }} />
</ScrollView>

{/* AI CHAT BAR  */}

<View style = {[
    styles.aiBarContainer,
    {
        bottom: insets.bottom + spacing.md,
    }
]}>
    <TouchableOpacity style={styles.aiIconCircle}>
        <MaterialCommunityIcons name="auto-fix" size={20} color={colors.accent} />
    </TouchableOpacity>
    <TextInput
    style={[styles.aiInput, { color: colors.textPrimary }]}
    placeholder="Ask Bubble AI to help you clean your data..."
    placeholderTextColor={colors.textMuted}
    value={message}
    onChangeText={(text) => setMessage(text)}
    multiline={false} // Keeps it a single line for now
  />

    <TouchableOpacity style={[styles.sendBtn , { backgroundColor: colors.accent }]}>
        <MaterialCommunityIcons name="arrow-up" size={20} color="white" />
    </TouchableOpacity>
</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  greeting: { fontSize: 14, fontWeight: '500' },
  username: { fontSize: 24, fontWeight: 'bold', textTransform: 'capitalize' },
  logoutBtn: { 
    padding: 10, 
    borderRadius: 12, 
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },

  actionCard: {
  borderRadius: 24,
  padding: 24,
  borderWidth: 1,
  alignItems: 'center',
  marginTop: 20,
  shadowColor: "#000", // Add a subtle shadow for depth
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 8, // This creates a soft shadow around the card
  elevation: 5,
},

iconCircle: {
  width: 64,
  height: 64,
  borderRadius: 32,
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 16,
},
cardTitle: {
  fontSize: 20,
  fontWeight: 'bold',
  marginBottom: 8,
  textAlign: 'center',
},
cardSub: {
  fontSize: 14,
  textAlign: 'center',
  lineHeight: 20,
  marginBottom: 24,
},
startBtn: {
  flexDirection: 'row',
  paddingVertical: 12,
  paddingHorizontal: 24,
  borderRadius: 30,
  alignItems: 'center',
  gap: 8,
},
startBtnText: {
  color: 'white',
  fontWeight: 'bold',
  fontSize: 16,
},

sectionHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16,
},
sectionTitle: {
  fontSize: 18,
  fontWeight: 'bold',
},
emptyState: {
  padding: 40,
  borderRadius: 20,
  borderWidth: 1,
  borderStyle: 'dashed',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
},
emptyText: {
  fontSize: 14,
  textAlign: 'center',
  lineHeight: 18,
},
aiBarContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 60,
    borderRadius: 30,
    // 1. Change this to be see-through (RGBA)
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    // 2. Make the border a very faint white "shine"
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  aiIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(124, 58, 237, 0.1)', // Subtle tint of accent
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiPlaceholder: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
  },
aiInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 10, // Gives you a larger touch area to start typing
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },




emptyStateBox: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },



});

export default HomeScreen;