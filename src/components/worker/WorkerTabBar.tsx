import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AvailabilityDot } from '@components/AvailabilitySelector';
import { useProfileStore, selectAvailability } from '@store/profileStore';
import { CHAMBA } from '@constants/chambaUI';
import { webFixedTabBarStyle } from '@constants/webMobileLayout';

const CYAN = CHAMBA.cyan;
const SLATE_MUTED = '#94A3B8';

type TabRoute = 'JobFeed' | 'MyJobs' | 'Wallet' | 'Profile';

const TAB_CONFIG: Record<TabRoute, { label: string; iconOutline: keyof typeof Ionicons.glyphMap; iconFilled: keyof typeof Ionicons.glyphMap }> = {
  JobFeed: { label: 'Inicio', iconOutline: 'radio-outline', iconFilled: 'radio' },
  MyJobs:  { label: 'Agenda', iconOutline: 'receipt-outline', iconFilled: 'receipt' },
  Wallet:  { label: 'Billetera', iconOutline: 'wallet-outline', iconFilled: 'wallet' },
  Profile: { label: 'Perfil', iconOutline: 'person-outline', iconFilled: 'person' },
};

export const WorkerTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const availability = useProfileStore(selectAvailability);

  return (
    <View style={[styles.wrap, webFixedTabBarStyle, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const cfg = TAB_CONFIG[route.name as TabRoute];
        if (!cfg) return null;

        const isFeed = route.name === 'JobFeed';
        const isAgenda = route.name === 'MyJobs';
        const isWallet = route.name === 'Wallet';
        const accentFocused = focused && (isAgenda || isWallet);

        return (
          <TouchableOpacity
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.85}
            style={styles.tabItem}
          >
            {focused && isFeed ? (
              <>
                <View style={styles.homeActiveOrb}>
                  <Ionicons name="radio" size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.homeLabel}>{cfg.label}</Text>
              </>
            ) : (
              <>
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={focused ? cfg.iconFilled : cfg.iconOutline}
                    size={22}
                    color={accentFocused ? CYAN : SLATE_MUTED}
                  />
                  {route.name === 'Profile' && (
                    <View style={styles.dotWrap}>
                      <AvailabilityDot status={availability} size={7} pulse={availability === 'available'} />
                    </View>
                  )}
                </View>
                <Text style={[styles.tabLabel, accentFocused && styles.agendaLabelActive]}>
                  {cfg.label}
                </Text>
              </>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
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
  agendaLabelActive: {
    color: CYAN,
    fontWeight: '600',
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotWrap: {
    position: 'absolute',
    top: -2,
    right: -6,
  },
});
