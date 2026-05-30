import React, { useEffect } from 'react';
import { Platform, Text, StyleSheet, type TextStyle, type StyleProp } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { M3 } from '@constants/stitchStyles';

const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap';

let fontInjected = false;

function ensureWebFont() {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || fontInjected) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONT_URL;
  document.head.appendChild(link);
  fontInjected = true;
}

const NATIVE_ICON_MAP: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  radar:                    'radar',
  payments:                 'cash-multiple',
  groups:                   'account-group',
  task_alt:                 'check-decagram',
  add_circle:               'plus-circle',
  engineering:              'account-hard-hat',
  dashboard:                'view-dashboard',
  monitor_heart:            'heart-pulse',
  person:                   'account',
  notifications:            'bell-outline',
  verified:                 'check-decagram',
  cleaning_services:        'broom',
  location_on:              'map-marker',
  tune:                     'tune-variant',
  publish:                  'upload',
  gavel:                    'gavel',
  chevron_right:            'chevron-right',
  call:                     'phone',
  schedule:                 'clock-outline',
  inventory_2:              'package-variant',
  search:                   'magnify',
  filter_alt:               'filter-variant',
  pause_circle:             'pause-circle',
  check_circle:             'check-circle',
  cancel:                   'close-circle',
  star:                     'star',
  event_note:               'calendar-text',
  account_balance_wallet:   'wallet',
  settings:                 'cog-outline',
  help:                     'help-circle-outline',
  flash_on:                 'flash',
  map:                      'map-outline',
  category:                 'shape-outline',
  attach_money:             'currency-usd',
  people:                   'account-group',
};

interface MaterialSymbolProps {
  name: string;
  size?: number;
  color?: string;
  filled?: boolean;
  style?: StyleProp<TextStyle>;
}

export const MaterialSymbol: React.FC<MaterialSymbolProps> = ({
  name,
  size = 24,
  color = M3.primary,
  filled = false,
  style,
}) => {
  useEffect(() => {
    ensureWebFont();
  }, []);

  if (Platform.OS === 'web') {
    const webStyle = {
      fontSize: size,
      color,
      fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0",
    } as TextStyle;

    return (
      <Text style={[styles.webSymbol, webStyle, style]}>
        {name}
      </Text>
    );
  }

  const nativeName = NATIVE_ICON_MAP[name] ?? 'circle-outline';
  return (
    <MaterialCommunityIcons
      name={nativeName}
      size={size}
      color={color}
      style={style as object}
    />
  );
};

const styles = StyleSheet.create({
  webSymbol: {
    fontFamily: 'Material Symbols Outlined',
    lineHeight: undefined,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
