import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@components/Avatar';
import { CHAMBA } from '@constants/chambaUI';
import { fetchApplicantProfileExtras } from '@features/client/services/clientApplicantProfileService';
import { formatApplicantDistanceLabel } from '@utils/geoDistance';
import { formatRatingAvg, getCategoryLabel } from '@utils/formatters';
import { resolveApplicantDistanceKm, type JobCoords } from '@utils/applicantDistance';
import { summarizeWorkerTrust } from '@utils/workerTrustSummary';
import type { JobWorkerApplication } from '@/types';

interface WorkerApplicantProfileModalProps {
  visible: boolean;
  application: JobWorkerApplication | null;
  jobCoords?: JobCoords | null;
  onClose: () => void;
}

export const WorkerApplicantProfileModal: React.FC<WorkerApplicantProfileModalProps> = ({
  visible,
  application,
  jobCoords,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [bio, setBio] = useState<string | null>(null);
  const [bioLoading, setBioLoading] = useState(false);

  useEffect(() => {
    if (!visible || !application?.worker_id) {
      setBio(null);
      setBioLoading(false);
      return;
    }

    const rpcBio = application.bio?.trim();
    if (rpcBio) {
      setBio(rpcBio);
      setBioLoading(false);
      return;
    }

    let cancelled = false;
    setBioLoading(true);

    void fetchApplicantProfileExtras(application.worker_id)
      .then(({ bio: fetchedBio }) => {
        if (!cancelled) setBio(fetchedBio);
      })
      .finally(() => {
        if (!cancelled) setBioLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, application?.worker_id, application?.bio]);

  const trust = useMemo(
    () => (application ? summarizeWorkerTrust(application) : null),
    [application],
  );

  const specialties = useMemo(() => {
    if (!application) return [];
    return [application.category_1, application.category_2]
      .filter(Boolean)
      .map((slug) => getCategoryLabel(slug as string));
  }, [application]);

  const distanceKm = useMemo(() => {
    if (!application) return null;
    return resolveApplicantDistanceKm(application, jobCoords);
  }, [application, jobCoords]);

  if (!application) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Perfil del técnico</Text>
            <Text style={styles.headerSub}>Información para comparar postulantes</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={CHAMBA.navy} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Avatar uri={application.avatar_url} name={application.full_name} size={88} />
            <Text style={styles.name}>{application.full_name}</Text>

            {(trust?.starLabel || trust?.jobsLabel) && (
              <View style={styles.trustRow}>
                {trust.starLabel ? (
                  <View style={styles.trustChip}>
                    <Text style={styles.trustChipText}>
                      {formatRatingAvg(application.rating_avg) !== '—' && Number(application.rating_avg) > 0
                        ? `⭐ ${formatRatingAvg(application.rating_avg)}`
                        : '✨ Primera Chamba'}
                    </Text>
                  </View>
                ) : null}
                {trust.jobsLabel ? (
                  <View style={[styles.trustChip, trust.isNew && styles.trustChipNew]}>
                    <Text style={[styles.trustChipText, trust.isNew && styles.trustChipTextNew]}>
                      {trust.jobsLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Especialidades</Text>
            {specialties.length > 0 ? (
              <View style={styles.chipRow}>
                {specialties.map((label) => (
                  <View key={label} style={styles.chip}>
                    <Text style={styles.chipText}>{label}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.placeholder}>Sin especialidades registradas</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Sobre mí</Text>
            {bioLoading ? (
              <ActivityIndicator color={CHAMBA.blue} style={styles.bioLoader} />
            ) : bio ? (
              <Text style={styles.bioText}>{bio}</Text>
            ) : (
              <Text style={styles.placeholder}>
                Este técnico aún no agregó una descripción en su perfil.
              </Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Distancia al servicio</Text>
            <View style={styles.distanceRow}>
              <Ionicons name="navigate-outline" size={18} color={CHAMBA.blue} />
              {distanceKm != null ? (
                <Text style={styles.distanceText}>
                  {formatApplicantDistanceLabel(distanceKm)}
                </Text>
              ) : (
                <Text style={styles.placeholder}>
                  No disponible — faltan coordenadas del servicio o del técnico
                </Text>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CHAMBA.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: CHAMBA.border,
    backgroundColor: CHAMBA.white,
  },
  headerText: { flex: 1, paddingRight: 12 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: CHAMBA.navy,
  },
  headerSub: {
    marginTop: 2,
    fontSize: 12,
    color: CHAMBA.muted,
    lineHeight: 17,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CHAMBA.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 18,
  },
  hero: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: CHAMBA.navy,
    textAlign: 'center',
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  trustChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: CHAMBA.border,
  },
  trustChipNew: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  trustChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: CHAMBA.navy,
  },
  trustChipTextNew: {
    color: '#1E40AF',
  },
  section: {
    backgroundColor: CHAMBA.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: CHAMBA.border,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: CHAMBA.muted,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: CHAMBA.border,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: CHAMBA.navy,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 22,
    color: CHAMBA.navy,
  },
  bioLoader: {
    alignSelf: 'flex-start',
  },
  placeholder: {
    fontSize: 13,
    lineHeight: 20,
    color: CHAMBA.muted,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  distanceText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: CHAMBA.navy,
    lineHeight: 20,
  },
});
