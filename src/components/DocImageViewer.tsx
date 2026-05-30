import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, Modal,
  StyleSheet, Platform, ScrollView, useWindowDimensions, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isDisplayableDocUrl } from '@features/workers/services/documentUploadService';
import { M3, SPACING, BORDER_RADIUS, CARD_ELEVATION } from '@constants/stitchStyles';

interface DocImageViewerProps {
  url: string | null;
  label: string;
  boxStyle?: object;
}

export const DocImageViewer: React.FC<DocImageViewerProps> = ({ url, label, boxStyle }) => {
  const [failed, setFailed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const { width } = useWindowDimensions();
  const safeUrl = isDisplayableDocUrl(url) && !failed ? url : null;

  const openExternal = () => {
    if (!safeUrl) return;
    if (Platform.OS === 'web') {
      if (safeUrl.startsWith('data:')) {
        setModalOpen(true);
        return;
      }
      window.open(safeUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    Linking.openURL(safeUrl).catch(() => setModalOpen(true));
  };

  if (!safeUrl) {
    return (
      <View style={[styles.emptyBox, boxStyle]}>
        <Ionicons name="image-outline" size={32} color={M3.outline} />
        <Text style={styles.emptyLabel}>Sin documento</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity onPress={openExternal} activeOpacity={0.85}>
        <Image
          source={{ uri: safeUrl }}
          style={[styles.preview, boxStyle]}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
        <Text style={styles.hint}>{label} — toca para ver ↗</Text>
      </TouchableOpacity>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: Math.min(width - 32, 480) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={M3.onBackground} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Image
                source={{ uri: safeUrl }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  emptyBox: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainer,
    borderWidth: 1,
    borderColor: M3.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLabel: {
    color: M3.outline,
    fontSize: 12,
    marginTop: 4,
  },
  preview: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: M3.surfaceContainer,
    borderWidth: 1,
    borderColor: M3.outlineVariant,
  },
  hint: {
    color: M3.outline,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,28,48,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  modalCard: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: M3.surfaceContainerLowest,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...CARD_ELEVATION,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: M3.surfaceVariant,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: M3.onBackground,
    flex: 1,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: M3.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: 360,
  },
});
