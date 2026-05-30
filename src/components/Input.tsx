import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING } from '@constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  isPassword = false,
  ...props
}) => {
  const [isFocused, setIsFocused]     = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const borderColor = error
    ? COLORS.error
    : isFocused
    ? COLORS.brand[500]
    : COLORS.border.default;

  return (
    <View style={[{ gap: SPACING.xs }, containerStyle]}>
      {label && (
        <Text style={{ color: COLORS.text.secondary, fontSize: FONT_SIZE.sm, fontWeight: '600' }}>
          {label}
        </Text>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: COLORS.bg.input,
          borderWidth: 1.5,
          borderColor,
          borderRadius: BORDER_RADIUS.md,
          paddingHorizontal: SPACING.md,
          gap: SPACING.sm,
        }}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={18}
            color={isFocused ? COLORS.brand[500] : COLORS.text.muted}
          />
        )}

        <TextInput
          style={{
            flex: 1,
            color: COLORS.text.primary,
            fontSize: FONT_SIZE.md,
            paddingVertical: SPACING.sm + 4,
          }}
          placeholderTextColor={COLORS.text.muted}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {isPassword ? (
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={12}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={COLORS.text.muted}
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity onPress={onRightIconPress} hitSlop={12}>
            <Ionicons name={rightIcon} size={18} color={COLORS.text.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <Text style={{ color: COLORS.error, fontSize: FONT_SIZE.xs }}>{error}</Text>
      ) : hint ? (
        <Text style={{ color: COLORS.text.muted, fontSize: FONT_SIZE.xs }}>{hint}</Text>
      ) : null}
    </View>
  );
};
