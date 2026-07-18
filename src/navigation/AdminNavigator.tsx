import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminDashboardScreen } from '@features/admin/operational/screens/AdminDashboardScreen';
import { CreateJobScreen }      from '@features/admin/operational/screens/CreateJobScreen';
import { ManageWorkersScreen }  from '@features/admin/operational/screens/ManageWorkersScreen';
import { ManageCatalogScreen }  from '@features/admin/operational/screens/ManageCatalogScreen';
import { AdminProfileScreen }   from '@features/admin/operational/screens/AdminProfileScreen';
import { TechnicalDashboardScreen } from '@features/admin/technical/screens/TechnicalDashboardScreen';
import { JobDetailScreen }      from '@features/jobs/screens/JobDetailScreen';
import { webAppShellStyle, webFixedTabBarStyle, webTabScenePadding } from '@constants/webMobileLayout';
import { CHAMBA } from '@constants/chambaUI';
import { useAuthSessionWarmup } from '@/hooks/useAuthSessionWarmup';
import { useAdminDevMode } from '@features/admin/devModeFlag';
import type { AdminTabParamList, JobStackParamList } from '@/types';

// NOTA: se intentó React.lazy + import() dinámico para code-splitting real,
// pero el servidor de desarrollo de Metro (expo start --web) revienta con
// "Requiring unknown module" al resolver el chunk async — este proyecto no
// tiene configuración de serializer para bundle-splitting. Se revirtió a
// imports estáticos normales; la reorganización en operational/ (organización
// de código) se mantiene, que es la parte de valor real de esta fase.

const Tab   = createBottomTabNavigator<AdminTabParamList>();
const Stack = createNativeStackNavigator<JobStackParamList>();

const DashboardStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="JobList"   component={AdminDashboardScreen} />
    <Stack.Screen name="JobDetail" component={JobDetailScreen} />
    <Stack.Screen name="JobMap"    component={JobDetailScreen} />
  </Stack.Navigator>
);

type TabRoute = keyof AdminTabParamList;

const TAB_CONFIG: Record<TabRoute, { label: string; icon: keyof typeof Ionicons.glyphMap; iconOutline: keyof typeof Ionicons.glyphMap }> = {
  Dashboard:     { label: 'Control',  icon: 'pulse',          iconOutline: 'pulse-outline' },
  PublishJob:    { label: 'Publicar', icon: 'add-circle',     iconOutline: 'add-circle-outline' },
  ManageCatalog: { label: 'Catálogo', icon: 'grid',           iconOutline: 'grid-outline' },
  ManageWorkers: { label: 'Equipo',   icon: 'people',         iconOutline: 'people-outline' },
  Profile:       { label: 'Perfil',   icon: 'person',         iconOutline: 'person-outline' },
  Technical:     { label: 'Dev',      icon: 'construct',      iconOutline: 'construct-outline' },
};

const AdminTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[tabStyles.wrap, webFixedTabBarStyle, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const cfg = TAB_CONFIG[route.name as TabRoute];
        const isControl = route.name === 'Dashboard';

        return (
          <TouchableOpacity
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.85}
            style={tabStyles.tabItem}
          >
            {focused && isControl ? (
              <>
                <View style={tabStyles.homeActiveOrb}>
                  <Ionicons name="pulse" size={22} color="#FFFFFF" />
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

const SLATE_MUTED = '#94A3B8';
const CYAN = CHAMBA.cyan;

const tabStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 72,
    backgroundColor: CHAMBA.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CHAMBA.border,
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
    minWidth: 56,
    flex: 1,
    paddingBottom: 4,
  },
  homeActiveOrb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: CYAN,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
    shadowColor: CYAN,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  homeLabel: { fontSize: 10, color: CYAN, fontWeight: '600', marginTop: 4 },
  tabLabel: { fontSize: 10, color: SLATE_MUTED, fontWeight: '500', marginTop: 4 },
});

export const AdminNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const devModeEnabled = useAdminDevMode((s) => s.enabled);
  useAuthSessionWarmup();

  return (
    <View style={webAppShellStyle}>
      <Tab.Navigator
        tabBar={(props) => <AdminTabBar {...props} />}
        screenOptions={{ headerShown: false }}
        sceneContainerStyle={Platform.OS === 'web' ? { paddingBottom: webTabScenePadding(insets.bottom) } : undefined}
      >
        <Tab.Screen name="Dashboard"     component={DashboardStack} />
        <Tab.Screen name="PublishJob"    component={CreateJobScreen} />
        <Tab.Screen name="ManageCatalog" component={ManageCatalogScreen} />
        <Tab.Screen name="ManageWorkers" component={ManageWorkersScreen} />
        <Tab.Screen name="Profile"       component={AdminProfileScreen} />
        {devModeEnabled && (
          <Tab.Screen name="Technical" component={TechnicalDashboardScreen} />
        )}
      </Tab.Navigator>
    </View>
  );
};
