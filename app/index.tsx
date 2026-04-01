import { Text, View } from "react-native";
import SplashScreen from '../src/screens/splash-screens'; // This pulls in our animated screen

// export default function Index() {
//   return (
//     <View
//       style={{
//         flex: 1,
//         justifyContent: "center",
//         alignItems: "center",
//       }}
//     >
//       <Text>Hello World</Text>
//     </View>
//   );
// }


export default function Index() {
  return (
    <SplashScreen />
  );
}