import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const CleaningScreen = () => {
  const router = useRouter();
  const { fileName } = useLocalSearchParams(); // This catches the filename we sent

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Cleaning Hub</Text>
      </View>

      {/* Main Message */}
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="auto-fix" size={50} color="#10b981" />
        </View>
        
        <Text style={styles.fileLabel}>Selected File:</Text>
        <Text style={styles.fileName}>{fileName || "No file detected"}</Text>
        
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>
            This is the cleaning page. We will code the data preview and AI logic tomorrow! 🚀
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712', // Your deep dark theme
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 15,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  fileLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 5,
  },
  fileName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
  },
  messageBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageText: {
    color: '#d1d5db',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default CleaningScreen;