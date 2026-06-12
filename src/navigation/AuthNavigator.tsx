import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen }    from '@features/auth/screens/LoginScreen';
import { RegisterScreen } from '@features/auth/screens/RegisterScreen';
import { VerifyOtpScreen } from '@features/auth/screens/VerifyOtpScreen';
import type { AuthStackParamList } from '@/types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => (
  <Stack.Navigator
    initialRouteName="Login"
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      contentStyle: { backgroundColor: '#0A0A0A' },
    }}
  >
    <Stack.Screen name="Login"         component={LoginScreen} />
    <Stack.Screen name="Register"      component={RegisterScreen} />
    <Stack.Screen name="VerifyOtp"     component={VerifyOtpScreen} />
    {/* RoleSelection ahora es el Step 2 interno de RegisterScreen */}
    <Stack.Screen name="RoleSelection" component={RegisterScreen} />
  </Stack.Navigator>
);
