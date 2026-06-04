import React from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { chambaStyles } from '@constants/chambaUI';
import { ChambaPressable } from '@components/chamba/ChambaPressable';

export interface ChambaMenuRowProps {
  title: string;
  subtitle: string;
  iconColor: string;
  icon: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  loading?: boolean;
}

/** Fila de menú premium: texto a la izquierda, icono en círculo de color a la derecha. */
export const ChambaMenuRow: React.FC<ChambaMenuRowProps> = ({
  title,
  subtitle,
  iconColor,
  icon,
  onPress,
  destructive,
  loading,
}) => (
  <ChambaPressable
    style={chambaStyles.stepCard}
    onPress={onPress}
    disabled={!onPress || loading}
  >
    <View style={chambaStyles.stepCardContent}>
      <Text style={[chambaStyles.cardTitle, destructive && { color: '#B91C1C' }]}>{title}</Text>
      <Text style={chambaStyles.cardSubtitle}>{subtitle}</Text>
    </View>
    <View style={[chambaStyles.iconCircleRight, { backgroundColor: iconColor }]}>
      {loading ? <ActivityIndicator color="#FFF" size="small" /> : icon}
    </View>
  </ChambaPressable>
);
