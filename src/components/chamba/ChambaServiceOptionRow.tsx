import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { chambaStyles } from '@constants/chambaUI';
import { ChambaPressable } from '@components/chamba/ChambaPressable';

export interface ChambaServiceOptionRowProps {
  title: string;
  subtitle: string;
  iconColor: string;
  icon: React.ReactNode;
  onPress: () => void;
  priceLine?: string;
  badge?: string;
}

/**
 * Tarjeta de servicio premium (misma línea visual que Centro de Control / Mi Perfil).
 * Texto a la izquierda, icono blanco en cuadrado de color a la derecha.
 */
export const ChambaServiceOptionRow: React.FC<ChambaServiceOptionRowProps> = ({
  title,
  subtitle,
  iconColor,
  icon,
  onPress,
  priceLine,
  badge,
}) => (
  <ChambaPressable style={chambaStyles.stepCard} onPress={onPress}>
    <View style={chambaStyles.stepCardContent}>
      <Text style={chambaStyles.cardTitle} numberOfLines={1}>{title}</Text>
      <Text style={chambaStyles.cardSubtitle} numberOfLines={2}>{subtitle}</Text>
      {(badge || priceLine) ? (
        <View style={styles.metaRow}>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
          {priceLine ? <Text style={styles.priceLine}>{priceLine}</Text> : null}
        </View>
      ) : null}
    </View>
    <View style={[chambaStyles.iconCircleRight, { backgroundColor: iconColor }]}>{icon}</View>
  </ChambaPressable>
);

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0284C7',
  },
  priceLine: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
});
