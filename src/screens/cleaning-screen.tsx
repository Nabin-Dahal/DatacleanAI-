import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as XLSX from 'xlsx'; // Make sure this is imported at the top
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../constants/useAppTheme';
import { supabase } from '../../supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const { fileName, isRestoration } = useLocalSearchParams();
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
      parts: [{ text: "Hello! I'm Bubble AI, your data cleaning assistant. How can I help you handle your dataset today?" }]
    },
  ]);

  // AUTOMATED SYNC AND AUTO-SAVE CONTROLLER
  const saveDataLocally = async (currentData: any[]) => {
   
    if (!fileName || typeof fileName !== 'string') return;
    try {
      const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;
    const cleanFileName = fileName.includes('-')
  ? fileName.split('-').slice(1).join('-')
  : fileName;

const { data: existingDataset } = await supabase
  .from('recent_datasets')
  .select('id')
  .eq('user_id', user.id)
  .eq('file_name', cleanFileName)
  .maybeSingle();

if (existingDataset) {
  const { error } = await supabase
    .from('recent_datasets')
    .update({
      row_count: currentData.length,
      updated_at: new Date().toISOString()
    })
    .eq('id', existingDataset.id);

  if (error) {
    console.log("Recent dataset update error:", error);
  } 
  // else {
  //   console.log("Recent dataset updated successfully");
  // }
} else {
  const { error } = await supabase
    .from('recent_datasets')
    .insert({
      user_id: user.id,
      file_name: cleanFileName,
      cloud_name: fileName,
      row_count: currentData.length
    });

  if (error) {
    console.log("Recent dataset insert error:", error);
  } 
  // else {
  //   console.log("Recent dataset inserted successfully");
  // }
}

  
      // 1. Save row data snapshot locally
      await AsyncStorage.setItem(`bubble_rows_${fileName}`, JSON.stringify(currentData));

      // 2. Refresh or CREATE row count tracking registry in main dashboard list view
      // const registryStr = await AsyncStorage.getItem('bubble_recent_datasets');
      // let list: any[] = registryStr ? JSON.parse(registryStr) : [];
      
      // const itemExists = list.some((item) => item.cloudName === fileName);

      // if (itemExists) {
      //   // Update existing item metadata row count
      //   list = list.map((item) => {
      //     if (item.cloudName === fileName) {
      //       return {
      //         ...item,
      //         rowCount: currentData.length,
      //         lastModified: new Date().toLocaleDateString(undefined, {
      //           month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      //         })
      //       };
      //     }
      //     return item;
      //   });
      // } else {
      //   // FALLBACK: Create a brand new history item entry if the list was empty or missing this file!
      //   const newEntry = {
      //     id: Date.now().toString(),
      //     fileName: fileName.includes('-') ? fileName.split('-').slice(1).join('-') : fileName,
      //     cloudName: fileName,
      //     lastModified: new Date().toLocaleDateString(undefined, {
      //       month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      //     }),
      //     rowCount: currentData.length
      //   };
      //   list = [newEntry, ...list];
      // }

      // await AsyncStorage.setItem('bubble_recent_datasets', JSON.stringify(list));

      const headers = currentData.length > 0
  ? Object.keys(currentData[0])
  : [];

if (headers.length > 0) {
  const csvString = [
    headers.join(','),
    ...currentData.map(row =>
      headers
        .map(header =>
          `"${String(row[header] ?? '').replace(/"/g, '""')}"`
        )
        .join(',')
    )
  ].join('\n');

  const { error: uploadError } = await supabase.storage
    .from('datasets')
    .upload(fileName, csvString, {
      contentType: 'text/csv',
      upsert: true
    });

  if (uploadError) {
    console.error("Auto cloud save failed:", uploadError);
  }
}
    } catch (e) {
      console.error("AutoSave Error:", e);
    }
  };
 
  // FETCH OR RESTORE CORE INIT HANDLER
  const fetchAndParseCSV = async () => {
  try {
    setLoading(true);
    const cloudFileKey = typeof fileName === 'string' ? fileName : '';

    if (!cloudFileKey) {
      setData([]);
      setLoading(false);
      return;
    }

    // INTEGRATION CHECK: If tapped from recent files list, restore from local phone memory bank
    if (isRestoration === 'true') {
      const storedRows = await AsyncStorage.getItem(`bubble_rows_${cloudFileKey}`);
      if (storedRows) {
        const parsed = JSON.parse(storedRows);
        setData(parsed);
        setLoading(false);
        return;
      }
    }

    // Cloud Download Fallback Setup
    const { data: urlData, error: urlError } = await supabase.storage
      .from('datasets')
      .createSignedUrl(cloudFileKey, 60);

    if (urlError || !urlData?.signedUrl) {
      throw new Error(urlError?.message || "Could not generate file access URL link.");
    }

    const response = await fetch(urlData.signedUrl);
    if (!response.ok) throw new Error(`Server status error: ${response.status}`);
    
    // 2. NEW STRATEGY: Read as raw binary bytes to see what the file REALLY is
    const arrayBuffer = await response.arrayBuffer();
    const dataUint8 = new Uint8Array(arrayBuffer);

    // Excel files are actually compressed ZIP files under the hood. 
    // Their first two bytes are ALWAYS 'P' (0x50) and 'K' (0x4B).
    const isExcelStructure = dataUint8[0] === 0x50 && dataUint8[1] === 0x4B;

    if (isExcelStructure || cloudFileKey.toLowerCase().endsWith('.xlsx')) {
      // 🚀 EXCEL EXTRACTOR ROUTINE (Handles actual .xlsx AND fake .csv files)
      const workbook = XLSX.read(dataUint8, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert rows directly into clean array objects
      const parsedRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      
      setData(parsedRows);
      await saveDataLocally(parsedRows); // Init memory bank baseline

    } else {
      // 📋 CSV TEXT EXTRACTOR ROUTINE
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(dataUint8);

      if (!text || text.trim().length === 0) throw new Error("File contains no data.");

      const lines = text.split('\n').map(l => l.trim()).filter(line => line !== '');
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.trim());
        const parsedRows = lines.slice(1).map((line) => {
          const values = line.split(',');
          let obj: any = {};
          headers.forEach((header, index) => {
            // obj[header] = values[index]?.trim() || "";
            obj[header] = (values[index] || "")
            .trim()
            .replace(/^"|"$/g, "");
          });
          return obj;
        });
        
        setData(parsedRows);
        await saveDataLocally(parsedRows); // Init memory bank baseline
      }
    }
  } catch (err: any) {
    console.error("Fetch Logic Error:", err.message);
    Alert.alert("Data connection notice", "Couldn't read from cloud. Restoring local cache baseline if available.");
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
        summary[header] = { type: "QUANTITATIVE", range: `${min} to ${max}`, average: avg.toFixed(2) };
      } else if (uniqueValues.size < 20) {
        const counts = values.reduce((acc: any, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
        summary[header] = { type: "CATEGORICAL", counts: counts };
      } else {
        summary[header] = { type: "LABEL", uniqueCount: uniqueValues.size, example: values[0] };
      }
    });

    return `[TOTAL RECORDS]: ${totalRows}\n[COLUMN PROFILES]: ${JSON.stringify(summary, null, 2)}\n[SAMPLE RECORD]: ${JSON.stringify(data[0])}`;
  };

  const applyCleaningAction = async (action: string, column: string, filterStr: string, logicStr: string) => {
    try {
      let updatedData = [...data];

      if (action === "DELETE") {
        const filterFn = new Function('row', `return ${filterStr || 'false'}`);
        updatedData = data.filter((row) => { try { return !filterFn(row); } catch (e) { return true; } });
        Alert.alert("Rows Deleted", "Matching records removed.");
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
            } catch (e) { newValue = value; }
          } else { newValue = logicStr; }
          return { ...row, [column]: newValue };
        });
        Alert.alert("Data Updated", `Modified column: ${column}`);
      } else if (action === "ADD_COLUMN") {
        updatedData = data.map((row) => {
          let evaluatedValue = "";
          if (logicStr && logicStr.includes('row[')) {
            try {
              const dynamicLogicFn = new Function('row', `return ${logicStr}`);
              evaluatedValue = String(dynamicLogicFn(row));
            } catch (e) { evaluatedValue = ""; }
          } else {
            evaluatedValue = typeof logicStr === 'string' ? logicStr.replace(/^'|'$/g, '') : String(logicStr || "");
          }
          return { ...row, [column]: evaluatedValue };
        });
        Alert.alert("Column Created", `Added column: "${column}"`);
      } else if (action === "ADD_ROW") {
        const targetRowData = (pendingEdit as any)?.rowData;
        if (targetRowData) {
          updatedData.push(targetRowData);
          Alert.alert("Record Appended", "Pushed row entry to bottom of table view.");
        }
      } else if (action === "DROP_COLUMN") {
        updatedData = data.map((row) => { const { [column]: _, ...rest } = row; return rest; });
        Alert.alert("Column Removed", `Dropped column "${column}".`);
      }

      setData(updatedData);
      await saveDataLocally(updatedData); // Trigger background memory write session

    } catch (globalError) {
      Alert.alert("Execution Error", "Could not execute calculation logic blueprint.");
    }
  };

  const handleConfirmEdit = () => {
    if (!pendingEdit) return;
    setHistory((prev) => [...prev, [...data]]);
    setRedoStack([]);
    applyCleaningAction(pendingEdit.editType, pendingEdit.column, pendingEdit.filter, pendingEdit.logic);
    setIsPreviewVisible(false);
    setPendingEdit(null);
    setPreviewRows([]);
  };

  const handleUndo = async () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setRedoStack((prev) => [...prev, [...data]]);
    setData(previousState);
    setHistory((prev) => prev.slice(0, -1));
    await saveDataLocally(previousState);
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setHistory((prev) => [...prev, [...data]]);
    setData(nextState);
    setRedoStack((prev) => prev.slice(0, -1));
    await saveDataLocally(nextState);
  };

  const callGeminiAI = async (userPrompt: string) => {
  try {
    const dataSnapshot = getDataSummary();

    const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

    console.log("========== GEMINI DEBUG ==========");
    console.log("Platform:", Platform.OS);
    console.log("API KEY EXISTS:", !!API_KEY);

    if (!API_KEY) {
      console.log("❌ API KEY MISSING");
      return "Error: API Key missing.";
    }

    const API_URL =
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    const fullPrompt = `
${BUBBLE_AI_SYSTEM_PROMPT}

CONTEXT:
${dataSnapshot}

COMMAND:
${userPrompt}
`;

    console.log("🚀 Sending request to Gemini...");

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: fullPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000,
        },
      }),
    });

    console.log("📡 Status:", response.status);

    const responseText = await response.text();

    console.log("📥 RAW RESPONSE:");
    console.log(responseText);

    if (!response.ok) {
      return `Gemini Error (${response.status})`;
    }

    const result = JSON.parse(responseText);

    console.log("✅ Parsed Result:");
    console.log(JSON.stringify(result, null, 2));

    const aiText =
      result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      console.log("❌ No text found in Gemini response");
      return "Unexpected response format.";
    }

    console.log("🤖 AI RESPONSE:");
    console.log(aiText);

    return aiText;

  } catch (err: any) {
    console.log("🔥 GEMINI CRASH:");
    console.log(err);
    console.log(err?.message);

    return `Trouble connecting to Gemini engine: ${err?.message || "Unknown error"}`;
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
          const count = data.filter((row) => { try { return filterFn(row); } catch (e) { return false; } }).length;
          const finalAnswer = await callGeminiAI(`The exact count for "${userText}" is ${count}. Give me a final natural answer.`);
          setMessages((prev) => [...prev, { role: 'model', parts: [{ text: finalAnswer }] }]);
        } else if (parsed.action === "EDIT") {
          setPendingEdit({ editType: parsed.editType, column: parsed.column || '', filter: parsed.filter || '', logic: parsed.logic || '', rowData: parsed.rowData || null } as any);
          let generatedPreviews: any[] = [];

          if (parsed.editType === "ADD_ROW") {
            generatedPreviews = [{ original: { "Status": "New Row Entry Template" }, modified: parsed.rowData || {} }];
          } else if (parsed.editType === "ADD_COLUMN") {
            generatedPreviews = data.slice(0, 3).map((row) => {
              let evaluatedValue = "";
              if (parsed.logic && String(parsed.logic).includes('row[')) {
                try { evaluatedValue = String(new Function('row', `return ${parsed.logic}`)(row)); } catch (e) { evaluatedValue = "Error"; }
              } else { evaluatedValue = typeof parsed.logic === 'string' ? parsed.logic.replace(/^'|'$/g, '') : String(parsed.logic || ""); }
              return { original: row, modified: { ...row, [parsed.column]: evaluatedValue } };
            });
          } else {
            const filterFn = parsed.filter ? new Function('row', `return ${parsed.filter}`) : () => true;
            const sampleAffected = data.filter(row => filterFn(row)).slice(0, 3);
            generatedPreviews = sampleAffected.map((row) => {
              let originalValue = String(row[parsed.column] || "");
              let newValue = parsed.editType === "UPDATE" ? (parsed.logic?.includes?.('row[') ? String(new Function('row', `return ${parsed.logic}`)(row)) : parsed.logic) : "❌ ROW WILL BE DELETED";
              return { original: row, modified: { ...row, [parsed.column]: newValue } };
            });
          }
          setPreviewRows(generatedPreviews);
          setIsPreviewVisible(true);
        } else {
          setMessages((prev) => [...prev, { role: 'model', parts: [{ text: parsed.message || aiResponseText }] }]);
        }
      } catch (e) {
        setMessages((prev) => [...prev, { role: 'model', parts: [{ text: aiResponseText }] }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'model', parts: [{ text: "Error encountered." }] }]);
    }
  };

  const handleExportAndDownload = async () => {
    if (!data || data.length === 0) return;
    setIsSaving(true);
    try {
      const headers = Object.keys(data[0]);
      const csvString = [headers.join(','), ...data.map(row => headers.map(fieldName => `"${String(row[fieldName] || '').replace(/"/g, '""')}"`).join(','))].join('\n');
      const rawName = typeof fileName === 'string' ? fileName : 'dataset.csv';
      
      await supabase.storage.from('datasets').upload(rawName, csvString, { contentType: 'text/csv', upsert: true });
      let targetDirectory = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || 'file:///data/user/0/host.exp.exponent/cache/';
      const localUri = targetDirectory.endsWith('/') ? `${targetDirectory}${rawName}` : `${targetDirectory}/${rawName}`;
      
      await FileSystem.writeAsStringAsync(localUri, csvString, { encoding: 'utf8' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, { mimeType: 'text/csv', dialogTitle: 'Download Dataset' });
      } else {
        Alert.alert("Saved Successfully", "Uploaded back to your cloud account registry.");
      }
    } catch (error: any) { Alert.alert("Export Failed", error.message); } finally { setIsSaving(false); }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? -30 : 0}>
        
        {/* HEADER AREA */}
        <View style={[styles.header, { backgroundColor: colors.background, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 15 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <MaterialCommunityIcons name="arrow-left" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>AI Cleaning Hub</Text>
              <Text numberOfLines={1} style={[styles.subtitle, { color: colors.accent }]}>{fileName || 'Workspace'}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleExportAndDownload} disabled={isSaving} style={{ padding: 8, borderRadius: 8, backgroundColor: isSaving ? colors.surface : colors.accentSoft, marginLeft: 10 }}>
            {isSaving ? <ActivityIndicator size="small" color={colors.accent} /> : <MaterialCommunityIcons name="download" size={24} color={colors.accent} />}
          </TouchableOpacity>
        </View>

        {/* MAIN DATA SPREADSHEET */}
        <View style={[styles.content, { flex: messages.length > 1 ? 0.6 : 1.2, backgroundColor: colors.surface, borderColor: colors.border }]}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading workspace dataset state...</Text>
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
                <FlatList data={data} extraData={data} keyExtractor={(_, idx) => idx.toString()} renderItem={({ item }) => (
                  <View style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                    {Object.values(item).map((val: any, i) => (
                      <View key={i} style={[styles.cell, { borderRightColor: colors.border }]}>
                        <Text style={[styles.cellText, { color: colors.textPrimary }]} numberOfLines={1}>{val}</Text>
                      </View>
                    ))}
                  </View>
                )} />
              </View>
            </ScrollView>
          ) : (
            <View style={styles.center}>
               <MaterialCommunityIcons name="database-off" size={60} color={colors.textMuted} />
               <Text style={[styles.placeholder, { color: colors.textMuted }]}>No rows found.</Text>
            </View>
          )}
        </View>

        {/* CHAT LOG SCREEN */}
        <View style={{ flex: messages.length > 1 ? 1.4 : 0.4, marginBottom: 5 }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 15, paddingVertical: 10 }} showsVerticalScrollIndicator={true} ref={chatScrollViewRef} onContentSizeChange={() => chatScrollViewRef.current?.scrollToEnd({ animated: true })}>
            {messages.map((msg, idx) => (
              <View key={idx} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', backgroundColor: msg.role === 'user' ? colors.accent : colors.surface, padding: 12, borderRadius: 15, marginBottom: 8, maxWidth: '85%', borderWidth: msg.role === 'model' ? 1 : 0, borderColor: colors.border }}>
                <Text style={{ color: msg.role === 'user' ? 'white' : colors.textPrimary, fontSize: 13 }}>{msg.parts[0].text}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* UNDO / REDO CONTROLS */}
        {(history.length > 0 || redoStack.length > 0) && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10, gap: 12 }}>
            {history.length > 0 && (
              <TouchableOpacity onPress={handleUndo} style={[styles.controlBtn, { backgroundColor: isDark ? '#374151' : '#E5E7EB', borderColor: isDark ? '#4B5563' : '#D1D5DB' }]}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#E5E7EB' : '#374151' }}>↩️ Undo ({history.length})</Text>
              </TouchableOpacity>
            )}
            {redoStack.length > 0 && (
              <TouchableOpacity onPress={handleRedo} style={[styles.controlBtn, { backgroundColor: isDark ? '#374151' : '#E5E7EB', borderColor: isDark ? '#4B5563' : '#D1D5DB' }]}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#E5E7EB' : '#374151' }}>Redo ({redoStack.length}) ↪️</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* BOT FOOTER TERMINAL INPUT ROW */}
        <View style={[styles.chatContainer, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 10, marginHorizontal: 15 }]}>
          <TouchableOpacity style={[styles.magicButton, { backgroundColor: colors.background }]}>
            <MaterialCommunityIcons name="auto-fix" size={20} color={colors.accent} />
          </TouchableOpacity>
          <TextInput style={[styles.input, { color: colors.textPrimary, flex: 1 }]} placeholder="Ask Bubble AI..." placeholderTextColor={colors.textMuted} value={message} onChangeText={setMessage} onSubmitEditing={handleSendMessage} />
          <TouchableOpacity onPress={handleSendMessage} style={[styles.sendButton, { backgroundColor: colors.accent }]}>
            <MaterialCommunityIcons name="arrow-up" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {Platform.OS === 'ios' && <View style={{ height: insets.bottom + 10 }} />}
      </KeyboardAvoidingView>
      {Platform.OS === 'android' && <View style={{ height: insets.bottom + 10 }} />}

      {/* PREVIEW CONTAINER INTERACTION MODAL */}
      <Modal visible={isPreviewVisible} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 }}>Confirm Data Transformation</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 20 }}>Previewing row changes before running the universal matrix computation engine:</Text>
            <ScrollView style={{ marginBottom: 20 }}>
              {previewRows.map((row, i) => (
                <View key={i} style={{ padding: 12, borderRadius: 12, backgroundColor: colors.background, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontWeight: 'bold', color: '#ff4444', fontSize: 12, marginBottom: 2 }}>BEFORE:</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }} numberOfLines={2}>{JSON.stringify(row.original)}</Text>
                  <Text style={{ fontWeight: 'bold', color: '#00C851', fontSize: 12, marginBottom: 2 }}>AFTER CHANGE:</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 12 }} numberOfLines={2}>{JSON.stringify(row.modified)}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => { setIsPreviewVisible(false); setPendingEdit(null); }} style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: isDark ? '#374151' : '#F3F4F6', alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirmEdit} style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold', color: 'white' }}>Apply & Auto-Save ✨</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { padding: 10, marginLeft: 5, marginRight: 5 },
  header: { paddingVertical: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  content: { flex: 1, margin: 15, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, fontSize: 14 },
  placeholder: { marginTop: 10, fontSize: 14, textAlign: 'center' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 2, paddingVertical: 10 },
  headerCell: { width: 120, paddingHorizontal: 10, borderRightWidth: 1, justifyContent: 'center' },
  headerText: { fontSize: 13, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 12, alignItems: 'center' },
  cell: { width: 120, paddingHorizontal: 10, borderRightWidth: 1, justifyContent: 'center' },
  cellText: { fontSize: 12 },
  chatContainer: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 24, borderWidth: 1 },
  magicButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  input: { marginLeft: 10, fontSize: 14, paddingVertical: 6 },
  sendButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
  controlBtn: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, alignItems: 'center' }
});

export default CleaningScreen;