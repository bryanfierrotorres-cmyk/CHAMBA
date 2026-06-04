import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { chambaStyles } from '@constants/chambaUI';

interface ChambaScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: ViewStyle;
}

/** Encabezado premium (Centro de Control / Mi Perfil). */
export const ChambaScreenHeader: React.FC<ChambaScreenHeaderProps> = ({
  title,
  subtitle,
  right,
  style,
}) => (
  <View style={[chambaStyles.screenHeader, styles.row, style]}>
    <View style={styles.textCol}>
      <Text style={chambaStyles.screenTitle}>{title}</Text>
      {subtitle ? <Text style={chambaStyles.screenSubtitle}>{subtitle}</Text> : null}
    </View>
    {right}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  textCol: { flex: 1, minWidth: 0, paddingRight: 8 },
});
