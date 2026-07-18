import React from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { FloatingRadarHeader } from './FloatingRadarHeader';
import { RadarStatsBar } from './RadarStatsBar';
import { RadarRadiusBar } from './RadarRadiusBar';
import { RADAR_HORIZONTAL } from './radarTheme';

interface RadarTopPanelProps {
  topInset: number;
  avatarUri?: string | null;
  fullName?: string | null;
  isOnline: boolean;
  onToggleOnline: (next: boolean) => void;
  isToggling?: boolean;
  ratingLabel: string;
  earningsTodayCents: number;
  jobsToday: number;
  radiusKm: number;
  onChangeRadiusKm: (km: number) => void;
  onLayoutHeight: (height: number) => void;
  /** Reporta la Y absoluta (en pantalla) del borde superior de la barra de radio. */
  onRadiusBarTop?: (absoluteTop: number) => void;
}

/** Agrupa saludo/toggle + stats + radio de búsqueda en un solo bloque flotante medido. */
export const RadarTopPanel: React.FC<RadarTopPanelProps> = ({
  topInset,
  avatarUri,
  fullName,
  isOnline,
  onToggleOnline,
  isToggling,
  ratingLabel,
  earningsTodayCents,
  jobsToday,
  radiusKm,
  onChangeRadiusKm,
  onLayoutHeight,
  onRadiusBarTop,
}) => {
  const handleLayout = (e: LayoutChangeEvent) => {
    onLayoutHeight(e.nativeEvent.layout.height);
  };

  const handleRadiusBarLayout = (e: LayoutChangeEvent) => {
    onRadiusBarTop?.(topInset + 8 + e.nativeEvent.layout.y);
  };

  return (
    <View style={[styles.wrap, { top: topInset + 8 }]} onLayout={handleLayout}>
      <FloatingRadarHeader
        avatarUri={avatarUri}
        fullName={fullName}
        isOnline={isOnline}
        onToggleOnline={onToggleOnline}
        isToggling={isToggling}
      />
      <RadarStatsBar
        ratingLabel={ratingLabel}
        earningsTodayCents={earningsTodayCents}
        jobsToday={jobsToday}
        radiusKm={radiusKm}
      />
      <View onLayout={handleRadiusBarLayout}>
        <RadarRadiusBar radiusKm={radiusKm} onChange={onChangeRadiusKm} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: RADAR_HORIZONTAL,
    right: RADAR_HORIZONTAL,
    zIndex: 10,
    gap: 10,
  },
});
