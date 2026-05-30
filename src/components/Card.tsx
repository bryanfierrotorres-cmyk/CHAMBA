import React from 'react';
import { TouchableOpacity, View, ViewStyle } from 'react-native';
import { BORDER_RADIUS, SPACING } from '@constants/theme';
import { useAppTheme } from '@constants/workerThemeContext';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  elevated?: boolean;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  style,
  elevated = false,
  noPadding = false,
}) => {
  const { colors, m3 } = useAppTheme();
  const baseStyle: ViewStyle = {
    backgroundColor: colors.bg.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: noPadding ? 0 : SPACING.md,
    overflow: 'hidden',
    borderWidth: m3 ? 1 : 0,
    borderColor: m3?.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: elevated ? 4 : 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: elevated ? 6 : 4,
  };

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[baseStyle, style]}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[baseStyle, style]}>{children}</View>;
};
