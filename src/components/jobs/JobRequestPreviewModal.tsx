import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { M3, SPACING, BORDER_RADIUS } from '@constants/stitchStyles';
import { getCategoryLabel } from '@utils/formatters';
import type { JobCategory } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  category: JobCategory;
  photoUrl: string;
}

export const JobRequestPreviewModal: React.FC<Props> = ({
  visible,
  onClose,
  title,
  description,
  category,
  photoUrl,
}) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: insets.top + SPACING.sm }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Detalle del servicio</Text>
            <Text style={styles.headerSub}>{getCategoryLabel(category)}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={24} color={M3.onSurface} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + SPACING.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.jobTitle}>{title}</Text>

          {!imageFailed ? (
            <Image
              source={{ uri: photoUrl }}
              style={[styles.photo, { maxWidth: width - SPACING.md * 2 }]}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={styles.photoFallback}>
              <Ionicons name="image-outline" size={40} color={M3.outline} />
              <Text style={styles.photoFallbackText}>No se pudo cargar la imagen</Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>Descripción del cliente</Text>
          <Text style={styles.description}>{description}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: M3.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: M3.outlineVariant,
  },
  headerText: { flex: 1, paddingRight: SPACING.sm },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: M3.onSurface,
  },
  headerSub: {
    fontSize: 13,
    color: M3.outline,
    marginTop: 2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: M3.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  jobTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: M3.onSurface,
  },
  photo: {
    width: '100%',
    height: 280,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: M3.surfaceContainerHigh,
  },
  photoFallback: {
    height: 200,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: M3.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoFallbackText: {
    fontSize: 13,
    color: M3.outline,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: M3.outline,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: M3.onSurface,
  },
});
