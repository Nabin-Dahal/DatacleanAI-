import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  FlatList, 
  ScrollView,
  Alert 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../supabaseClient'; 

const CleaningScreen = () => {
  const router = useRouter();
  const { fileName } = useLocalSearchParams();
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <View style={styles.container}>
      {/* Header Area */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="#ffffff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>AI Cleaning Hub</Text>
          <Text style={styles.subtitle}>{fileName || 'Dataset Preview'}</Text>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Reading Dataset...</Text>
          </View>
        ) : data.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              {/* Dynamic Table Header */}
              <View style={styles.tableHeader}>
                {Object.keys(data[0]).map((key) => (
                  <View key={key} style={styles.headerCell}>
                    <Text style={styles.headerText}>{key}</Text>
                  </View>
                ))}
              </View>

              {/* Data Rows */}
              <FlatList
                data={data}
                keyExtractor={(_, index) => index.toString()}
                renderItem={({ item }) => (
                  <View style={styles.tableRow}>
                    {Object.values(item).map((val: any, i) => (
                      <View key={i} style={styles.cell}>
                        <Text style={styles.cellText} numberOfLines={1}>
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
            <MaterialCommunityIcons name="database-off" size={60} color="#374151" />
            <Text style={styles.placeholder}>No data found in this file.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchAndParseCSV}>
              <Text style={styles.retryText}>Retry Load</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Footer Info */}
      <View style={styles.footer}>
        <MaterialCommunityIcons name="auto-fix" size={20} color="#10b981" />
        <Text style={styles.footerText}> AI is ready to clean this dataset</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#030712',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#10b981',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    backgroundColor: '#0f172a',
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 15,
    fontSize: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderBottomWidth: 2,
    borderColor: '#10b981',
  },
  headerCell: {
    width: 140,
    padding: 15,
    borderRightWidth: 1,
    borderColor: '#334155',
  },
  headerText: {
    color: '#10b981',
    fontWeight: 'bold',
    fontSize: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  cell: {
    width: 140,
    padding: 15,
    borderRightWidth: 1,
    borderColor: '#1e293b',
  },
  cellText: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#030712',
  },
  footerText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  placeholder: {
    color: '#9ca3af',
    marginTop: 10,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  retryText: {
    color: '#10b981',
    fontWeight: '600',
  }
});

export default CleaningScreen;