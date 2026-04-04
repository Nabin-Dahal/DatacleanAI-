// src/screens/login-screen.tsx
// Full Login Screen with animations, validation and social login

import { useState } from 'react';
import {
  View, 
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { MotiView, MotiText } from 'moti';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../constants/useAppTheme';
import Logo from '../../components/logo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6, AntDesign } from '@expo/vector-icons';
import { Alert } from 'react-native';
import { supabase } from '../../supabaseClient';

const LoginScreen = () => {
  // ─── Theme ───────────────────────────────────────────────
  const { colors, spacing, radius, fontSize } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets(); // Get safe area insets for padding

  // ─── State ───────────────────────────────────────────────
  // State holds the current value of each input field
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  // ─── Validation ──────────────────────────────────────────
  // Checks if email and password are valid before submitting
  const validate = () => {
    let valid = true;

    // Reset errors first
    setEmailError('');
    setPasswordError('');

    // Check email format
    if (!email.includes('@') || !email.includes('.')) {
      setEmailError('Please enter a valid email address');
      valid = false;
    }

    // Check password length
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      valid = false;
    }

    return valid;
  };

  // ─── Login Handler ───────────────────────────────────────
const handleLogin  = async () => {
  if(!email || !password) {
    Alert.alert('Validation Error', 'Please enter both email and password');
    return;
  }

  // Also, it's a good idea to run your validate() function here 
  // to check for the @ sign and password length
  if (!validate()) {
    return;
  }

  setLoading(true); // Start loading state

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  

  setLoading(false); // End loading state

  if (error) {
    Alert.alert('Login Failed', error.message);
  } else if (data.user) {
    // Navigate to your main app screen (usually 'index' or '(tabs)')
    router.replace('/home'); // Replace with your actual home screen route
    console.log('Logged in as:', data.user.email);
  }
};



  // ─── UI ──────────────────────────────────────────────────
  return (
    // KeyboardAvoidingView pushes content up when keyboard opens
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { backgroundColor: colors.background }, // Ensure background color covers entire scroll area
          { paddingTop: insets.top + 40 },
          // { paddingTop: Platform.OS === 'android' ? insets.top + 50 : insets.top + 20,}, // Add top padding for safe area
        ]}
        keyboardShouldPersistTaps="handled" // Allows tapping outside inputs to dismiss keyboard
      >

        {/* ── Logo — fades in first ── */}
        <MotiView
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', duration: 1000 }}
          style={{ alignItems: 'center', marginBottom: spacing.sm }}
        >
          <Logo width={80} height={80} />
        </MotiView>

        {/* ── App Name ── */}
        <MotiText
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 600, delay: 200 }}
          style={[
            styles.appName,
            { color: colors.textPrimary, fontSize: fontSize.xl },
          ]}
        >
          Data-Clean AI
        </MotiText>

        {/* ── Welcome Text ── */}
        <MotiText
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 600, delay: 350 }}
          style={[
            styles.welcome,
            { color: colors.textMuted, fontSize: fontSize.md },
          ]}
        >
          Welcome to Data Clean AI
        </MotiText>

        {/* ── Email Input ── */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 450 }}
          style={{ width: '100%' }}
        >
          <TextInput
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: emailError ? colors.error : colors.border,
                color: colors.textPrimary,
                borderRadius: radius.full,
                // fontSize: fontSize.md,
                // paddingHorizontal: spacing.lg,
                // paddingVertical: spacing.md,
              },
            ]}
          />
          {/* Show error message if email is invalid */}
          {emailError ? (
            <Text style={[styles.errorText, { color: colors.error }]}>
              {emailError}
            </Text>
          ) : null}
        </MotiView>

        {/* ── Password Input ── */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 550 }}
          style={{ width: '100%' }}
        >
          <View>
            <TextInput
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: passwordError ? colors.error : colors.border,
                  color: colors.textPrimary,
                  borderRadius: radius.full,
                  //fontSize: fontSize.md,
                  //paddingHorizontal: spacing.lg,
                  //paddingVertical: spacing.md,
                },
              ]}
            />
            {/* Show/Hide password toggle */}
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>
          {/* Show error if password too short */}
          {passwordError ? (
            <Text style={[styles.errorText, { color: colors.error }]}>
              {passwordError}
            </Text>
          ) : null}
        </MotiView>

        {/* ── Login Button ── */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 650 }}
          style={{ width: '100%' }}
        >
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading} // Disable button while loading to prevent multiple taps
            style={[
              styles.loginButton,
              {
                backgroundColor: colors.accent,
                borderRadius: radius.full,
                paddingVertical: spacing.md,
                marginTop: spacing.sm,
                opacity: loading ? 0.7 : 1, // Slightly fade button when loading
              },
            ]}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
            <Text style={[styles.loginButtonText, { fontSize: fontSize.md }]}>
              Login
            </Text>
            )}
          </TouchableOpacity>
        </MotiView>

        {/* ── Forgot / Sign Up Links ── */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 500, delay: 700 }}
          style={styles.linksRow}
        >
          <TouchableOpacity onPress={() => router.push('/forgot-password')}>
            <Text style={[styles.linkText, { color: colors.accent, fontSize: fontSize.sm }]}>
              Forgot Password?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={[styles.linkText, { color: colors.accent, fontSize: fontSize.sm }]}>
              Don't have account? Sign up
            </Text>
          </TouchableOpacity>
        </MotiView>

        {/* ── OR Divider ── */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 500, delay: 750 }}
          style={styles.dividerRow}
        >
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textMuted, fontSize: fontSize.sm }]}>
            or
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </MotiView>

        {/* ── Social Login Buttons ── */}
        {[
          { label: 'Continue with Google', 
            icon: <AntDesign name="google" size={20}color="#4285F4" />, 
            key: 'google'},
          { label: 'Continue with Apple',
            icon: <FontAwesome6 name="apple" size={20} color={colors.textPrimary} />,
            key: 'apple' },
          { label: 'Continue with X',
            icon: <FontAwesome6 name="x-twitter" size={20} color={colors.textPrimary} />,
            key: 'x' },
        ].map((item, index) => (
          <MotiView
            key={item.key}
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 800 + index * 100 }}
            style={{ width: '100%' }}
          >
            <TouchableOpacity
              style={[
                styles.socialButton,
                {
                  borderColor: colors.border,
                  borderRadius: radius.full,
                  paddingVertical: spacing.md,
                  backgroundColor: colors.surface,
                  marginBottom: spacing.sm,
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={[styles.socialIcon, { fontSize: fontSize.md }]}>
                {item.icon}
              </Text>
              <Text style={[styles.socialText, { color: colors.textPrimary, fontSize: fontSize.md }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          </MotiView>
        ))}

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    // paddingTop: 60,
    paddingBottom: 40,
  },
  appName: {
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  welcome: {
    fontWeight: '400',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    marginBottom: 12,
    height: 56,
    paddingHorizontal:20,
    justifyContent: 'center',
  },
  eyeButton: {
    position: 'absolute',
    right: 20,
    top: 14,
  },
  errorText: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 16,
  },
  loginButton: {
    width: '100%',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
    marginBottom: 24,
  },
  linkText: {
    fontWeight: '500',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    width: '100%',
    gap: 10,
  },
  socialIcon: {
    fontWeight: '600',
  },
  socialText: {
    fontWeight: '500',
  },
});

export default LoginScreen;