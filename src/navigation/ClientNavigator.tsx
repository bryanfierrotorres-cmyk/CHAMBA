import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClientHomeScreen }    from '@features/client/screens/ClientHomeScreen';
import { CreateJobFormScreen } from '@features/client/screens/CreateJobFormScreen';
import { ClientOrdersScreen }  from '@features/client/screens/ClientOrdersScreen';
import { ClientCompletedJobScreen } from '@features/client/screens/ClientCompletedJobScreen';
import { JobChatScreen } from '@features/chat/screens/JobChatScreen';
import { ClientProfileScreen } from '@features/client/screens/ClientProfileScreen';
import { WhatsAppBubble }      from '@components/WhatsAppBubble';
import { PendingAccountScreen } from '@components/auth/PendingAccountScreen';
import { ClientJobPlatformGate } from '@components/client/ClientJobPlatformGate';
import { ClientJobStatusToast } from '@components/client/ClientJobStatusToast';
import { useAuthStore } from '@store/authStore';
import { webAppShellStyle, webFixedTabBarStyle, webTabScenePadding } from '@constants/webMobileLayout';
import type { ClientTabParamList, ClientStackParamList, ClientOrdersStackParamList } from '@/types';

const CYAN = '#00F2FE';
const SLATE_MUTED = '#94A3B8';

const Tab        = createBottomTabNavigator<ClientTabParamList>();
const Stack      = createNativeStackNavigator<ClientStackParamList>();
const OrdersStack = createNativeStackNavigator<ClientOrdersStackParamList>();

const ClientOrdersNavigator: React.FC = () => (
  <OrdersStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <OrdersStack.Screen name="ClientOrdersList" component={ClientOrdersScreen} />
    <OrdersStack.Screen name="ClientCompletedJob" component={ClientCompletedJobScreen} />
    <OrdersStack.Screen name="JobChat" component={JobChatScreen} />
  </OrdersStack.Navigator>
);

const HomeStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <Stack.Screen name="CategoryGrid"  component={ClientHomeScreen} />
    <Stack.Screen name="CreateJobForm" component={CreateJobFormScreen} />
  </Stack.Navigator>
);

type TabRoute = keyof ClientTabParamList;

const TAB_CONFIG: Record<TabRoute, { label: string; iconOutline: keyof typeof Ionicons.glyphMap }> = {
  ClientHome:   { label: 'Home',     iconOutline: 'home-outline' },
  ClientOrders: { label: 'Requests', iconOutline: 'receipt-outline' },
  Profile:      { label: 'Profile',  iconOutline: 'person-outline' },
};

const ClientTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[tabStyles.wrap, webFixedTabBarStyle, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const cfg = TAB_CONFIG[route.name as TabRoute];
        const isHome = route.name === 'ClientHome';

        return (
          <TouchableOpacity
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.85}
            style={tabStyles.tabItem}
          >
            {focused && isHome ? (
              <>
                <View style={tabStyles.homeActiveOrb}>
                  <Ionicons name="home" size={22} color="#FFFFFF" />
                </View>
                <Text style={tabStyles.homeLabel}>{cfg.label}</Text>
              </>
            ) : (
              <>
                <Ionicons name={cfg.iconOutline} size={22} color={SLATE_MUTED} />
                <Text style={tabStyles.tabLabel}>{cfg.label}</Text>
              </>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const tabStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 72,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 64,
    flex: 1,
    paddingBottom: 4,
  },
  homeActiveOrb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: CYAN,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  homeLabel: {
    fontSize: 10,
    color: CYAN,
    fontWeight: '600',
    marginTop: 4,
  },
  tabLabel: {
    fontSize: 10,
    color: SLATE_MUTED,
    fontWeight: '500',
    marginTop: 4,
  },
});

export const ClientNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const isPendingApproval = profile?.role === 'client' && !profile.is_approved;

  if (isPendingApproval) {
    return <PendingAccountScreen role="client" />;
  }

  return (
    <ClientJobPlatformGate>
      <View style={webAppShellStyle}>
        <ClientJobStatusToast />
        <Tab.Navigator
          tabBar={(props) => <ClientTabBar {...props} />}
          sceneContainerStyle={Platform.OS === 'web' ? { paddingBottom: webTabScenePadding(insets.bottom) } : undefined}
          screenOptions={{ headerShown: false }}
        >
          <Tab.Screen name="ClientHome"   component={HomeStack} />
          <Tab.Screen name="ClientOrders" component={ClientOrdersNavigator} />
          <Tab.Screen name="Profile"      component={ClientProfileScreen} />
        </Tab.Navigator>
        <WhatsAppBubble bottom={insets.bottom + 72} />
      </View>
    </ClientJobPlatformGate>
  );
};
