import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { useAppTheme } from '../../constants/useAppTheme'; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../supabaseClient';
import { ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { useRouter } from 'expo-router';



// This is the main Home Screen that users see after logging in.
const HomeScreen = () => {
  const { colors, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('User');
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<DocumentPickerAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();
  


  
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


  
 // 3. Document Picker function
  const pickDocument = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const file = result.assets[0];
      setSelectedFile(file); 
      alert("File Selected: " + file.name);
    }
  } catch (err) {
    console.log("Error picking file:", err);
  }
};



// 4. Upload function to send the file to Supabase Storage
const uploadFile = async () => {
  if (!selectedFile) return;

  setIsUploading(true);

  try {
    const response = await fetch(selectedFile.uri);
    const blob = await response.blob();
    const fileName = `${Date.now()}-${selectedFile.name}`;

    const { data, error } = await supabase.storage
      .from('datasets')
      .upload(fileName, blob, {
        contentType: selectedFile.mimeType || 'text/csv',
});

if (error) throw error;
alert("File uploaded successfully!");

// After successful upload, navigate to the cleaning screen and pass the file name as a parameter
router.push({
      pathname: '/cleanscreen',
      params: { fileName: selectedFile.name }
    } as any);



  } catch (error: any) {
    alert("Upload failed: " + error.message);
  } finally {
    setIsUploading(false);
  }
};


  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style="light" />


    <KeyboardAvoidingView 
      // FIX: Use 'padding' for both. On Android, this forces the layout to 'shrink'
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
      style={{ flex: 1 }}
      // FIX: Offset -60 for Android forces the bar into the visible window
     keyboardVerticalOffset={Platform.OS === 'ios' ? -30: -25}
    >


    {/* 1. WRAPPER FOR SCROLLABLE CONTENT */}
      <View style={{ flex: 1 }}>
        <ScrollView 
          contentContainerStyle={{ padding: spacing.lg }}
          showsVerticalScrollIndicator={false}
          // FIX: This tells the keyboard to go away if you scroll down
          keyboardDismissMode="on-drag"
        >
      



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

     
      
  {/* ACTION CARD - DYNAMIC VERSION */}
{selectedFile ? (
  // --- SHOW THIS IF FILE IS SELECTED ---
  <View style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.accent, borderWidth: 1 }]}>
    <View style={[styles.iconCircle, { backgroundColor: colors.accent + '20' }]}>
      <MaterialCommunityIcons name="file-check" size={32} color={colors.accent} />
    </View>
    
    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
      {selectedFile.name}
    </Text>
    
    <Text style={[styles.cardSub, { color: colors.textMuted, marginBottom: 15 }]}>
      {selectedFile.size
    ? `${(selectedFile.size /1024).toFixed(2)} KB`
    : 'File'}• Ready to clean
    </Text>

    <View style={{ flexDirection: 'row', gap: 10 }}>
       <TouchableOpacity 
         onPress={() => setSelectedFile(null)} 
         style={{ backgroundColor: 'rgba(255, 68, 68, 0.1)', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 }}
       >
         <Text style={{ color: '#ff4444', fontWeight: '600' }}>Remove</Text>
       </TouchableOpacity>

       <TouchableOpacity
          onPress={uploadFile} // This will trigger the upload function we defined
          disabled={isUploading} // Disable button while uploading
         style={[styles.startBtn, { backgroundColor: colors.accent, flex: 1, marginTop: 0 }]}
       >
        {isUploading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.startBtnText}>Start Cleaning ✨</Text>
          )}
         
       </TouchableOpacity>
    </View>
  </View>
) : (
  // --- SHOW THIS IF NO FILE (Your original code) ---
  <TouchableOpacity
    onPress={pickDocument} 
    style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
)}

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
              
</ScrollView>
</View>

{/* AI CHAT BAR  */}

<View style={styles.aiBarContainer}>
        <TouchableOpacity style={styles.aiIconCircle}>
          <MaterialCommunityIcons name="auto-fix" size={20} color={colors.accent} />
        </TouchableOpacity>


    <TextInput
    style={[styles.aiInput, { color: '#FFFFFF' }]}
            placeholder="Ask Bubble AI..."
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            value={message}
            onChangeText={(text) => setMessage(text)}
          />

          <TouchableOpacity 
    style={[styles.voiceBtn, { marginRight: 8 }]}
    onPress={() => alert("Voice listening started...")} // Placeholder for now
  >
    <MaterialCommunityIcons name="microphone" size={22} color={colors.accent} />
  </TouchableOpacity>


    <TouchableOpacity style={[styles.sendBtn , { backgroundColor: colors.accent }]}>
        <MaterialCommunityIcons name="arrow-up" size={20} color="white" />
    </TouchableOpacity>
</View>


<View style={{ height: insets.bottom + 5 }} />
</KeyboardAvoidingView>

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
  // REMOVED: position, left, right, and bottom
  height: 60,
  marginHorizontal: 20, 
  borderRadius: 30,
  backgroundColor: 'rgba(15, 23, 42, 0.85)', // Semi-transparent dark background
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.15)',
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 8,
  // Shadow to keep the floating "Glass" look
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.3,
  shadowRadius: 20,
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
  voiceBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
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