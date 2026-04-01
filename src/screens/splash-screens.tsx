import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { MotiView, MotiText } from 'moti'; // Moti for simple, powerful animations
import { useAppTheme } from '../../constants/useAppTheme'; // Our custom theme hook
import Logo from '../../components/logo'; // The SVG Logo component we made

// Get screen width to make the logo responsive
const { width } = Dimensions.get('window');

const SplashScreen = () => {
  // Access our Mint and Navy colors
  const { colors, spacing } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* Container for the Logo with a pop-in effect */}
      <MotiView
        from={{ opacity: 0, scale: 0.5 }} // Start tiny and invisible
        animate={{ opacity: 1, scale: 1 }} // End at full size and visible
        transition={{
          type: 'spring', // Adds a natural 'bounce' to the pop-in
          duration: 1500,
        }}
      >
        <Logo width={width * 0.4} height={width * 0.4} />
      </MotiView>

      {/* Animated Text for the App Name */}
      <MotiText
        from={{ opacity: 0, translateY: 20 }} // Start slightly below its position
        animate={{ opacity: 1, translateY: 0 }} // Slide up into position
        transition={{
          type: 'timing',
          duration: 1000,
          delay: 500, // Wait 0.5 seconds so the logo starts first
        }}
        style={[
          styles.title, 
          { color: colors.textPrimary, marginTop: spacing.lg }
        ]}
      >
        DataClean AI
      </MotiText>

      {/* Subtle tagline that fades in last */}
      <MotiText
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1200 }} // Wait 1.2 seconds
        style={[styles.subtitle, { color: colors.textMuted }]}
      >
        Precision in every byte.
      </MotiText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center', // Center content vertically
    alignItems: 'center',     // Center content horizontally
  },
  title: {
    fontSize: 32,
    fontWeight: '800', // Bold, premium look
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    marginTop: 8,
  },
});

export default SplashScreen;