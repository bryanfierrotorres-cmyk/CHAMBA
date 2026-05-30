import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AvailabilityDot } from '@components/AvailabilitySelector';
import { useProfileStore, selectAvailability } from '@store/profileStore';
import { M3, SPACING, TAB_BAR_SHADOW, stitchTypography } from '@constants/stitchStyles';

const TABS: {
  route: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { route: 'JobFeed', label: 'Inicio',  icon: 'radio-outline',         iconActive: 'radio' },
  { route: 'MyJobs',  label: 'Agenda',  icon: 'calendar-outline',      iconActive: 'calendar' },
  { route: 'Profile', label: 'Perfil',  icon: 'person-outline',        iconActive: 'person' },
];

export const WorkerTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const availability = useProfileStore(selectAvailability);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }, TAB_BAR_SHADOW]}>
      {TABS.map((tab) => {
        const routeIndex = state.routes.findIndex((r) => r.name === tab.route);
        if (routeIndex === -1) return null;
        const focused = state.index === routeIndex;

        return (
          <TouchableOpacity
            key={tab.route}
            onPress={() => navigation.navigate(tab.route)}
            activeOpacity={0.85}
            style={[styles.tab, focused && styles.tabActive]}
          >
            <View style={styles.iconWrap}>
              <Ionicons
                name={focused ? tab.iconActive : tab.icon}
                size={22}
                color={focused ? M3.onPrimaryContainer : M3.onSurfaceVariant}
              />
              {tab.route === 'Profile' && (
                <View style={styles.dotWrap}>
                  <AvailabilityDot status={availability} size={7} pulse={availability === 'available'} />
                </View>
              )}
            </View>
            <Text style={[stitchTypography.labelBold, focused && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection:     'row',
    justifyContent:    'space-around',
    alignItems:        'center',
    backgroundColor:   M3.surfaceContainerLowest,
    borderTopLeftRadius:  12,
    borderTopRightRadius: 12,
    paddingTop:        SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  tab: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingVertical:   SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius:      12,
    marginHorizontal:  2,
  },
  tabActive: {
    backgroundColor: M3.primaryContainer,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotWrap: {
    position: 'absolute',
    top:   -2,
    right: -6,
  },
  labelActive: {
    color: M3.onPrimaryContainer,
    marginTop: 2,
  },
});
