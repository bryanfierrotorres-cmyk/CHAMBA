import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { M3, SPACING, BORDER_RADIUS, CARD_ELEVATION } from '@constants/stitchStyles';
import { useUploadJobWorkPhoto } from '@features/jobs/hooks/useJobWorkPhotos';
import type { Job } from '@/types';

interface Props {
  job: Pick<Job, 'id' | 'before_photo_url' | 'after_photo_url'>;
  workerId: string;
  readOnly?: boolean;
}

type SlotKind = 'before' | 'after';

const SLOT_META: Record<SlotKind, { label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }> = {
  before: { label: 'Antes', sub: 'Estado inicial', icon: 'image-outline' },
  after:  { label: 'Después', sub: 'Trabajo terminado', icon: 'sparkles-outline' },
};

const PhotoSlot: React.FC<{
  kind: SlotKind;
  uri?: string | null;
  readOnly?: boolean;
  uploading?: boolean;
  onPick: () => void;
}> = ({ kind, uri, readOnly, uploading, onPick }) => {
  const meta = SLOT_META[kind];

  return (
    <TouchableOpacity
      style={styles.slot}
      onPress={readOnly ? undefined : onPick}
      disabled={readOnly || uploading}
      activeOpacity={readOnly ? 1 : 0.85}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.slotImage} resizeMode="cover" />
      ) : (
        <View style={styles.slotPlaceholder}>
          <Ionicons name={meta.icon} size={28} color={M3.primary} />
          <Text style={styles.slotPlaceholderText}>
            {readOnly ? 'Sin foto' : 'Subir foto'}
          </Text>
        </View>
      )}
      <View style={styles.slotLabelWrap}>
        <Text style={styles.slotLabel}>{meta.label}</Text>
        <Text style={styles.slotSub}>{meta.sub}</Text>
      </View>
      {uploading && (
        <View style={styles.slotLoading}>
          <ActivityIndicator color="#FFF" />
        </View>
      )}
      {!readOnly && uri && !uploading && (
        <View style={styles.changeBadge}>
          <Ionicons name="camera" size={14} color="#FFF" />
        </View>
      )}
    </TouchableOpacity>
  );
};

export const JobBeforeAfterUpload: React.FC<Props> = ({
  job,
  workerId,
  readOnly = false,
}) => {
  const { mutateAsync: upload, isPending } = useUploadJobWorkPhoto(job.id, workerId);
  const [uploadingKind, setUploadingKind] = useState<SlotKind | null>(null);
  const [beforeUrl, setBeforeUrl] = useState(job.before_photo_url ?? null);
  const [afterUrl, setAfterUrl] = useState(job.after_photo_url ?? null);

  useEffect(() => {
    setBeforeUrl(job.before_photo_url ?? null);
    setAfterUrl(job.after_photo_url ?? null);
  }, [job.before_photo_url, job.after_photo_url]);

  const pickAndUpload = async (kind: SlotKind) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.75,
      aspect: [4, 3],
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    setUploadingKind(kind);
    try {
      const updated = await upload({ localUri: result.assets[0].uri, kind });
      setBeforeUrl(updated.before_photo_url ?? null);
      setAfterUrl(updated.after_photo_url ?? null);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'No se pudo subir la foto',
      );
    } finally {
      setUploadingKind(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Fotos del trabajo</Text>
      <Text style={styles.hint}>
        {readOnly
          ? 'El técnico documentó el servicio con estas imágenes.'
          : 'Subí una foto del antes y del después para que el cliente vea tu trabajo.'}
      </Text>
      <View style={styles.row}>
        <PhotoSlot
          kind="before"
          uri={beforeUrl}
          readOnly={readOnly}
          uploading={uploadingKind === 'before' && isPending}
          onPick={() => { void pickAndUpload('before'); }}
        />
        <PhotoSlot
          kind="after"
          uri={afterUrl}
          readOnly={readOnly}
          uploading={uploadingKind === 'after' && isPending}
          onPick={() => { void pickAndUpload('after'); }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: SPACING.sm,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: M3.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 13,
    color: M3.onSurfaceVariant,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.sm + 4,
  },
  slot: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: M3.surfaceContainerLow,
    borderWidth: 1,
    borderColor: M3.outlineVariant,
    minHeight: 140,
    ...CARD_ELEVATION,
  },
  slotImage: {
    width: '100%',
    height: 120,
  },
  slotPlaceholder: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: M3.primaryContainer,
  },
  slotPlaceholderText: {
    fontSize: 12,
    fontWeight: '600',
    color: M3.onPrimaryContainer,
  },
  slotLabelWrap: {
    padding: SPACING.sm,
    gap: 2,
  },
  slotLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: M3.onBackground,
  },
  slotSub: {
    fontSize: 11,
    color: M3.onSurfaceVariant,
  },
  slotLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: M3.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
