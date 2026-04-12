import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  FlatList, 
  ScrollView,
  Alert,
  TextInput, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../supabaseClient'; 
import { useAppTheme } from '../../constants/useAppTheme';

const CleaningScreen = () => {
  const { colors, isDark, spacing, radius } = useAppTheme();
  const router = useRouter();
  const { fileName } = useLocalSearchParams();
  const [message, setMessage] = useState('');
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── UNTOUCHED DATA LOGIC ──────────────────────────────────────
  const fetchAndParseCSV = async () => {
    try {
      setLoading(true);
      console.log("Fetching latest dataset...");

      // 1. Get the list of files to find the absolute latest upload
      const { data: fileList, error: listError } = await supabase.storage
        .from('datasets')
        .list('', { 
          limit: 1, 
          sortBy: { column: 'created_at', order: 'desc' } 
        });

      if (listError || !fileList || fileList.length === 0) {
        setLoading(false);
        return;
      }

      const actualCloudName = fileList[0].name;

      // 2. Generate a Signed URL (Bypasses Android Blob issues)
      const { data: urlData, error: urlError } = await supabase.storage
        .from('datasets')
        .createSignedUrl(actualCloudName, 60);

      if (urlError || !urlData?.signedUrl) throw urlError;

      // 3. Fetch the text directly from the link
      const response = await fetch(urlData.signedUrl);
      const text = await response.text();

      if (!text || text.trim().length === 0) {
        throw new Error("The file appears to be empty.");
      }

      // 4. Parse CSV Text into JSON
      const lines = text.split('\n').map(l => l.trim()).filter(line => line !== '');
      
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.trim());
        const parsedRows = lines.slice(1).map((line) => {
          const values = line.split(',');
          let obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = values[index]?.trim() || "";
          });
          return obj;
        });
        
        setData(parsedRows);
      }
    } catch (err: any) {
      console.error("Fetch Error:", err.message);
      Alert.alert("Data Load Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndParseCSV();
  }, []);

  // ─── DYNAMIC UI RENDERING ──────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* Header Area */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>AI Cleaning Hub</Text>
          <Text style={[styles.subtitle, { color: colors.accent }]}>{fileName || 'Dataset Preview'}</Text>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={[
        styles.content, 
        { 
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }
      ]}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Reading Dataset...</Text>
          </View>
        ) : data.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
          >
            <View>
              {/* Dynamic Table Header */}
              <View style={[styles.tableHeader, { backgroundColor: colors.surface, borderBottomColor: colors.accent }]}>
                {Object.keys(data[0]).map((key) => (
                  <View key={key} style={[styles.headerCell, { borderRightColor: colors.border }]}>
                    <Text style={[styles.headerText, { color: colors.accent }]}>{key}</Text>
                  </View>
                ))}
              </View>

              {/* Data Rows */}
              <FlatList
                data={data}
                keyExtractor={(_, index) => index.toString()}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => (
                  <View style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                    {Object.values(item).map((val: any, i) => (
                      <View key={i} style={[styles.cell, { borderRightColor: colors.border }]}>
                        <Text style={[styles.cellText, { color: colors.textPrimary }]} numberOfLines={1}>
                          {val}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              />
            </View>
          </ScrollView>
        ) : (
          <View style={styles.center}>
            <MaterialCommunityIcons name="database-off" size={60} color={colors.textMuted} />
            <Text style={[styles.placeholder, { color: colors.textMuted }]}>No data found in this file.</Text>
            <TouchableOpacity 
              style={[styles.retryBtn, { backgroundColor: colors.background, borderColor: colors.border }]} 
              onPress={fetchAndParseCSV}
            >
              <Text style={[styles.retryText, { color: colors.accent }]}>Retry Load</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Chat Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[styles.chatWrapper, { backgroundColor: 'transparent' }]}>
          <View style={[
            styles.chatContainer, 
            { backgroundColor: colors.surface, borderColor: colors.border }
          ]}>

           
            <TouchableOpacity style={[styles.magicButton, { backgroundColor: colors.background }]}>
              <MaterialCommunityIcons name="auto-fix" size={20} color={colors.accent} />
            </TouchableOpacity>

            
            
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              placeholder="Ask Bubble AI..."
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline={false}
            />


            {/* Microphone Icon (The one I missed!) */}
      <TouchableOpacity style={{ marginRight: 15 }}>
        <MaterialCommunityIcons name="microphone" size={22} color={colors.accent} />
      </TouchableOpacity>

            

            <TouchableOpacity style={[styles.sendButton , { backgroundColor: colors.accent }]}>
                    <MaterialCommunityIcons name="arrow-up" size={20} color="white" />
                </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── STYLES (Hardcoded colors removed, layout kept intact) ──────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
  },
  headerCell: {
    width: 140,
    padding: 15,
    borderRightWidth: 1,
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  cell: {
    width: 140,
    padding: 15,
    borderRightWidth: 1,
  },
  cellText: {
    fontSize: 13,
  },
  placeholder: {
    marginTop: 10,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryText: {
    fontWeight: '600',
  },
  chatWrapper: {
    paddingTop: 0,
    paddingBottom: Platform.OS === 'ios' ? 30 : 40, 
  },
  chatContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 15,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 30,
    borderWidth: 1,
  },
  magicButton: {
    padding: 8,
    borderRadius: 20,
  },
  input: {
    flex: 1,
    paddingHorizontal: 15,
    fontSize: 15,
    height: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CleaningScreen;