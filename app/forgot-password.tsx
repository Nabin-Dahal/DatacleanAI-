import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '@/constants/useAppTheme';  


export default function ForgotPassword() {
    const { colors } = useAppTheme();
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <Text style={{ color: colors.textPrimary }}>Forgot Password Screen (Coming Tomorrow!)</Text>
    </View>
    );
}