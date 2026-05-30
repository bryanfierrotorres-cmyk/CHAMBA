import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { M3, SPACING, BORDER_RADIUS, CARD_ELEVATION } from '@constants/stitchStyles';

interface StartupErrorScreenProps {
  title?: string;
  message: string;
  details?: string;
}

export const StartupErrorScreen: React.FC<StartupErrorScreenProps> = ({
  title = 'CHAMBA no pudo iniciar',
  message,
  details,
}) => (
  <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.card}>
        <Text style={styles.emoji}>⚠️</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {details ? (
          <View style={styles.detailsBox}>
            <Text style={styles.detailsLabel}>Detalle técnico</Text>
            <Text style={styles.detailsText}>{details}</Text>
          </View>
        ) : null}
        <View style={styles.hintBox}>
          <Text style={styles.hintTitle}>Si despliegas en Vercel</Text>
          <Text style={styles.hintText}>
            Agrega estas variables en Project Settings → Environment Variables y vuelve a desplegar:{'\n\n'}
            • EXPO_PUBLIC_SUPABASE_URL{'\n'}
            • EXPO_PUBLIC_SUPABASE_ANON_KEY
          </Text>
        </View>
        {Platform.OS === 'web' ? (
          <Text style={styles.footer}>
            Revisa la consola del navegador (F12) para más información.
          </Text>
        ) : null}
      </View>
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: M3.background,
    ...(Platform.OS === 'web' ? { minHeight: '100vh' as unknown as number } : {}),
  },
  scroll: {
    flexGrow:          1,
    justifyContent:    'center',
    padding:           SPACING.lg,
  },
  card: {
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius:    24,
    padding:         SPACING.xl,
    alignItems:      'center',
    ...CARD_ELEVATION,
  },
  emoji: { fontSize: 40, marginBottom: SPACING.sm },
  title: {
    fontSize:   22,
    fontWeight: '800',
    color:      M3.onBackground,
    textAlign:  'center',
    marginBottom: SPACING.sm,
  },
  message: {
    fontSize:   15,
    lineHeight: 22,
    color:      M3.onSurfaceVariant,
    textAlign:  'center',
  },
  detailsBox: {
    marginTop:         SPACING.md,
    backgroundColor:   M3.errorContainer,
    borderRadius:      12,
    padding:           SPACING.md,
    width:             '100%',
  },
  detailsLabel: {
    fontSize:   11,
    fontWeight: '700',
    color:      M3.onErrorContainer,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailsText: {
    fontSize:   12,
    color:      M3.onErrorContainer,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  hintBox: {
    marginTop:       SPACING.md,
    backgroundColor: M3.primaryFixed,
    borderRadius:    12,
    padding:         SPACING.md,
    width:           '100%',
  },
  hintTitle: {
    fontSize:   13,
    fontWeight: '700',
    color:      M3.onPrimaryFixedVariant,
    marginBottom: 6,
  },
  hintText: {
    fontSize:   12,
    lineHeight: 18,
    color:      M3.onPrimaryFixedVariant,
  },
  footer: {
    marginTop:  SPACING.md,
    fontSize:   11,
    color:      M3.outline,
    textAlign:  'center',
  },
});
