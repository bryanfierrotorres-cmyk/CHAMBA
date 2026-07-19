import React from 'react';
import { View, Text, Image, Switch, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { INICIO } from './inicioTheme';

interface InicioHeaderProps {
  topInset: number;
  fullName: string | null;
  avatarUrl: string | null | undefined;
  isOnline: boolean;
  isToggling?: boolean;
  onToggleOnline: (next: boolean) => void;
}

export const InicioHeader: React.FC<InicioHeaderProps> = ({
  topInset,
  fullName,
  avatarUrl,
  isOnline,
  isToggling,
  onToggleOnline,
}) => {
  const firstName = fullName?.trim().split(/\s+/)[0] || 'Técnico';

  return (
    <View style={[styles.wrap, { paddingTop: topInset + 12 }]}>
      <View style={styles.left}>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Ionicons name="construct" size={20} color={INICIO.blue} />
          )}
        </View>
        <View style={styles.nameCol}>
          <Text style={styles.greeting} numberOfLines={2}>{`¡Hola, ${firstName}! 👋`}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>Listo para recibir Chambas</Text>
        </View>
      </View>

      <View style={styles.right}>
        <View style={[styles.pill, !isOnline && styles.pillOffline]}>
          <View style={styles.pillTextCol}>
            <View style={styles.pillTitleRow}>
              <View style={[styles.dot, !isOnline && styles.dotOffline]} />
              <Text style={[styles.pillTitle, !isOnline && styles.pillTitleOffline]}>
                {isOnline ? 'Disponible' : 'Desconectado'}
              </Text>
            </View>
            <Text style={[styles.pillSub, !isOnline && styles.pillSubOffline]}>
              {isOnline ? 'Recibiendo solicitudes' : 'Activá para buscar'}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={onToggleOnline}
            disabled={isToggling}
            trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
            thumbColor={Platform.OS === 'android' ? (isOnline ? INICIO.green : '#F3F4F6') : undefined}
            ios_backgroundColor="#D1D5DB"
            style={styles.switch}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: INICIO.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: INICIO.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: INICIO.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  nameCol: { flexShrink: 1 },
  greeting: { fontSize: 18, fontWeight: '800', color: INICIO.textStrong, letterSpacing: -0.3, lineHeight: 22 },
  subtitle: { fontSize: 12, color: INICIO.textMedium, marginTop: 1 },
  right: { alignItems: 'flex-end', gap: 8, flexShrink: 0 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: INICIO.greenSurface,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: INICIO.greenSoft,
  },
  pillOffline: { backgroundColor: '#F3F4F6', borderColor: INICIO.border },
  pillTextCol: { alignItems: 'flex-end' },
  pillTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: INICIO.green },
  dotOffline: { backgroundColor: INICIO.textFaint },
  pillTitle: { fontSize: 12, fontWeight: '800', color: INICIO.greenText },
  pillTitleOffline: { color: INICIO.textMedium },
  pillSub: { fontSize: 10, color: INICIO.greenText, marginTop: 1 },
  pillSubOffline: { color: INICIO.textFaint },
  switch: Platform.OS === 'web'
    ? ({ transform: [{ scale: 0.9 }] } as object)
    : ({ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] } as object),
});
