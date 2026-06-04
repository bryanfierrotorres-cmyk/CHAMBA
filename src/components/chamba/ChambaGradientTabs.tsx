import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CHAMBA, GRADIENT_TOGGLE, chambaStyles } from '@constants/chambaUI';

export interface ChambaTabOption<T extends string> {
  id: T;
  label: string;
  badge?: number;
}

interface ChambaGradientTabsProps<T extends string> {
  tabs: ChambaTabOption<T>[];
  active: T;
  onChange: (id: T) => void;
  style?: ViewStyle;
}

export function ChambaGradientTabs<T extends string>({
  tabs,
  active,
  onChange,
  style,
}: ChambaGradientTabsProps<T>) {
  return (
    <View style={[chambaStyles.tabOuterContainer, style]}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={isActive ? chambaStyles.tabActiveTouchable : chambaStyles.tabInactiveButton}
            onPress={() => onChange(tab.id)}
            activeOpacity={isActive ? 0.9 : 0.7}
          >
            {isActive ? (
              <LinearGradient
                colors={[...GRADIENT_TOGGLE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={chambaStyles.gradientButton}
              >
                <Text style={chambaStyles.tabTextActive}>
                  {tab.label}{tab.badge != null && tab.badge > 0 ? ` (${tab.badge})` : ''}
                </Text>
              </LinearGradient>
            ) : (
              <Text style={chambaStyles.tabTextInactive}>
                {tab.label}{tab.badge != null && tab.badge > 0 ? ` (${tab.badge})` : ''}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const compactTabStyles = StyleSheet.create({
  outer: { marginHorizontal: 0 },
  gradientBtn: { paddingVertical: 10 },
  textActive: { fontSize: 13 },
  textInactive: { fontSize: 13, color: CHAMBA.muted },
});
