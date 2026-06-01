import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminDashboardScreen } from '@features/admin/screens/AdminDashboardScreen';
import { CreateJobScreen }      from '@features/admin/screens/CreateJobScreen';
import { ManageWorkersScreen }  from '@features/admin/screens/ManageWorkersScreen';
import { ManageCatalogScreen }  from '@features/admin/screens/ManageCatalogScreen';
import { AdminProfileScreen }   from '@features/admin/screens/AdminProfileScreen';
import { JobDetailScreen }      from '@features/jobs/screens/JobDetailScreen';
import { MaterialSymbol } from '@components/admin/MaterialSymbol';
import { M3, SPACING, TAB_BAR_SHADOW, stitchTypography } from '@constants/stitchStyles';
import { webAppShellStyle, webFixedTabBarStyle, webTabScenePadding } from '@constants/webMobileLayout';
import type { AdminTabParamList, JobStackParamList } from '@/types';

const Tab   = createBottomTabNavigator<AdminTabParamList>();
const Stack = createNativeStackNavigator<JobStackParamList>();

const DashboardStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="JobList"   component={AdminDashboardScreen} />
    <Stack.Screen name="JobDetail" component={JobDetailScreen} />
    <Stack.Screen name="JobMap"    component={JobDetailScreen} />
  </Stack.Navigator>
);

const ADMIN_TABS: {
  route: keyof AdminTabParamList;
  label: string;
  icon: string;
}[] = [
  { route: 'Dashboard',     label: 'Control',    icon: 'monitor_heart' },
  { route: 'PublishJob',    label: 'Publicar',   icon: 'add_circle' },
  { route: 'ManageCatalog', label: 'Catálogo',   icon: 'category' },
  { route: 'ManageWorkers', label: 'Equipo',     icon: 'engineering' },
  { route: 'Profile',       label: 'Perfil',     icon: 'person' },
];

const AdminTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[tabStyles.wrap, webFixedTabBarStyle, { paddingBottom: Math.max(insets.bottom, 8) }, TAB_BAR_SHADOW]}>
      {ADMIN_TABS.map((tab) => {
        const routeIndex = state.routes.findIndex((r) => r.name === tab.route);
        if (routeIndex === -1) return null;
        const focused = state.index === routeIndex;

        return (
          <TouchableOpacity
            key={tab.route}
            onPress={() => navigation.navigate(tab.route)}
            activeOpacity={0.85}
            style={[tabStyles.tab, focused && tabStyles.tabActive]}
          >
            <MaterialSymbol
              name={tab.icon}
              size={22}
              color={focused ? M3.onPrimaryContainer : M3.onSurfaceVariant}
              filled={focused}
            />
            <Text style={[stitchTypography.labelBold, focused && tabStyles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const tabStyles = StyleSheet.create({
  wrap: {
    flexDirection:        'row',
    justifyContent:       'space-around',
    alignItems:           'center',
    backgroundColor:      M3.surfaceContainerLowest,
    borderTopLeftRadius:  12,
    borderTopRightRadius: 12,
    paddingTop:           SPACING.sm,
    paddingHorizontal:    SPACING.xs,
  },
  tab: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingVertical:   SPACING.xs,
    paddingHorizontal: SPACING.xs,
    borderRadius:      12,
    marginHorizontal:  2,
    gap:               2,
  },
  tabActive: {
    backgroundColor: M3.primaryContainer,
  },
  labelActive: {
    color: M3.onPrimaryContainer,
  },
});

export const AdminNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();

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
      </Tab.Navigator>
    </View>
  );
};
