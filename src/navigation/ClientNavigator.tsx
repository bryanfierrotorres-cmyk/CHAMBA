import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClientHomeScreen }    from '@features/client/screens/ClientHomeScreen';
import { CreateJobFormScreen } from '@features/client/screens/CreateJobFormScreen';
import { ClientOrdersScreen }  from '@features/client/screens/ClientOrdersScreen';
import { ProfileScreen }       from '@features/workers/screens/ProfileScreen';
import { WhatsAppBubble }      from '@components/WhatsAppBubble';
import { COLORS, FONT_SIZE }   from '@constants/theme';
import type { ClientTabParamList, ClientStackParamList } from '@/types';

const Tab   = createBottomTabNavigator<ClientTabParamList>();
const Stack = createNativeStackNavigator<ClientStackParamList>();

// ─── Home stack: CategoryGrid → CreateJobForm ─────────────────────────────────

const HomeStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <Stack.Screen name="CategoryGrid"  component={ClientHomeScreen} />
    <Stack.Screen name="CreateJobForm" component={CreateJobFormScreen} />
  </Stack.Navigator>
);

// ─── Tab icon helper ──────────────────────────────────────────────────────────

type TabName = 'ClientHome' | 'ClientOrders' | 'Profile';

const TAB_ICONS: Record<TabName, keyof typeof Ionicons.glyphMap> = {
  ClientHome:   'grid',
  ClientOrders: 'receipt',
  Profile:      'person-circle',
};

// ─── Client Tab Navigator ─────────────────────────────────────────────────────

export const ClientNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.bg.card,
          borderTopColor:  COLORS.border.subtle,
          borderTopWidth:  1,
          height:          56 + insets.bottom,
          paddingBottom:   insets.bottom + 6,
          paddingTop:      8,
        },
        tabBarActiveTintColor:   COLORS.brand[500],
        tabBarInactiveTintColor: COLORS.text.muted,
        tabBarLabelStyle: {
          fontSize:   FONT_SIZE.xs,
          fontWeight: '600',
          marginTop:  2,
        },
        tabBarIcon: ({ color, focused, size }) => {
          const base = TAB_ICONS[route.name as TabName] ?? 'grid';
          const name = focused ? base : (`${base}-outline` as keyof typeof Ionicons.glyphMap);
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="ClientHome"
        component={HomeStack}
        options={{ tabBarLabel: 'Servicios' }}
      />
      <Tab.Screen
        name="ClientOrders"
        component={ClientOrdersScreen}
        options={{ tabBarLabel: 'Mis Pedidos' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Perfil' }}
      />
    </Tab.Navigator>
    <WhatsAppBubble bottom={insets.bottom + 72} />
    </View>
  );
};
