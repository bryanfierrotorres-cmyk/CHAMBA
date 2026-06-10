import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  formatExpiryCountdown,
  getJobRemainingMs,
} from '@constants/jobExpiry';

export type ContadorExpiracionVariant = 'radar' | 'client' | 'inline' | 'chip' | 'chipClient';

export interface ContadorExpiracionProps {
  /** Timestamp ISO de Supabase (`jobs.created_at`). */
  createdAt: string;
  idSolicitud: string;
  onExpirar?: (idSolicitud: string) => void;
  variant?: ContadorExpiracionVariant;
  /** Etiqueta opcional antes del MM:SS. */
  label?: string;
  active?: boolean;
}

/**
 * Cuenta regresiva MM:SS 100% local — sin polling a Supabase.
 * Al llegar a 00:00 ejecuta `onExpirar` una sola vez y limpia el intervalo.
 */
export const ContadorExpiracion: React.FC<ContadorExpiracionProps> = ({
  createdAt,
  idSolicitud,
  onExpirar = () => {},
  variant = 'inline',
  label,
  active = true,
}) => {
  const [remainingMs, setRemainingMs] = useState(() => getJobRemainingMs(createdAt));
  const expiredFiredRef = useRef(false);

  useEffect(() => {
    expiredFiredRef.current = false;
    setRemainingMs(getJobRemainingMs(createdAt));
  }, [createdAt, idSolicitud]);

  useEffect(() => {
    if (!active) return undefined;

    const tick = () => {
      const next = getJobRemainingMs(createdAt);
      setRemainingMs(next);
      if (next <= 0 && !expiredFiredRef.current) {
        expiredFiredRef.current = true;
        onExpirar(idSolicitud);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active, createdAt, idSolicitud, onExpirar]);

  const countdown = formatExpiryCountdown(remainingMs);
  const critical = remainingMs <= 8 * 60_000;
  const expired = remainingMs <= 0;
  const prefix = label ?? (variant === 'client' ? 'Tiempo restante' : 'Expira en');

  if (variant === 'chip' || variant === 'chipClient') {
    const isClient = variant === 'chipClient';
    if (expired) {
      return (
        <View style={[styles.chip, styles.chipExpired, isClient && styles.chipClientTone]}>
          <Ionicons name="moon-outline" size={11} color="#94A3B8" />
          <Text style={styles.chipExpiredText}>Fuera del radar</Text>
        </View>
      );
    }
    return (
      <View style={[
        styles.chip,
        isClient ? styles.chipClientTone : styles.chipWorkerTone,
        critical && styles.chipCritical,
      ]}>
        <Ionicons
          name="time-outline"
          size={11}
          color={critical ? '#B91C1C' : isClient ? '#0284C7' : '#DC2626'}
        />
        <Text style={[styles.chipPrefix, critical && styles.chipTextCritical]}>
          {isClient ? 'En radar' : 'Expira'}
        </Text>
        <Text style={[styles.chipTime, critical && styles.chipTextCritical]}>
          {countdown}
        </Text>
      </View>
    );
  }

  if (variant === 'client') {
    return (
      <View style={styles.clientRow}>
        <Ionicons name="time-outline" size={16} color={critical ? '#B91C1C' : '#0284C7'} />
        <Text style={[styles.clientText, critical && styles.clientTextCritical]}>
          {prefix}
          {': '}
          {countdown}
        </Text>
      </View>
    );
  }

  if (variant === 'radar') {
    return (
      <View style={styles.radarRow}>
        <Ionicons name="stopwatch-outline" size={14} color="#DC2626" />
        <Text style={[styles.radarText, critical && styles.radarTextCritical]}>
          {prefix}
          {': '}
          {countdown}
        </Text>
      </View>
    );
  }

  return (
    <Text style={[styles.inlineText, critical && styles.inlineTextCritical]}>
      {countdown}
    </Text>
  );
};

const styles = StyleSheet.create({
  radarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  radarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    letterSpacing: 0.1,
  },
  radarTextCritical: {
    color: '#B91C1C',
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  clientText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
  },
  clientTextCritical: {
    color: '#B91C1C',
  },
  inlineText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
    fontVariant: ['tabular-nums'],
  },
  inlineTextCritical: {
    color: '#B91C1C',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipWorkerTone: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  chipClientTone: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  chipCritical: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  chipExpired: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  chipPrefix: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  chipTime: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  chipTextCritical: {
    color: '#B91C1C',
  },
  chipExpiredText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
