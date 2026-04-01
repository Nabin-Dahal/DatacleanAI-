import { useColorScheme } from 'react-native';
import theme from './theme'; // This imports your color list

export const useAppTheme = () => {
  // 1. Check if the system is 'light' or 'dark'
  const colorScheme = useColorScheme();
  
  // 2. Boolean check (true/false)
  const isDark = colorScheme === 'dark';

  // 3. Pick the color set based on the mode
  const colors = isDark ? theme.dark : theme.light;

  // 4. Return everything the screen needs
  return {
    colors,
    isDark,
    spacing: theme.spacing,
    radius: theme.radius,
    fontSize: theme.fontSize,
  };
};