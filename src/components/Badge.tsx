import React, { useMemo } from 'react';

import { View, Text, ViewStyle } from 'react-native';

import { FONT_SIZE, BORDER_RADIUS, SPACING } from '@constants/theme';

import { useAppTheme } from '@constants/workerThemeContext';

import type { JobStatus } from '@/types';

import { getStatusLabel } from '@utils/formatters';



interface BadgeProps {

  label: string;

  color?: string;

  bgColor?: string;

  size?: 'sm' | 'md';

  style?: ViewStyle;

}



export const Badge: React.FC<BadgeProps> = ({

  label,

  color,

  bgColor,

  size = 'md',

  style,

}) => {

  const { colors } = useAppTheme();

  const isSmall = size === 'sm';

  return (

    <View

      style={[

        {

          backgroundColor: bgColor ?? colors.bg.elevated,

          borderRadius: BORDER_RADIUS.full,

          paddingHorizontal: isSmall ? SPACING.sm : SPACING.md,

          paddingVertical: isSmall ? 2 : SPACING.xs,

          alignSelf: 'flex-start',

        },

        style,

      ]}

    >

      <Text

        style={{

          color: color ?? colors.text.primary,

          fontSize: isSmall ? FONT_SIZE.xs : FONT_SIZE.sm,

          fontWeight: '600',

        }}

      >

        {label}

      </Text>

    </View>

  );

};



const GLOBAL_STATUS_COLORS: Record<JobStatus, { color: string; bg: string }> = {

  open:        { color: '#166534', bg: '#DCFCE7' },

  taken:       { color: '#92400E', bg: '#FEF3C7' },

  in_progress: { color: '#1D4ED8', bg: '#DBEAFE' },

  completed:   { color: '#6D28D9', bg: '#EDE9FE' },

  cancelled:   { color: '#B91C1C', bg: '#FEE2E2' },

};



interface StatusBadgeProps {

  status: JobStatus;

  size?: 'sm' | 'md';

  style?: ViewStyle;

}



export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size, style }) => {

  const { m3 } = useAppTheme();



  const statusColors = useMemo(() => {

    if (!m3) return GLOBAL_STATUS_COLORS;

    return {

      open:        { color: m3.onSecondaryContainer, bg: m3.secondaryContainer },

      taken:       { color: m3.onTertiaryContainer, bg: m3.tertiaryFixed },

      in_progress: { color: m3.onPrimaryContainer, bg: m3.primaryFixed },

      completed:   { color: m3.onSecondaryFixed, bg: m3.secondaryFixed },

      cancelled:   { color: m3.onErrorContainer, bg: m3.errorContainer },

    } satisfies Record<JobStatus, { color: string; bg: string }>;

  }, [m3]);



  const { color, bg } = statusColors[status];

  return (

    <Badge

      label={getStatusLabel(status)}

      color={color}

      bgColor={bg}

      size={size}

      style={style}

    />

  );

};

