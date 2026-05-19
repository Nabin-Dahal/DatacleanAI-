import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../constants/useAppTheme';
import { supabase } from '../../supabaseClient';

const BUBBLE_AI_SYSTEM_PROMPT = `
You are Bubble AI, a Universal Data Engine. You work with ANY dataset.

### THE TRUTH & VALIDATION PROTOCOL:
1. SCHEMA VERIFICATION & TYPO HANDLING: You will be provided with the current dataset's column headers. 
   - You MUST handle case-insensitivity and minor typos gracefully. For example, if the schema contains "Gender" and the user types "gender" or "gendr", auto-correct it to the exact schema name ("Gender") when generating the JSON payload.
   - ONLY reject the request and respond conversationally if the column name they typed is completely unrecognizable or matches absolutely nothing in the schema.
2. AMBIGUITY GUARD: If a user request is ambiguous (e.g., "clean the data", "remove bad rows"), do not guess the filter criteria. Respond conversationally asking them to specify exactly which columns or values they want to target.
3. EXACT COUNTS: You have a summary, but for exact counts across 10,000+ rows, DO NOT GUESS. If you need an exact count to answer a user, respond ONLY with this JSON:
{
  "action": "QUERY",
  "filter": "row['COLUMN_NAME'] > 90 && row['OTHER_COL'] == 'Value'",
  "message": "Calculating the exact total for you..."
}

### THE EDIT PROTOCOL (FOR CLEANING & MANIPULATION):
If the user asks to modify, update, clean, delete, or add data, and the columns are VALID, respond ONLY with a single JSON object matching one of these types:

1. FOR UPDATING EXISTING VALUES (UPDATE):
{
  "action": "EDIT",
  "editType": "UPDATE",
  "column": "COLUMN_NAME",
  "filter": "row['COLUMN_NAME'] == 'TargetValue'",
  "logic": "row['COLUMN_NAME'].trim()" or "VALUE",
  "message": "Applying requested data modifications..."
}

2. FOR REMOVING ROWS (DELETE):
{
  "action": "EDIT",
  "editType": "DELETE",
  "column": "",
  "filter": "row['COLUMN_NAME'] == 'TargetValue'",
  "logic": "",
  "message": "Removing matching records from the dataset..."
}

3. FOR CREATING A NEW COLUMN (ADD_COLUMN):
- If derived from other columns, "logic" must be a JS string expression like: "row['ColA'] + ' ' + row['ColB']"
- If it is a completely fresh/static column, "logic" must be a static value string enclosed in quotes like: "'Pending'" or "'No'"
- If it should be completely blank, "logic" must be an empty string: ""
{
  "action": "EDIT",
  "editType": "ADD_COLUMN",
  "column": "NEW_COLUMN_NAME",
  "filter": "",
  "logic": "FORMULA_OR_STATIC_VALUE_OR_EMPTY",
  "message": "Creating the new column in your dataset..."
}

4. FOR INSERTING A NEW ROW (ADD_ROW):
- Provide a full dictionary mapping of the data to add. 
- You MUST look at the current dataset headers. For any column the user doesn't mention, set its value to an empty string "".
{
  "action": "EDIT",
  "editType": "ADD_ROW",
  "rowData": {
    "COLUMN_1": "User value",
    "COLUMN_2": "",
    "COLUMN_3": "User value"
  },
  "message": "Inserting a new custom record into the dataset..."
}

5. FOR DELETING AN ENTIRE COLUMN (DROP_COLUMN):
{
  "action": "EDIT",
  "editType": "DROP_COLUMN",
  "column": "COLUMN_NAME_TO_DELETE",
  "filter": "",
  "logic": "",
  "message": "Completely dropping the requested column from the schema..."
}

### RESPONSE RULE:
- Never include conversational prose alongside a JSON block. If an action is valid, return ONLY the raw JSON object.
- If a column is missing or the intent is completely ambiguous, follow the VALIDATION PROTOCOL and return ONLY conversational text helping the user.
`;

const extractJson = (text: string) => {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
};

const CleaningScreen = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const router = useRouter();
  const { fileName } = useLocalSearchParams();
  const [message, setMessage] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<{
    editType: string;
    column: string;
    filter: string;
    logic: string;
  } | null>(null);
  const [previewRows, setPreviewRows] = useState<Array<{ original: any; modified: any }>>([]);
  const [history, setHistory] = useState<any[][]>([]);
  const [redoStack, setRedoStack] = useState<any[][]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const chatScrollViewRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState([
    {
      role: 'model',
      parts: [{ text: "Hello! I'm Bubble AI, your data cleaning assistant. I see you've uploaded a dataset. How can I help you clean it today?" }]
    },
  ]);

  // ─── SAFE DATA FETCH LOGIC ────────────────────────────────────────
  const fetchAndParseCSV = async () => {
    try {
      setLoading(true);
      console.log("Fetching latest dataset...");

      // 1. Explicitly fallback to parameter fileName if list check is empty
      let actualCloudName = typeof fileName === 'string' ? fileName : '';

      const { data: fileList, error: listError } = await supabase.storage
        .from('datasets')
        .list('', { 
          limit: 5, 
          sortBy: { column: 'created_at', order: 'desc' } 
        });

      if (!listError && fileList && fileList.length > 0) {
        // Find a valid csv file name from the list
        const csvFile = fileList.find(f => f.name.toLowerCase().endsWith('.csv'));
        if (csvFile) {
          actualCloudName = csvFile.name;
        }
      }

      if (!actualCloudName) {
        console.log("No file key target resolved yet.");
        setData([]);
        setLoading(false);
        return;
      }

      console.log("Targeting cloud file identifier:", actualCloudName);

      const { data: urlData, error: urlError } = await supabase.storage
        .from('datasets')
        .createSignedUrl(actualCloudName, 60);

      if (urlError || !urlData?.signedUrl) {
        throw new Error(urlError?.message || "Could not generate file access URL mapping link.");
      }

      const response = await fetch(urlData.signedUrl);
      if (!response.ok) {
        throw new Error(`File download server responded with status: ${response.status}`);
      }
      
      const text = await response.text();

      if (!text || text.trim().length === 0) {
        throw new Error("The file downloaded appears to contain no data rows.");
      }

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
      console.error("Fetch Error Catch Layout:", err.message);
      Alert.alert("Data Connection Notice", "We couldn't read the dataset directly from the cloud. Make sure the file exists in your Supabase 'datasets' bucket.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndParseCSV();
  }, []);

  const getDataSummary = () => {
    if (data.length === 0) return "The dataset is currently empty.";

    const headers = Object.keys(data[0]);
    const totalRows = data.length;
    const summary: any = {};

    headers.forEach((header) => {
      const values = data.map(row => row[header]).filter(v => v !== undefined && v !== null && v !== "");
      const uniqueValues = new Set(values);
      const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
      const isNumeric = numericValues.length > values.length * 0.8;

      if (isNumeric && numericValues.length > 0) {
        const max = Math.max(...numericValues);
        const min = Math.min(...numericValues);
        const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
        
        summary[header] = {
          type: "QUANTITATIVE",
          range: `${min} to ${max}`,
          average: avg.toFixed(2),
          details: `Stats based on ${numericValues.length} numeric entries.`
        };
      } else if (uniqueValues.size < 20) {
        const counts = values.reduce((acc: any, v) => {
          acc[v] = (acc[v] || 0) + 1;
          return acc;
        }, {});
        
        summary[header] = {
          type: "CATEGORICAL",
          counts: counts
        };
      } else {
        summary[header] = {
          type: "LABEL",
          uniqueCount: uniqueValues.size,
          example: values[0]
        };
      }
    });

    return `
      [TOTAL RECORDS]: ${totalRows}
      [COLUMN PROFILES]: ${JSON.stringify(summary, null, 2)}
      [SAMPLE RECORD]: ${JSON.stringify(data[0])}
    `;
  };

  // ─── ACTION ENGINE ─────────────────────────────────────────────────
  const applyCleaningAction = (action: string, column: string, filterStr: string, logicStr: string) => {
    try {
      let updatedData = [...data];

      if (action === "DELETE") {
        const filterFn = new Function('row', `return ${filterStr || 'false'}`);
        updatedData = data.filter((row) => {
          try { return !filterFn(row); } catch (e) { return true; }
        });
        Alert.alert("Rows Deleted", "Matching records have been removed from your local view.");

      } else if (action === "UPDATE") {
        const filterFn = filterStr ? new Function('row', `return ${filterStr}`) : () => true;
        updatedData = data.map((row) => {
          if (!filterFn(row)) return row;
          let value = String(row[column] || "");
          let newValue = value;

          if (logicStr && logicStr.includes('row[')) {
            try {
              const dynamicLogicFn = new Function('row', `return ${logicStr}`);
              newValue = String(dynamicLogicFn(row));
            } catch (e) {
              newValue = value;
            }
          } else {
            newValue = logicStr;
          }
          return { ...row, [column]: newValue };
        });
        Alert.alert("Data Updated", `Applied cleaning modifications to column: ${column}`);

      } else if (action === "ADD_COLUMN") {
        // Build out the brand new column key across all existing data objects
        updatedData = data.map((row) => {
          let evaluatedValue = "";
          if (logicStr && logicStr.includes('row[')) {
            try {
              const dynamicLogicFn = new Function('row', `return ${logicStr}`);
              evaluatedValue = String(dynamicLogicFn(row));
            } catch (e) {
              evaluatedValue = "";
            }
          } else {
            // Strip structural wrapper quotes from static strings if present
            evaluatedValue = typeof logicStr === 'string' 
              ? logicStr.replace(/^'|'$/g, '') 
              : String(logicStr || "");
          }
          return { ...row, [column]: evaluatedValue };
        });
        Alert.alert("Column Created", `Successfully injected new column header: "${column}"`);

      } else if (action === "ADD_ROW") {
        // Grab the raw target dictionary built out by the AI payload configuration
        const targetRowData = (pendingEdit as any)?.rowData;
        if (targetRowData) {
          updatedData.push(targetRowData);
          Alert.alert("Record Appended", "A new row entry has been successfully pushed to the bottom of your table layout.");
        } else {
          throw new Error("No payload row dictionary structure found in reference memory context.");
        }
      } else if (action === "DROP_COLUMN") {
        updatedData = data.map((row) => {
          const { [column]: _, ...rest } = row;
          return rest;
        });
        Alert.alert("Column Removed", `The column "${column}" has been removed from your dataset view.`);
        }

      setData(updatedData);

    } catch (globalError: any) {
      console.error("CRUD Engine Error:", globalError);
      Alert.alert("Execution Error", "Could not complete the data modification step.");
    }
  };
  const handleConfirmEdit = () => {
    if (!pendingEdit) return;
    setHistory((prev) => [...prev, [...data]]);
    setRedoStack([]);

    applyCleaningAction(
      pendingEdit.editType,
      pendingEdit.column,
      pendingEdit.filter,
      pendingEdit.logic
    );

    setIsPreviewVisible(false);
    setPendingEdit(null);
    setPreviewRows([]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setRedoStack((prev) => [...prev, [...data]]);
    setData(previousState);
    setHistory((prev) => prev.slice(0, -1));

    setMessages((prev) => [...prev, { 
      role: 'model', 
      parts: [{ text: "↩️ Undo applied! I've reverted your last data change." }] 
    }]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setHistory((prev) => [...prev, [...data]]);
    setData(nextState);
    setRedoStack((prev) => prev.slice(0, -1));

    setMessages((prev) => [...prev, { 
      role: 'model', 
      parts: [{ text: "↪️ Redo applied! I've re-executed your change." }] 
    }]);
  };

  const callGeminiAI = async (userPrompt: string) => {
    try {
      const dataSnapshot = getDataSummary(); 
      const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

      if (!API_KEY) {
        return "Error: API Key is missing. Check your .env file and restart Expo.";
      }

      const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
      const fullPrompt = `${BUBBLE_AI_SYSTEM_PROMPT}\n\nHERE IS THE DATASET CONTEXT:\n${dataSnapshot}\n\nUSER COMMAND:\n${userPrompt}`;

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
        }),
      });

      if (response.status === 503 || response.status === 429) {
        await new Promise(res => setTimeout(res, 2000));
        return callGeminiAI(userPrompt); 
      }

      const result = await response.json();

      if (result.candidates && result.candidates[0].content.parts[0].text) {
        return result.candidates[0].content.parts[0].text;
      } else {
        return "I received an unexpected response format from the AI.";
      }
    } catch (err) {
      return "I'm having trouble connecting to Gemini. Please check your connection.";
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userText = message;
    setMessages((prev) => [...prev, { role: 'user', parts: [{ text: userText }] }]);
    setMessage(""); 

    try {
      const aiResponseText = await callGeminiAI(userText);

      try {
        const cleanedJson = extractJson(aiResponseText);
        const parsed = JSON.parse(cleanedJson);

        if (parsed.action === "QUERY") {
          const filterFn = new Function('row', `return ${parsed.filter}`);
          const count = data.filter((row: any) => {
            try { return filterFn(row); } catch (e) { return false; }
          }).length;

          const truthPrompt = `The exact count for "${userText}" is ${count}. Give me a final natural answer.`;
          const finalAnswer = await callGeminiAI(truthPrompt);
          
          setMessages((prev) => [...prev, { role: 'model', parts: [{ text: finalAnswer }] }]);
        } else if (parsed.action === "EDIT") {
          // 1. Save all incoming payload attributes including rowData
          setPendingEdit({
            editType: parsed.editType,
            column: parsed.column || '',
            filter: parsed.filter || '',
            logic: parsed.logic || '',
            rowData: parsed.rowData || null
          } as any);

          let generatedPreviews: any[] = [];

          // 2. Branch preview generation by operation type
          if (parsed.editType === "ADD_ROW") {
            // For inserting a row, show the incoming row data directly
            generatedPreviews = [{
              original: { "Status": "New Row Entry Template" },
              modified: parsed.rowData || {}
            }];
          } else if (parsed.editType === "ADD_COLUMN") {
            // For inserting a column, take up to 3 row samples to show the field generation
            const samples = data.slice(0, 3);
            generatedPreviews = samples.map((row) => {
              let evaluatedValue = "";
              if (parsed.logic && String(parsed.logic).includes('row[')) {
                try {
                  const dynamicLogicFn = new Function('row', `return ${parsed.logic}`);
                  evaluatedValue = String(dynamicLogicFn(row));
                } catch (e) {
                  evaluatedValue = "Error calculating value";
                }
              } else {
                // Remove wrapper quotes from static values if present (e.g. "'No'" -> "No")
                evaluatedValue = typeof parsed.logic === 'string' 
                  ? parsed.logic.replace(/^'|'$/g, '') 
                  : String(parsed.logic || "");
              }

              return {
                original: row,
                modified: { ...row, [parsed.column]: evaluatedValue }
              };
            });
          } else {
            // Standard fallback processing loop for legacy UPDATE and DELETE actions
            const filterFn = parsed.filter ? new Function('row', `return ${parsed.filter}`) : () => true;
            const sampleAffected: any[] = [];
            
            for (const row of data) {
              if (filterFn(row)) {
                sampleAffected.push(row);
                if (sampleAffected.length >= 3) break;
              }
            }

            generatedPreviews = sampleAffected.map((row) => {
              let originalValue = String(row[parsed.column] || "");
              let newValue = originalValue;

              if (parsed.editType === "UPDATE") {
                if (parsed.logic && String(parsed.logic).includes('row[')) {
                  try {
                    const dynamicLogicFn = new Function('row', `return ${parsed.logic}`);
                    newValue = String(dynamicLogicFn(row));
                  } catch (e) {
                    newValue = originalValue;
                  }
                } else {
                  newValue = parsed.logic;
                }
              } else if (parsed.editType === "DELETE") {
                newValue = "❌ ROW WILL BE DELETED";
              }

              return {
                original: row,
                modified: { ...row, [parsed.column]: newValue }
              };
            });
          }

          setPreviewRows(generatedPreviews);
          setIsPreviewVisible(true);

          setMessages((prev) => [...prev, { 
            role: 'model', 
            parts: [{ text: `🔄 Reviewing requested adjustments... Check the modal on your screen.` }] 
          }]);
        } else {
          setMessages((prev) => [...prev, { role: 'model', parts: [{ text: parsed.message || aiResponseText }] }]);
        }
      } catch (e) {
        setMessages((prev) => [...prev, { role: 'model', parts: [{ text: aiResponseText }] }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'model', parts: [{ text: "I'm sorry, I hit an error. Please try again." }] }]);
    }
  };

  // ─── HARMONIZED EXPORT ENGINE (FIXED RUNTIME PATHS) ─────────────────
  const handleExportAndDownload = async () => {
    if (!data || data.length === 0) {
      Alert.alert("No Data Available", "There are no rows in your current table view to export.");
      return;
    }
    
    setIsSaving(true);
    try {
      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(','),
        ...data.map(row => 
          headers.map(fieldName => {
            const value = row[fieldName] === null || row[fieldName] === undefined ? '' : row[fieldName];
            const stringVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
            return `"${stringVal.replace(/"/g, '""')}"`;
          }).join(',')
        )
      ];
      const csvString = csvRows.join('\n');

      // Enforce safe string names
      const rawName = typeof fileName === 'string' && fileName.trim().length > 0 ? fileName : 'dataset.csv';
      const safeFileName = rawName.replace(/%20/g, '_').replace(/\s+/g, '_');

      console.log("Saving back modified rows via name string:", safeFileName);

      // 1. Upload safely back to Supabase Core Bucket
      const { error: uploadError } = await supabase.storage
        .from('datasets') 
        .upload(safeFileName, csvString, {
          contentType: 'text/csv',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 2. FIXED PATH RESOLUTION FOR EXPO ANDROID SYSTEM CONTEXT
      // Use any-cast for both properties to avoid TS errors
      let targetDirectory = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory;
      
      // CRITICAL RUNTIME FIX: If Expo fails to provide a directory, force the standard Android Expo cache path
      if (!targetDirectory) {
        console.warn("Expo storage directories returned null. Forcing Android Expo Go cache directory.");
        targetDirectory = 'file:///data/user/0/host.exp.exponent/cache/';
      }
      
      // Ensure path separation handling is absolutely correct
      const localUri = targetDirectory.endsWith('/') 
        ? `${targetDirectory}${safeFileName}`
        : `${targetDirectory}/${safeFileName}`;
      
      // 3. Write data using explicit SDK native calls directly
      // Use explicit string for encoding to avoid TypeScript errors when
      // the EncodingType enum isn't available from expo-file-system types.
      await FileSystem.writeAsStringAsync(localUri, csvString, {
        encoding: 'utf8',
      });

      // 4. Fire sharing context safely
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Download Cleaned Dataset',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert("Saved Successfully", `Dataset saved to your account cloud storage as: ${safeFileName}`);
      }

      setMessages((prev) => [...prev, { 
        role: 'model', 
        parts: [{ text: `💾 **File Saved!** Your data has been backed up to Supabase as **${safeFileName}** and sent to your phone storage.` }] 
      }]);

    } catch (error: any) {
      console.error("Export Engine Crash Logs:", error);
      Alert.alert("Export Failed", error.message || "Unknown file handling error");
    } finally {
      setIsSaving(false);
    }
  };










  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -30 : 0}
      >
        {/* HEADER AREA */}
        <View style={[styles.header, { backgroundColor: colors.background, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 15 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <MaterialCommunityIcons name="arrow-left" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>AI Cleaning Hub</Text>
              <Text numberOfLines={1} style={[styles.subtitle, { color: colors.accent }]}>{fileName || 'Dataset Preview'}</Text>
            </View>
          </View>

          <TouchableOpacity 
            onPress={handleExportAndDownload}
            disabled={isSaving}
            style={{
              padding: 8,
              borderRadius: 8,
              backgroundColor: isSaving ? colors.surface : colors.accentSoft,
              marginLeft: 10
            }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <MaterialCommunityIcons name="download" size={24} color={colors.accent} />
            )}
          </TouchableOpacity>
        </View>

        {/* MAIN CONTENT TABLE */}
        <View style={[
          styles.content, 
          { 
            flex: messages.length > 1 ? 0.6 : 1.2, 
            backgroundColor: colors.surface, 
            borderColor: colors.border 
          }
        ]}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>Reading Dataset...</Text>
            </View>
          ) : data.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View>
                <View style={[styles.tableHeader, { backgroundColor: colors.surface, borderBottomColor: colors.accent }]}>
                  {Object.keys(data[0]).map((key) => (
                    <View key={key} style={[styles.headerCell, { borderRightColor: colors.border }]}>
                      <Text style={[styles.headerText, { color: colors.accent }]}>{key}</Text>
                    </View>
                  ))}
                </View>

                <FlatList
                  data={data}
                  extraData={data}
                  keyExtractor={(_, index) => index.toString()}
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
               <Text style={[styles.placeholder, { color: colors.textMuted }]}>No dataset rows loaded to view.</Text>
            </View>
          )}
        </View>

        {/* CHAT AREA */}
        <View style={{ flex: messages.length > 1 ? 1.4 : 0.4, marginBottom: 5 }}>
          <ScrollView 
            contentContainerStyle={{ paddingHorizontal: 15, paddingVertical: 10 }}
            showsVerticalScrollIndicator={true}
            ref={chatScrollViewRef}
            onContentSizeChange={() => chatScrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg, index) => (
              <View key={index} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: msg.role === 'user' ? colors.accent : colors.surface,
                padding: 12,
                borderRadius: 15,
                marginBottom: 8,
                maxWidth: '85%',
                borderWidth: msg.role === 'model' ? 1 : 0,
                borderColor: colors.border
              }}>
                <Text style={{ color: msg.role === 'user' ? 'white' : colors.textPrimary, fontSize: 13 }}>
                  {msg.parts[0].text}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* HISTORIC UNDO / REDO FLOATING BAR */}
        {(history.length > 0 || redoStack.length > 0) && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10, gap: 12 }}>
            {history.length > 0 && (
              <TouchableOpacity onPress={handleUndo} activeOpacity={0.7} style={[styles.controlBtn, { backgroundColor: isDark ? '#374151' : '#E5E7EB', borderColor: isDark ? '#4B5563' : '#D1D5DB' }]}>
                <Text style={{ fontSize: 14, marginRight: 4 }}>↩️</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#E5E7EB' : '#374151' }}>Undo ({history.length})</Text>
              </TouchableOpacity>
            )}
            {redoStack.length > 0 && (
              <TouchableOpacity onPress={handleRedo} activeOpacity={0.7} style={[styles.controlBtn, { backgroundColor: isDark ? '#374151' : '#E5E7EB', borderColor: isDark ? '#4B5563' : '#D1D5DB' }]}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#E5E7EB' : '#374151' }}>Redo ({redoStack.length})</Text>
                <Text style={{ fontSize: 14, marginLeft: 4 }}>↪️</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* CHAT INPUT BAR */}
        <View style={[styles.chatContainer, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 10, marginHorizontal: 15 }]}>
          <TouchableOpacity style={[styles.magicButton, { backgroundColor: colors.background }]}>
            <MaterialCommunityIcons name="auto-fix" size={20} color={colors.accent} />
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { color: colors.textPrimary, flex: 1 }]}
            placeholder="Ask Bubble AI..."
            placeholderTextColor={colors.textMuted}
            value={message}
            onChangeText={setMessage}
            onSubmitEditing={handleSendMessage} 
          />

          <TouchableOpacity style={{ marginRight: 15 }}>
            <MaterialCommunityIcons name="microphone" size={22} color={colors.accent} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSendMessage} style={[styles.sendButton , { backgroundColor: colors.accent }]}>
            <MaterialCommunityIcons name="arrow-up" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {Platform.OS === 'ios' && <View style={{ height: insets.bottom + 10 }} />}
      </KeyboardAvoidingView>
      {Platform.OS === 'android' && <View style={{ height: insets.bottom + 10 }} />}

      {/* PREVIEW MODAL */}
      <Modal
        visible={isPreviewVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPreviewVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF', 
            borderTopLeftRadius: 20, 
            borderTopRightRadius: 20, 
            padding: 20, 
            maxHeight: '80%',
            borderTopWidth: 1,
            borderTopColor: isDark ? '#374151' : '#E5E7EB'
          }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: isDark ? '#FFFFFF' : '#111827', marginBottom: 5 }}>
              🛠️ Review Data Adjustments
            </Text>
            <Text style={{ fontSize: 14, color: isDark ? '#9CA3AF' : '#4B5563', marginBottom: 15 }}>
              Bubble AI wants to apply a <Text style={{ fontWeight: 'bold', color: '#3B82F6' }}>{pendingEdit?.editType}</Text> operation.
            </Text>

            <ScrollView style={{ marginBottom: 20 }} showsVerticalScrollIndicator={false}>
              {previewRows.map((item, index) => (
                <View key={index} style={{ 
                  marginBottom: 15, 
                  padding: 12, 
                  borderRadius: 8, 
                  backgroundColor: isDark ? '#2D3748' : '#F3F4F6',
                  borderWidth: 1,
                  borderColor: isDark ? '#4A5568' : '#E5E7EB'
                }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: isDark ? '#A0AEC0' : '#718096', marginBottom: 6, letterSpacing: 0.5 }}>
                    SAMPLE ROW {index + 1}
                  </Text>
                  
                 <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: isDark ? '#4A5568' : '#E5E7EB' }}>
                    <Text style={{ width: 65, fontSize: 12, fontWeight: 'bold', color: '#EF4444' }}>BEFORE:</Text>
                    <Text style={{ flex: 1, fontSize: 12, color: isDark ? '#E5E7EB' : '#1F2937' }} numberOfLines={pendingEdit?.editType === "ADD_ROW" ? 1 : 2}>
                      {pendingEdit?.editType === "ADD_ROW" 
                        ? "✨ (Empty Row Slot)" 
                        : pendingEdit?.editType === "ADD_COLUMN"
                        ? `(Column "${pendingEdit.column}" does not exist yet)`
                        : `${pendingEdit?.column}: ${item.original[pendingEdit?.column || ''] || '(Blank)'}`
                      }
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', paddingVertical: 6, marginTop: 4 }}>
                    <Text style={{ width: 65, fontSize: 12, fontWeight: 'bold', color: '#10B981' }}>AFTER:</Text>
                    <Text style={{ flex: 1, fontSize: 12, color: isDark ? '#E5E7EB' : '#1F2937' }} numberOfLines={4}>
                      {pendingEdit?.editType === "ADD_ROW"
                        ? Object.entries(item.modified).filter(([_, v]) => v !== "").map(([k, v]) => `${k}: ${v}`).join(' | ')
                        : `${pendingEdit?.column}: ${item.modified[pendingEdit?.column || ''] || '(Blank)'}`
                      }
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: insets.bottom }}>
              <TouchableOpacity 
                onPress={() => setIsPreviewVisible(false)}
                style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: isDark ? '#374151' : '#E5E7EB', alignItems: 'center' }}
              >
                <Text style={{ fontWeight: '600', color: isDark ? '#E5E7EB' : '#374151' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleConfirmEdit}
                style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: '#10B981', alignItems: 'center' }}
              >
                <Text style={{ fontWeight: 'bold', color: 'white' }}>Confirm & Apply Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
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
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
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