import React, { useMemo } from 'react';

import {

  TouchableOpacity,

  Text,

  ActivityIndicator,

  ViewStyle,

  TextStyle,

  View,

} from 'react-native';

import { BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, SPACING } from '@constants/theme';

import { useAppTheme } from '@constants/workerThemeContext';



type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

type Size = 'sm' | 'md' | 'lg';



interface ButtonProps {

  label: string;

  onPress: () => void;

  variant?: Variant;

  size?: Size;

  isLoading?: boolean;

  disabled?: boolean;

  icon?: React.ReactNode;

  iconPosition?: 'left' | 'right';

  fullWidth?: boolean;

  style?: ViewStyle;

  textStyle?: TextStyle;

}



const sizeStyles: Record<Size, { container: ViewStyle; text: TextStyle }> = {

  sm: {

    container: {

      paddingHorizontal: SPACING.md,

      paddingVertical: SPACING.xs + 2,

      borderRadius: BORDER_RADIUS.full,

    },

    text: { fontSize: FONT_SIZE.sm },

  },

  md: {

    container: {

      paddingHorizontal: SPACING.lg,

      paddingVertical: SPACING.sm + 4,

      borderRadius: BORDER_RADIUS.full,

    },

    text: { fontSize: FONT_SIZE.md },

  },

  lg: {

    container: {

      paddingHorizontal: SPACING.xl,

      paddingVertical: SPACING.md,

      borderRadius: BORDER_RADIUS.full,

    },

    text: { fontSize: FONT_SIZE.lg },

  },

};



export const Button: React.FC<ButtonProps> = ({

  label,

  onPress,

  variant = 'primary',

  size = 'md',

  isLoading = false,

  disabled = false,

  icon,

  iconPosition = 'left',

  fullWidth = false,

  style,

  textStyle,

}) => {

  const { colors, m3 } = useAppTheme();

  const isDisabled = disabled || isLoading;

  const sStyle = sizeStyles[size];



  const variantStyles = useMemo((): Record<Variant, { container: ViewStyle; text: TextStyle }> => ({

    primary: {

      container: {

        backgroundColor: m3?.primary ?? colors.brand[500],

        shadowColor: m3?.primary ?? colors.brand[600],

        shadowOffset: { width: 0, height: 4 },

        shadowOpacity: 0.3,

        shadowRadius: 8,

        elevation: 4,

      },

      text: { color: m3?.onPrimary ?? colors.white, fontWeight: FONT_WEIGHT.bold },

    },

    secondary: {

      container: {

        backgroundColor: m3?.surfaceContainer ?? colors.bg.elevated,

        borderWidth: 1,

        borderColor: m3?.outlineVariant ?? colors.border.subtle,

      },

      text: { color: colors.text.primary, fontWeight: FONT_WEIGHT.semibold },

    },

    outline: {

      container: {

        backgroundColor: colors.transparent,

        borderWidth: 2,

        borderColor: m3?.primary ?? colors.brand[500],

      },

      text: { color: m3?.primary ?? colors.brand[500], fontWeight: FONT_WEIGHT.semibold },

    },

    ghost: {

      container: { backgroundColor: colors.transparent },

      text: { color: m3?.primary ?? colors.brand[500], fontWeight: FONT_WEIGHT.medium },

    },

    danger: {

      container: {

        backgroundColor: m3?.error ?? colors.error,

        shadowColor: m3?.error ?? colors.error,

        shadowOffset: { width: 0, height: 4 },

        shadowOpacity: 0.25,

        shadowRadius: 8,

        elevation: 4,

      },

      text: { color: m3?.onError ?? colors.white, fontWeight: FONT_WEIGHT.bold },

    },

  }), [colors, m3]);



  const vStyle = variantStyles[variant];



  return (

    <TouchableOpacity

      onPress={onPress}

      disabled={isDisabled}

      activeOpacity={0.8}

      style={[

        {

          flexDirection: 'row',

          alignItems: 'center',

          justifyContent: 'center',

          gap: SPACING.xs,

        },

        vStyle.container,

        sStyle.container,

        fullWidth && { width: '100%' },

        isDisabled && { opacity: 0.55 },

        style,

      ]}

    >

      {isLoading ? (

        <ActivityIndicator

          size="small"

          color={variant === 'primary' || variant === 'danger'

            ? (m3?.onPrimary ?? colors.white)

            : (m3?.primary ?? colors.brand[500])}

        />

      ) : (

        <>

          {icon && iconPosition === 'left' && <View>{icon}</View>}

          <Text style={[vStyle.text, sStyle.text, textStyle]}>{label}</Text>

          {icon && iconPosition === 'right' && <View>{icon}</View>}

        </>

      )}

    </TouchableOpacity>

  );

};

