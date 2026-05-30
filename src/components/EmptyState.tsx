import React from 'react';

import { View, Text } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { FONT_SIZE, SPACING } from '@constants/theme';

import { useAppTheme } from '@constants/workerThemeContext';

import { Button } from './Button';



interface EmptyStateProps {

  icon?: keyof typeof Ionicons.glyphMap;

  title: string;

  subtitle?: string;

  actionLabel?: string;

  onAction?: () => void;

}



export const EmptyState: React.FC<EmptyStateProps> = ({

  icon = 'briefcase-outline',

  title,

  subtitle,

  actionLabel,

  onAction,

}) => {

  const { colors, m3 } = useAppTheme();



  return (

    <View

      style={{

        flex: 1,

        alignItems: 'center',

        justifyContent: 'center',

        padding: SPACING['2xl'],

        gap: SPACING.md,

      }}

    >

      <View

        style={{

          width: 80,

          height: 80,

          borderRadius: 40,

          backgroundColor: m3?.surfaceContainer ?? colors.bg.elevated,

          alignItems: 'center',

          justifyContent: 'center',

          marginBottom: SPACING.sm,

          borderWidth: m3 ? 1 : 0,

          borderColor: m3?.outlineVariant,

        }}

      >

        <Ionicons name={icon} size={36} color={m3?.primary ?? colors.text.muted} />

      </View>

      <Text

        style={{

          color: colors.text.primary,

          fontSize: FONT_SIZE.xl,

          fontWeight: '700',

          textAlign: 'center',

        }}

      >

        {title}

      </Text>

      {subtitle && (

        <Text

          style={{

            color: colors.text.secondary,

            fontSize: FONT_SIZE.md,

            textAlign: 'center',

            lineHeight: 22,

          }}

        >

          {subtitle}

        </Text>

      )}

      {actionLabel && onAction && (

        <Button

          label={actionLabel}

          onPress={onAction}

          variant="outline"

          style={{ marginTop: SPACING.sm }}

        />

      )}

    </View>

  );

};

