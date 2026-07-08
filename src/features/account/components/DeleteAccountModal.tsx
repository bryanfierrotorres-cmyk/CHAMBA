import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { deleteOwnAccount } from '@features/account/services/accountDeletionService';
import { LEGAL_LINKS, openLegalLink } from '@constants/legalLinks';

const CONFIRM_WORD = 'ELIMINAR';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * Pantalla-modal de eliminación de cuenta (requisito Google Play).
 * Se presenta a pantalla completa sobre el perfil; no requiere ruta de navegación.
 */
export const DeleteAccountModal: React.FC<Props> = ({ visible, onClose }) => {
  const signOut = useAuthStore((s) => s.signOut);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD && !deleting;

  const reset = () => {
    setConfirmText('');
    setError(null);
    setDeleting(false);
  };

  const handleClose = () => {
    if (deleting) return;
    reset();
    onClose();
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteOwnAccount();
      // Éxito: cerrar sesión → RootNavigator vuelve al login automáticamente.
      await signOut();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo eliminar la cuenta.';
      setError(
        `${msg}\n\nSi el problema persiste, podés solicitar la eliminación por correo desde la página de ayuda.`,
      );
      setDeleting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : undefined}
      onRequestClose={handleClose}
      transparent={false}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} disabled={deleting} hitSlop={12}>
            <Ionicons name="close" size={26} color={deleting ? '#94A3B8' : '#0F172A'} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Eliminar cuenta</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.iconWrap}>
            <Ionicons name="warning" size={40} color="#DC2626" />
          </View>

          <Text style={styles.title}>Esta acción es permanente</Text>
          <Text style={styles.paragraph}>
            Si eliminás tu cuenta, se borrarán de forma definitiva:
          </Text>

          <View style={styles.list}>
            {[
              'Tu perfil: nombre, teléfono y correo',
              'Tu foto de perfil',
              'Tus documentos de verificación (si sos técnico)',
              'Tu reputación, reseñas e historial',
            ].map((item) => (
              <View key={item} style={styles.listItem}>
                <Ionicons name="close-circle" size={18} color="#DC2626" />
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.paragraph}>
            No podrás recuperar esta información. Para continuar, escribí{' '}
            <Text style={styles.bold}>{CONFIRM_WORD}</Text> en el campo de abajo.
          </Text>

          <TextInput
            style={styles.input}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={CONFIRM_WORD}
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!deleting}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.deleteBtn, !canDelete && styles.deleteBtnDisabled]}
            onPress={handleDelete}
            disabled={!canDelete}
            activeOpacity={0.85}
          >
            {deleting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.deleteBtnText}>Eliminar mi cuenta</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={deleting}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.helpLink}
            onPress={() => openLegalLink(LEGAL_LINKS.accountDeletion)}
          >
            <Text style={styles.helpLinkText}>¿Preferís solicitarlo por correo? Ver ayuda</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  body: { padding: 24, gap: 16 },
  iconWrap: {
    alignSelf: 'center',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  paragraph: { fontSize: 15, color: '#475569', lineHeight: 22 },
  bold: { fontWeight: '800', color: '#DC2626' },
  list: { gap: 10, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listText: { flex: 1, fontSize: 14, color: '#334155' },
  input: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#0F172A',
    textAlign: 'center',
  },
  errorText: { color: '#DC2626', fontSize: 13, lineHeight: 19 },
  deleteBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  deleteBtnDisabled: { backgroundColor: '#FCA5A5' },
  deleteBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  cancelBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#475569', fontSize: 15, fontWeight: '600' },
  helpLink: { paddingVertical: 8, alignItems: 'center' },
  helpLinkText: { color: '#0284C7', fontSize: 13, fontWeight: '600' },
});
