// src/screens/register-screen.tsx
// This is the Register Screen component for the DataCleanAI app.
// It includes form fields for email and password, validation logic, and a register button.
// The screen is styled using the app's theme and includes animations with Moti.

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MotiView, MotiText } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AntDesign } from '@expo/vector-icons';
import { useAppTheme } from '@/constants/useAppTheme';

// Assuming these are your theme variables - update paths as needed
// import { colors, spacing, fontSize, radius } from '../constants/theme'; 

const ForgotPasswordScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  // Placeholder for the reset logic
  const handleReset = () => {
    if (!email.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setEmailError('');
    console.log("Reset link sent to:", email);
    // In a real app, you'd trigger Firebase resetPassword here
  };

  // Temporary colors for the code block to work immediately
    const { colors } = useAppTheme();

  const spacing = { sm: 8, md: 16, lg: 24 };
  const fontSize = { sm: 14, md: 16, xl: 28 };
  const radius = { full: 99 };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* 1. Hide the default Header */}
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        
        {/* ── Back Button ── */}
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <AntDesign name="left" size={24} color={colors.accent} />
        </TouchableOpacity>

        {/* ── Title & Icon ── */}

        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', duration: 1000 }}
          style={styles.headerSection}
        >
          <AntDesign name="lock" size={60} color={colors.accent} />
          <MotiText 
            style={[styles.title, { color: colors.textPrimary, fontSize: fontSize.xl }]}
          >


            Forgot Password?
          </MotiText>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Enter your email and we'll send you instructions to reset your password.
          </Text>
        </MotiView>

        {/* ── Input Section ── */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 300 }}
          style={styles.inputContainer}
        >
          <TextInput
            placeholder="Email Address"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[
              styles.input,
              { 
                backgroundColor: colors.surface, 
                color: colors.textPrimary,
                borderColor: emailError ? colors.error : colors.border,
                borderRadius: radius.full
              }
            ]}
          />
          {emailError ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{emailError}</Text>
          ) : null}
        </MotiView>

        {/* ── Action Button ── */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 400 }}
        >
          <TouchableOpacity 
            onPress={handleReset}
            style={[styles.resetButton, { backgroundColor: colors.accent, borderRadius: radius.full }]}
          >
            <Text style={styles.resetButtonText}>Send Reset Link</Text>
          </TouchableOpacity>
        </MotiView>

      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 20,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  input: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderWidth: 1,
    fontSize: 16,
  },
  resetButton: {
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resetButtonText: {
    color: '#0A192F', // Dark Navy for contrast against Mint
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorText: {
    marginTop: 8,
    marginLeft: 15,
    fontSize: 12,
  },
});

export default ForgotPasswordScreen;