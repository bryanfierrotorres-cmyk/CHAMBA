import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RadarJobExpiryTimerProps {
  expiresAt: number;
  active?: boolean;
}

const formatCountdown = (remainingMs: number): string => {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

/** Cuenta regresiva MM:SS — señal visual de urgencia en el radar. */
export const RadarJobExpiryTimer: React.FC<RadarJobExpiryTimerProps> = ({
  expiresAt,
  active = true,
}) => {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, expiresAt - Date.now()),
  );

  useEffect(() => {
    if (!active) return undefined;
    const tick = () => setRemainingMs(Math.max(0, expiresAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, active]);

  const critical = remainingMs <= 8 * 60_000;

  return (
    <View style={styles.row}>
      <Ionicons name="stopwatch-outline" size={14} color="#DC2626" />
      <Text style={[styles.label, critical && styles.labelCritical]}>
        Expira en:
        {' '}
        {formatCountdown(remainingMs)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    letterSpacing: 0.1,
  },
  labelCritical: {
    color: '#B91C1C',
  },
});
