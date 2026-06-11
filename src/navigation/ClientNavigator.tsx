import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { useAuthSessionWarmup } from '@/hooks/useAuthSessionWarmup';
import { webAppShellStyle, webFixedTabBarStyle, webTabScenePadding } from '@constants/webMobileLayout';
import type { ClientTabParamList, ClientStackParamList, ClientOrdersStackParamList } from '@/types';

const CYAN = '#00F2FE';
const SLATE_MUTED = '#94A3B8';

const Tab        = createBottomTabNavigator<ClientTabParamList>();
const Stack      = createNativeStackNavigator<ClientStackParamList>();
const OrdersStack = createNativeStackNavigator<ClientOrdersStackParamList>();

type OrdersBoundaryState = { error: Error | null };

class ClientOrdersErrorBoundary extends React.Component<
  { children: React.ReactNode },
  OrdersBoundaryState
> {
  state: OrdersBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): OrdersBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ClientOrdersErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={ordersBoundaryStyles.wrap} edges={['top']}>
          <Text style={ordersBoundaryStyles.title}>No se pudo abrir Mis Solicitudes</Text>
          <Text style={ordersBoundaryStyles.message}>
            Hubo un problema al mostrar tus servicios. Podés reintentar o volver al inicio.
          </Text>
          <Text style={ordersBoundaryStyles.details}>{this.state.error.message}</Text>
          <TouchableOpacity
            style={ordersBoundaryStyles.btn}
            onPress={() => this.setState({ error: null })}
            activeOpacity={0.88}
          >
            <Text style={ordersBoundaryStyles.btnText}>Reintentar</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const ordersBoundaryStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#F2F4F7',
    padding: 24,
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
  },
  details: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  btn: {
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: '#0284C7',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
});

const ClientOrdersNavigator: React.FC = () => (
  <ClientOrdersErrorBoundary>
    <OrdersStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <OrdersStack.Screen name="ClientOrdersList" component={ClientOrdersScreen} />
      <OrdersStack.Screen name="ClientCompletedJob" component={ClientCompletedJobScreen} />
      <OrdersStack.Screen name="JobChat" component={JobChatScreen} />
    </OrdersStack.Navigator>
  </ClientOrdersErrorBoundary>
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

type NavRoute = {
  name: string;
  state?: {
    index: number;
    routes: NavRoute[];
  };
};

function getFocusedNestedRouteName(route: NavRoute): string | undefined {
  if (!route.state?.routes?.length) return route.name;
  const idx = route.state.index ?? 0;
  const nested = route.state.routes[idx];
  if (!nested) return route.name;
  const deeper = getFocusedNestedRouteName(nested);
  return deeper ?? nested.name;
}

const ClientTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const activeTab = state.routes[state.index];
  const nestedRoute = getFocusedNestedRouteName(activeTab as NavRoute);

  if (nestedRoute === 'CreateJobForm') {
    return null;
  }

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
  useAuthSessionWarmup();
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
