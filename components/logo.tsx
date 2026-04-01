import * as React from "react";
import { useColorScheme, View } from "react-native";
import Svg, { Path, Rect, G } from "react-native-svg";

import theme from "../constants/theme"; // Adjust path if necessary

const Logo = ({ width = 120, height = 120 }) => {
  const colorScheme = useColorScheme() ?? 'light';
  
  // Use the theme's textPrimary color for the "D" shape
  // This ensures it' Navy (#091C3C) in light mode and White (#F0F6FF) in dark mode
  const dynamicColor = theme[colorScheme].textPrimary;
  
  // Use the brand mint color for the square
  const mintColor = theme.mint;

  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Svg viewBox="0 0 4000 4000" width="100%" height="100%">
        <G>
          {/* Mint Square — stays consistent per your brand colors */}
          <Rect 
            fill={mintColor} 
            x="228.42" 
            y="183.89" 
            width="903.58" 
            height="957.38" 
          />
          
          {/* The "D" Shape — now pulls from your theme's primary text color */}
          <Path 
            fill={dynamicColor} 
            d="M1221.47,183.89v957.26h1109.35c360.87,144.1,608.7,479.05,635.19,858.85,28.91,414.38-210.69,809.85-599.41,984.1h-1145.14v-1681.92c-59.73-3.1-381.4-13.87-653.09,232.61-275.4,249.84-293.08,576.8-295.23,635.19v1646.13h2093.45c136.71-17.77,572.86-92.04,939.37-465.21,313.38-319.07,402.1-679.76,429.43-823.07,19.08-123.17,33.28-264.35,35.79-420.48,3.16-196.75-12.99-371.69-35.79-518.89-25.32-163.72-99.12-487.32-348.91-796.23-401.19-496.14-961.13-589.26-1100.4-608.35h-1064.62Z" 
          />
        </G>
      </Svg>
    </View>
  );
};

export default Logo;