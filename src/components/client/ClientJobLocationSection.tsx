import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChambaFormField } from '@components/chamba/ChambaFormField';
import {
  captureClientJobLocation,
  formatCoordsPreview,
  hasUsableJobCoordinates,
} from '@utils/shareJobLocation';
import { CARD_STEP_SHADOW, CHAMBA } from '@constants/chambaUI';

interface ClientJobLocationSectionProps {
  address: string;
  onAddressChange: (value: string) => void;
  lat: number | null;
  lng: number | null;
  onCoordsChange: (lat: number | null, lng: number | null) => void;
  disabled?: boolean;
}

export const ClientJobLocationSection: React.FC<ClientJobLocationSectionProps> = ({
  address,
  onAddressChange,
  lat,
  lng,
  onCoordsChange,
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coordsReady = hasUsableJobCoordinates(lat, lng);

  const handleShareLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { lat: newLat, lng: newLng, addressHint } = await captureClientJobLocation();
      onCoordsChange(newLat, newLng);
      if (addressHint && !address.trim()) {
        onAddressChange(addressHint);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo obtener tu ubicación. Podés seguir solo con la dirección escrita.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [address, onAddressChange, onCoordsChange]);

  const handleClearGps = useCallback(() => {
    onCoordsChange(null, null);
    setError(null);
  }, [onCoordsChange]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>Dónde se realizará el servicio</Text>
      <Text style={styles.sectionHint}>
        Escribí la dirección o referencia del lugar (obligatorio). El GPS es opcional — útil si
        estás en el sitio; si pedís el servicio para otra casa o negocio, solo la dirección alcanza.
      </Text>

      <ChambaFormField
        label="Dirección o referencia"
        value={address}
        onChangeText={onAddressChange}
        placeholder="Ej. Colonia Los Robles, de la UCA 3c al sur, casa #12"
        icon="location-outline"
        editable={!disabled}
      />

      <Text style={styles.optionalLabel}>Ubicación GPS (opcional)</Text>

      <TouchableOpacity
        style={[
          styles.shareBtn,
          coordsReady && styles.shareBtnDone,
          (disabled || loading) && styles.shareBtnDisabled,
        ]}
        onPress={handleShareLocation}
        disabled={disabled || loading}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Compartir ubicación GPS actual"
      >
        {loading ? (
          <ActivityIndicator color={coordsReady ? '#15803D' : CHAMBA.blue} />
        ) : (
          <Ionicons
            name={coordsReady ? 'checkmark-circle' : 'navigate'}
            size={22}
            color={coordsReady ? '#15803D' : CHAMBA.blue}
          />
        )}
        <View style={styles.shareTextCol}>
          <Text style={[styles.shareTitle, coordsReady && styles.shareTitleDone]}>
            {coordsReady ? 'GPS compartido' : 'Compartir mi ubicación actual'}
          </Text>
          <Text style={styles.shareSub}>
            {coordsReady && lat != null && lng != null
              ? `Punto en mapa: ${formatCoordsPreview(lat, lng)}`
              : Platform.OS === 'web'
                ? 'El navegador puede pedir permiso — no es obligatorio'
                : 'Ayuda al técnico a abrir mapas si querés'}
          </Text>
        </View>
        {!loading && (
          <Ionicons name="chevron-forward" size={18} color={CHAMBA.muted} />
        )}
      </TouchableOpacity>

      {coordsReady ? (
        <TouchableOpacity
          onPress={handleClearGps}
          disabled={disabled}
          style={styles.clearGps}
          accessibilityRole="button"
          accessibilityLabel="Quitar ubicación GPS"
        >
          <Text style={styles.clearGpsText}>Quitar GPS — solo usar dirección escrita</Text>
        </TouchableOpacity>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: CHAMBA.navy,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: CHAMBA.muted,
    lineHeight: 18,
    marginBottom: 12,
  },
  optionalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: CHAMBA.muted,
    marginTop: 4,
    marginBottom: 8,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
    marginBottom: 6,
    ...CARD_STEP_SHADOW,
  },
  shareBtnDone: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  shareBtnDisabled: { opacity: 0.65 },
  shareTextCol: { flex: 1, gap: 2 },
  shareTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CHAMBA.navy,
  },
  shareTitleDone: { color: '#15803D' },
  shareSub: {
    fontSize: 12,
    color: CHAMBA.muted,
    lineHeight: 16,
  },
  clearGps: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingVertical: 4,
  },
  clearGpsText: {
    fontSize: 12,
    fontWeight: '600',
    color: CHAMBA.blue,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
