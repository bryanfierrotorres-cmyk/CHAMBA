import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { ChambaScreenHeader } from '@components/chamba/ChambaScreenHeader';
import { Button } from '@components/Button';
import { CARD_STEP_SHADOW, CHAMBA, chambaStyles } from '@constants/chambaUI';
import { showMessage } from '@utils/confirmAction';
import { useAdminHomeBanners } from '../hooks/useAdminHomeBanners';
import type { AdminProfileStackParamList } from '@/types';
import type { HomeBanner } from '../types';

type Nav = NativeStackNavigationProp<AdminProfileStackParamList, 'ManageHomeBanners'>;

const confirmDelete = async (onConfirm: () => void): Promise<void> => {
  if (Platform.OS === 'web') {
    if (window.confirm('¿Eliminar este banner? Se borrará la imagen del servidor.')) {
      onConfirm();
    }
    return;
  }
  Alert.alert(
    'Eliminar banner',
    '¿Eliminar este banner? Se borrará la imagen del servidor.',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: onConfirm },
    ],
  );
};

const BannerRow: React.FC<{
  banner: HomeBanner;
  toggling: boolean;
  removing: boolean;
  onToggle: (id: string, value: boolean) => void;
  onDelete: (banner: HomeBanner) => void;
}> = ({ banner, toggling, removing, onToggle, onDelete }) => (
  <View style={styles.card}>
    <Image source={{ uri: banner.image_url }} style={styles.thumb} resizeMode="cover" />
    <View style={styles.cardBody}>
      <Text style={styles.cardMeta}>Orden {banner.display_order}</Text>
      <View style={styles.row}>
        <Text style={styles.switchLabel}>Activo</Text>
        <Switch
          value={banner.is_active}
          onValueChange={(v) => onToggle(banner.id, v)}
          disabled={toggling || removing}
          trackColor={{ false: CHAMBA.border, true: CHAMBA.cyan }}
          thumbColor={CHAMBA.white}
        />
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => void confirmDelete(() => onDelete(banner))}
        disabled={removing}
        activeOpacity={0.85}
      >
        {removing ? (
          <ActivityIndicator size="small" color="#FF453A" />
        ) : (
          <>
            <Ionicons name="trash-outline" size={18} color="#FF453A" />
            <Text style={styles.deleteText}>Eliminar</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  </View>
);

export const ManageHomeBannersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [picking, setPicking] = useState(false);
  const {
    banners,
    isLoading,
    uploadBanner,
    isUploading,
    toggleActive,
    togglingId,
    removeBanner,
    removingId,
    isRefetching,
  } = useAdminHomeBanners();

  const handleUpload = async () => {
    if (isUploading || picking) return;
    setPicking(true);
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          showMessage('Permiso requerido', 'Necesitamos acceso a tus fotos para subir el banner.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      await uploadBanner(result.assets[0].uri);
      showMessage('Banner publicado', 'El banner ya está visible en el inicio del cliente.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo subir el banner';
      showMessage('Error', msg);
    } finally {
      setPicking(false);
    }
  };

  const handleToggle = async (id: string, value: boolean) => {
    try {
      await toggleActive({ id, isActive: value });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo actualizar';
      showMessage('Error', msg);
    }
  };

  const handleDelete = async (banner: HomeBanner) => {
    try {
      await removeBanner(banner);
      showMessage('Eliminado', 'Banner removido del inicio.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo eliminar';
      showMessage('Error', msg);
    }
  };

  return (
    <SafeAreaView style={chambaStyles.screen} edges={['top']}>
      <ChambaScreenHeader
        title="Banners de inicio"
        subtitle="Slider informativo del cliente"
        right={(
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="close" size={26} color={CHAMBA.navy} />
          </TouchableOpacity>
        )}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.hint}>
          Subí imágenes promocionales. Solo los banners activos aparecen en el inicio del cliente.
        </Text>

        <Button
          label={isUploading || picking ? 'Subiendo…' : 'Subir nuevo banner'}
          onPress={() => void handleUpload()}
          isLoading={isUploading || picking}
          style={styles.uploadBtn}
        />

        {isLoading ? (
          <ActivityIndicator size="large" color={CHAMBA.blue} style={{ marginTop: 32 }} />
        ) : banners.length === 0 ? (
          <Text style={styles.empty}>No hay banners todavía.</Text>
        ) : (
          banners.map((banner) => (
            <BannerRow
              key={banner.id}
              banner={banner}
              toggling={togglingId === banner.id}
              removing={removingId === banner.id}
              onToggle={(id, v) => void handleToggle(id, v)}
              onDelete={(b) => void handleDelete(b)}
            />
          ))
        )}

        {isRefetching && (
          <ActivityIndicator size="small" color={CHAMBA.muted} style={{ marginTop: 16 }} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  hint: {
    fontSize: 14,
    color: CHAMBA.muted,
    lineHeight: 20,
    marginBottom: 16,
  },
  uploadBtn: { marginBottom: 20 },
  empty: {
    textAlign: 'center',
    color: CHAMBA.muted,
    marginTop: 40,
    fontSize: 15,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: CHAMBA.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    ...CARD_STEP_SHADOW,
  },
  thumb: {
    width: 120,
    height: 90,
    backgroundColor: CHAMBA.border,
  },
  cardBody: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    gap: 6,
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: CHAMBA.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: CHAMBA.navy,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF453A',
  },
});
