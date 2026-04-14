import React, { useState, useEffect, useRef } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../supabaseClient'; 
import { useAppTheme } from '../../constants/useAppTheme';
import { StatusBar } from 'expo-status-bar';


// This prompt will be sent to Bubble AI to set the context and rules for how it should assist the user in cleaning their dataset.
const BUBBLE_AI_SYSTEM_PROMPT = `
You are Bubble AI, a specialized Data Cleaning Expert. 
Your goal is to help the user clean messy datasets.

### DATA CONTEXT:
- You will be provided with the "Headers" and the "First 5 Rows" of a dataset.
- The file might contain up to 10,000 rows, so you must suggest logic that applies to the WHOLE column, not just the sample.

### YOUR RULES:
1. If the user asks a general question, respond in plain text.
2. If the user asks to "Clean", "Delete", "Format", or "Edit" data, you MUST respond with a JSON object.
3. Never guess data. If a column like "Latitude" is messy, suggest a way to verify it rather than making up numbers.

### JSON OUTPUT FORMAT:
When performing an action, your entire response must be a single JSON block:
{
  "action": "TYPE_OF_ACTION",
  "column": "COLUMN_NAME",
  "logic": "DESCRIPTION_OF_CLEANING_LOGIC",
  "message": "A brief explanation for the user"
}
`;


const CleaningScreen = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, spacing, radius } = useAppTheme();
  const router = useRouter();
  const { fileName } = useLocalSearchParams();
  const [message, setMessage] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const chatScrollViewRef = useRef<ScrollView>(null);


  // Initial system message to greet the user and set the context for Bubble AI
const [messages, setMessages] = useState([
  {
  role: 'model',
  parts: [{text: "Hello! I'm Bubble AI, your data cleaning assistant. I see you've uploaded a dataset. How can I help you clean it today?"

  }]
  },

]);


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



const getDataSummary = () => {
  if (data.length === 0) return "The dataset is currently empty.";

  const headers = Object.keys(data[0]);
  
  // 1. STATS ENGINE: Calculate counts for ALL columns automatically
  // This gives Gemini the "answers" without sending 500 rows of text.
  const stats = headers.reduce((acc: any, header) => {
    const values = data.map(row => row[header]);
    const uniqueCount = new Set(values).size;
    
    // If a column has few unique values (like Gender), count them!
    if (uniqueCount < 10) {
      acc[header] = values.reduce((counts: any, v) => {
        counts[v] = (counts[v] || 0) + 1;
        return counts;
      }, {});
    } else {
      acc[header] = `Contains ${uniqueCount} unique values.`;
    }
    return acc;
  }, {});

  return `
    FACTS (Trust these for totals):
    - Rows: ${data.length}
    - Columns: ${headers.join(", ")}
    - Detailed Stats: ${JSON.stringify(stats)}

    SAMPLE (First 3 rows only):
    ${data.slice(0, 3).map(row => JSON.stringify(Object.values(row))).join("\n")}

    USER INSTRUCTION: Use the "Detailed Stats" above to answer counts/totals instantly.
  `;
};



// ─── THE ACTION ENGINE: EDITING THE DATA ───────────────────────
 const applyCleaningAction = (action: string, column: string, logic: string) => {
  const updatedData = data.map((row) => {
    let value = String(row[column] || "");

    if (action === "FIX_GENDER") {
      return { ...row, [column]: value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() };
    }
    if (action === "REMOVE_WHITESPACE") {
      return { ...row, [column]: value.trim() };
    }
    // NEW: Generic Logic (Add more specific cases as you discover them!)
    if (action === "CAPITALIZE_ALL") {
      return { ...row, [column]: value.toUpperCase() };
    }

    return row; 
  });

  setData(updatedData);
  Alert.alert("Data Updated", `Applied cleaning to: ${column}`);
};







 // ─── THE BRAIN: CALLING GEMINI AI ──────────────────────────────
 const callGeminiAI = async (userPrompt: string) => {
  try {
   const dataSnapshot = getDataSummary(); 
   
   // Pulling the key from your .env file
   const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
   
   // Log to verify key is loaded (Should show 'true' in terminal)
   console.log("API Key Loaded:", !!API_KEY); 

   if (!API_KEY) {
    return "Error: API Key is missing. Check your .env file and restart Expo.";
   }

   const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

   const fullPrompt = `
    ${BUBBLE_AI_SYSTEM_PROMPT}
    
    HERE IS THE DATASET CONTEXT:
    ${dataSnapshot}

    USER COMMAND:
    ${userPrompt}
   `;

   console.log("Sending to Gemini...");

   const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
     contents: [{ parts: [{ text: fullPrompt }] }],
     generationConfig: {
       temperature: 0.1,
       maxOutputTokens: 1000,
     }
    }),
   });
   if (response.status === 503 || response.status === 429) {
  // Wait 2 seconds and retry once
  await new Promise(res => setTimeout(res, 2000));
  return callGeminiAI(userPrompt); 
}

   const result = await response.json();

   if (result.candidates && result.candidates[0].content.parts[0].text) {
    return result.candidates[0].content.parts[0].text;
   } else {
    console.error("Gemini Error Detail:", result);
    return "I received an unexpected response format from the AI.";
   }

  } catch (err) {
   console.error("Gemini Connection Error:", err);
   return "I'm having trouble connecting to Gemini. Please check your connection.";
  }
 };




  // ─── MESSAGE HANDLING LOGIC ──────────────────────────────────────
  const handleSendMessage = async () => {
    if (message.trim() === '') return;

    const userText = message;
    setMessage(''); // Clear input immediately for better UX

    // 1. Add User's message to the chat
    const newUserMessage = { role: "user", parts: [{ text: userText }] };
    setMessages((prev) => [...prev, newUserMessage]);

    // 2. Add a temporary "Thinking..." bubble so the user knows AI is working
    const thinkingMessage = { role: "model", parts: [{ text: "Thinking..." }] };
    setMessages((prev) => [...prev, thinkingMessage]);

    // 3. Call the Gemini Brain
    const aiResponse = await callGeminiAI(userText);

    // 4. Replace "Thinking..." with the actual AI response
    setMessages((prev) => {
      const chatHistory = [...prev];
      chatHistory.pop(); // Remove the "Thinking..." bubble
      return [...chatHistory, { role: "model", parts: [{ text: aiResponse }] }];
    });

    // 5. THE ACTION ENGINE: Check if Gemini sent a JSON command to edit data
    try {
      if (aiResponse.includes("{") && aiResponse.includes("}")) {
        const jsonStart = aiResponse.indexOf("{");
        const jsonEnd = aiResponse.lastIndexOf("}") + 1;
        const jsonString = aiResponse.substring(jsonStart, jsonEnd);
        
        const cleanCommand = JSON.parse(jsonString);

        // If it's a valid cleaning action, run the engine!
        if (cleanCommand.action && cleanCommand.column) {
          console.log("AI Action Detected:", cleanCommand.action);
          applyCleaningAction(
            cleanCommand.action, 
            cleanCommand.column, 
            cleanCommand.logic
          );
        }
      }
    } catch (e) {
      console.log("No valid JSON action found in response.");
    }
  };



  // ─── DYNAMIC UI RENDERING ──────────────────────────────────────
  return (
  <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
    <StatusBar style="light" />

    {/* 1. KEYBOARD AVOIDING VIEW WRAPS EVERYTHING */}
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? -30 : 0} // Using your HomeScreen "Golden" settings
    >
      
      {/* 2. HEADER AREA */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>AI Cleaning Hub</Text>
          <Text style={[styles.subtitle, { color: colors.accent }]}>{fileName || 'Dataset Preview'}</Text>
        </View>
      </View>

      {/* 3. MAIN CONTENT (TABLE) - Set to flex: 1 so it shrinks when keyboard opens */}
      <View style={[
  styles.content, 
  { 
    // If messages > 1 (meaning user has started chatting), shrink the table
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
                extraData={data} // Force re-render when data changes
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
             <Text style={[styles.placeholder, { color: colors.textMuted }]}>No data found.</Text>
          </View>
        )}
      </View>

      {/* 4. CHAT MESSAGES AREA */}
      <View style={{ 
  // If messages > 1, grow the chat area to take more space
  flex: messages.length > 1 ? 1.4 : 0.4, 
  marginBottom: 5 
}}>
        <ScrollView 
    contentContainerStyle={{ paddingHorizontal: 15, paddingVertical: 10 }}
    showsVerticalScrollIndicator={true}
    // Autoscroll to bottom code
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

      {/* 5. INPUT BAR AREA */}
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

        <TouchableOpacity 
          onPress={handleSendMessage}
          style={[styles.sendButton , { backgroundColor: colors.accent }]}
        >
          <MaterialCommunityIcons name="arrow-up" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Space for the bottom inset */}
       {Platform.OS === 'ios' && <View style={{ height: insets.bottom + 10 }} />}
      

    </KeyboardAvoidingView>
    {Platform.OS === 'android' && <View style={{ height: insets.bottom + 10 }} />}
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
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CleaningScreen;