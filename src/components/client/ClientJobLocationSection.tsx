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
  onCoordsChange: (lat: number, lng: number) => void;
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
          : 'No se pudo obtener tu ubicación. Revisá permisos o intentá de nuevo.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [address, onAddressChange, onCoordsChange]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>Ubicación del servicio</Text>
      <Text style={styles.sectionHint}>
        Compartí tu ubicación para que el técnico pueda guiarse con mapas hasta tu casa o negocio.
      </Text>

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
        accessibilityLabel="Compartir mi ubicación actual"
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
            {coordsReady ? 'Ubicación compartida' : 'Compartir mi ubicación actual'}
          </Text>
          <Text style={styles.shareSub}>
            {coordsReady && lat != null && lng != null
              ? `GPS: ${formatCoordsPreview(lat, lng)}`
              : Platform.OS === 'web'
                ? 'El navegador pedirá permiso de ubicación'
                : 'Usamos GPS para marcar el punto en el mapa del técnico'}
          </Text>
        </View>
        {!loading && (
          <Ionicons name="chevron-forward" size={18} color={CHAMBA.muted} />
        )}
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!coordsReady ? (
        <Text style={styles.requiredHint}>
          Tocá el botón de arriba antes de enviar — es necesario para que el técnico llegue.
        </Text>
      ) : null}

      <ChambaFormField
        label="Dirección o referencia"
        value={address}
        onChangeText={onAddressChange}
        placeholder="Ej. Semáforos de Rubenia, 2c al norte, portón verde"
        icon="location-outline"
        editable={!disabled}
      />
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
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
    marginBottom: 10,
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
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  requiredHint: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600',
    marginBottom: 10,
  },
});
