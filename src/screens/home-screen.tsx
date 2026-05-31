import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, KeyboardAvoidingView, ActivityIndicator, Alert } from 'react-native';
import { useAppTheme } from '../../constants/useAppTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../supabaseClient';
import { ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { useRouter, useNavigation} from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy'; 
import { decode } from 'base64-arraybuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define structure for a recent activity entry
interface RecentDataset {
  id: string;
  fileName: string;
  cloudName: string;
  lastModified: string;
  rowCount: number;
}

const HomeScreen = () => {
  const { colors, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('User');
  const [selectedFile, setSelectedFile] = useState<DocumentPickerAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentDataset[]>([]);
  const router = useRouter();
  const navigation = useNavigation();

  // 1. Load User Profile & Recent Files Registry from Local Storage
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUsername(user.email.split('@')[0]);
      }
    };
    fetchUser();
    
    // Initial fetch on boot
    loadRecentFiles();

    // Trigger auto-refresh whenever you tap the back arrow and hit this screen
    const unsubscribe = navigation.addListener('focus', () => {
      loadRecentFiles();
    });

    return unsubscribe;
  }, [navigation]);

  const loadRecentFiles = async () => {
    try {
      const savedList = await AsyncStorage.getItem('bubble_recent_datasets');
      if (savedList) {
        setRecentFiles(JSON.parse(savedList));
      }
    } catch (err) {
      console.error("Error loading recent list:", err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*']
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile(file); 
        Alert.alert("File Selected", file.name);
      }
    } catch (err) {
      console.log("Error picking file:", err);
    }
  };

  // 2. Upload function + registering metadata in local storage registry
  const uploadFile = async () => {
    if (!selectedFile) return;
    setIsUploading(true);

    try {
      const base64 = await FileSystem.readAsStringAsync(selectedFile.uri, {
        encoding: 'base64', 
      });

      const arrayBuffer = decode(base64);
      const uniqueCloudName = `${Date.now()}-${selectedFile.name.replace(/\s+/g, '_')}`;

      const { data, error } = await supabase.storage
        .from('datasets')
        .upload(uniqueCloudName, arrayBuffer, {
          contentType: 'text/csv',
          upsert: true
        });

      if (error) throw error;

      // Create a brand new activity profile card block entry
      const newEntry: RecentDataset = {
        id: Date.now().toString(),
        fileName: selectedFile.name,
        cloudName: uniqueCloudName,
        lastModified: new Date().toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        rowCount: 0 // Will be dynamically updated as soon as clean screen parses it
      };

      const updatedList = [newEntry, ...recentFiles.filter(f => f.fileName !== newEntry.fileName)];
      await AsyncStorage.setItem('bubble_recent_datasets', JSON.stringify(updatedList));
      setRecentFiles(updatedList);
      setSelectedFile(null);

      router.push({
        pathname: '/cleanscreen',
        params: { fileName: uniqueCloudName, isRestoration: 'false' }
      } as any);

    } catch (error: any) {
      console.error("Android Upload Error:", error);
      Alert.alert("Error", error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 3. Tapping an item opens it with restoration flag active
  const handleSelectRecent = (file: RecentDataset) => {
    router.push({
      pathname: '/cleanscreen',
      params: { fileName: file.cloudName, isRestoration: 'true' }
    } as any);
  };

  // 4. NEW: Delete a specific file entry from local recent activity
  const deleteRecentFile = async (idToDelete: string) => {
    try {
      const updatedList = recentFiles.filter(item => item.id !== idToDelete);
      setRecentFiles(updatedList);
      await AsyncStorage.setItem('bubble_recent_datasets', JSON.stringify(updatedList));
    } catch (err) {
      console.error("Error removing file card entry:", err);
      Alert.alert("Error", "Could not remove history pointer.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -30 : -25}
      >
        <View style={{ flex: 1 }}>
          <ScrollView 
            contentContainerStyle={{ padding: spacing.lg }}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
          >
            {/* HEADER AREA */}
            <View style={[styles.header, { paddingHorizontal: spacing.sm, marginTop: spacing.md }]}>
              <View>
                <Text style={[styles.greeting, { color: colors.textMuted }]}>Welcome back,</Text>
                <Text style={[styles.username, { color: colors.textPrimary }]}>{username}</Text>
              </View>

              <TouchableOpacity 
                onPress={handleLogout}
                style={[styles.logoutBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <MaterialCommunityIcons name="logout" size={22} color={colors.error} />
              </TouchableOpacity>
            </View>

            {/* ACTION CARD - DYNAMIC VERSION */}
            {selectedFile ? (
              <View style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.accent, borderWidth: 1 }]}>
                <View style={[styles.iconCircle, { backgroundColor: colors.accent + '20' }]}>
                  <MaterialCommunityIcons name="file-check" size={32} color={colors.accent} />
                </View>
                
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  {selectedFile.name}
                </Text>
                
                <Text style={[styles.cardSub, { color: colors.textMuted, marginBottom: 15 }]}>
                  {selectedFile.size ? `${(selectedFile.size / 1024).toFixed(2)} KB` : 'File'} • Ready to clean
                </Text>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity 
                    onPress={() => setSelectedFile(null)} 
                    style={{ backgroundColor: 'rgba(255, 68, 68, 0.1)', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 }}
                  >
                    <Text style={{ color: '#ff4444', fontWeight: '600' }}>Remove</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={uploadFile}
                    disabled={isUploading}
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

            {/* Recent Activity Header */}
            <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Recent Activity
              </Text>
              <TouchableOpacity onPress={loadRecentFiles}>
                <MaterialCommunityIcons name="refresh" size={20} color={colors.accent} />
              </TouchableOpacity>
            </View>

            {/* DYNAMIC LIST ENGINE */}
            {recentFiles.length > 0 ? (
              recentFiles.map((file) => (
                <View
                  key={file.id}
                  style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  {/* Clickable area to open the dataset */}
                  <TouchableOpacity
                    onPress={() => handleSelectRecent(file)}
                    activeOpacity={0.7}
                    style={styles.historyLeft}
                  >
                    <View style={[styles.fileIconBox, { backgroundColor: colors.accentSoft }]}>
                      <MaterialCommunityIcons name="table-large" size={22} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text numberOfLines={1} style={[styles.fileTitle, { color: colors.textPrimary }]}>
                        {file.fileName}
                      </Text>
                      <Text style={[styles.fileTime, { color: colors.textMuted }]}>
                        Edited {file.lastModified}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Right side alignment layout for badge count & dynamic trash container button */}
                  <View style={styles.historyRight}>
                    <View style={[styles.rowBadge, { backgroundColor: colors.background }]}>
                      <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>
                        {file.rowCount > 0 ? `${file.rowCount} Rows` : 'Syncing'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          "Remove Entry",
                          `Do you want to clear "${file.fileName}" from history?`,
                          [
                            { text: "Cancel", style: "cancel" },
                            { text: "Delete", style: "destructive", onPress: () => deleteRecentFile(file.id) }
                          ]
                        );
                      }}
                      style={{ padding: 4, marginLeft: 8 }}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              /* EMPTY STATE BOX FALLBACK */
              <View style={[styles.emptyStateBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
            )}
                  
          </ScrollView>
        </View>
        <View style={{ height: insets.bottom + 5 }} />
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 14, fontWeight: '500' },
  username: { fontSize: 24, fontWeight: 'bold', textTransform: 'capitalize' },
  logoutBtn: { padding: 10, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  actionCard: {
    borderRadius: 24, padding: 24, borderWidth: 1, alignItems: 'center', marginTop: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5,
  },
  iconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  cardSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  startBtn: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30, alignItems: 'center', gap: 8 },
  startBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  emptyStateBox: { padding: 32, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  emptyIconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 18 },
  historyCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center', flex: 0.65 },
  historyRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flex: 0.35 },
  fileIconBox: { width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  fileTitle: { fontSize: 15, fontWeight: '600' },
  fileTime: { fontSize: 12, marginTop: 2 },
  rowBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }
});

export default HomeScreen;