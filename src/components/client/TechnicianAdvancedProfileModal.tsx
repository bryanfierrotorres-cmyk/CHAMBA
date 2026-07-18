import React, { forwardRef, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@components/Avatar';
import { supabase } from '@services/supabase';
import type { JobWorkerApplication, WorkerReview, WorkerReviewsStats, TechnicianPortfolioItem, WorkerProfile } from '@/types';

/** Calcula "hace X minutos / horas / días" sin dependencia externa. */
const timeAgo = (date: Date): string => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
};

interface Props {
  application: JobWorkerApplication | null;
  onConfirm: (app: JobWorkerApplication) => void;
  onDismiss: () => void;
}

/**
 * REGLAS DEL ADMINISTRADOR PARA OTORGAR EL "SELLO CHAMBA" (id_verified = true)
 * - Identidad/Cédula confirmada.
 * - Foto de frente real y clara.
 * - Teléfono verificado.
 * - Mínimo 10 chambas completadas reales.
 * - Calificación promedio superior a 4.5 estrellas.
 * - Cero reportes de gravedad en su contra.
 */

export const TechnicianAdvancedProfileModal = forwardRef<BottomSheetModal, Props>(
  ({ application, onConfirm, onDismiss }, ref) => {
    const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
    const [reviewsStats, setReviewsStats] = useState<WorkerReviewsStats | null>(null);
    const [reviews, setReviews] = useState<WorkerReview[]>([]);
    const [portfolio, setPortfolio] = useState<TechnicianPortfolioItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'reputacion' | 'galeria'>('reputacion');

    const snapPoints = React.useMemo(() => ['85%'], []);

    useEffect(() => {
      if (!application) return;

      const loadProfileData = async () => {
        setLoading(true);
        try {
          // 1. Fetch exact worker profile for id_verified and last_location_at
          const { data: wp } = await supabase
            .from('worker_profiles')
            .select('*')
            .eq('worker_id', application.worker_id)
            .single();
          
          if (wp) setWorkerProfile(wp as WorkerProfile);

          // 2. Fetch stats
          const { data: stats } = await supabase.rpc('get_worker_reviews_stats', {
            p_worker_id: application.worker_id,
          });
          if (stats) setReviewsStats(stats as WorkerReviewsStats);

          // 3. Fetch reviews
          const { data: revs } = await supabase.rpc('get_worker_reviews', {
            p_worker_id: application.worker_id,
          });
          if (revs) setReviews(revs as WorkerReview[]);

          // 4. Fetch portfolio
          const { data: ports } = await supabase
            .from('technician_portfolio')
            .select('*')
            .eq('worker_id', application.worker_id)
            .order('created_at', { ascending: false });
          if (ports) setPortfolio(ports as TechnicianPortfolioItem[]);

        } catch (error) {
          console.error('Error loading technician data:', error);
        } finally {
          setLoading(false);
        }
      };

      loadProfileData();
    }, [application]);

    const renderBackdrop = useCallback(
      (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />,
      []
    );

    const getLastActivityText = () => {
      if (!workerProfile?.last_location_at) return 'Desconectado';
      
      const lastActivity = new Date(workerProfile.last_location_at);
      const diffMins = (new Date().getTime() - lastActivity.getTime()) / 60000;
      
      if (diffMins <= 5) {
        return '🟢 Disponible ahora';
      }
      return `⏱️ Activo ${timeAgo(lastActivity)}`;
    };

    // El BottomSheetModal SIEMPRE se renderiza para que el ref quede registrado.
    // El contenido se muestra condicionalmente cuando hay una application activa.
    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        onDismiss={onDismiss}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.indicator}
      >
        {!application ? (
          <BottomSheetView style={styles.placeholderView}>
            <View />
          </BottomSheetView>
        ) : (
          <>
            <BottomSheetView style={styles.header}>
              <Avatar uri={application.avatar_url} name={application.full_name} size={90} />
              <Text style={styles.name}>{application.full_name}</Text>
              <Text style={styles.categories}>
                {application.category_1} {application.category_2 && `• ${application.category_2}`}
              </Text>

              {workerProfile?.id_verified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>🛡️ Sello Chamba: Técnico Verificado</Text>
                </View>
              )}

              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {reviewsStats?.rating_avg && reviewsStats.rating_avg > 0
                      ? `⭐ ${reviewsStats.rating_avg}`
                      : '✨ Primera Chamba'}
                  </Text>
                  <Text style={styles.statLabel}>
                    {reviewsStats?.total_reviews || 0} reseñas
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    💼 {workerProfile?.total_jobs_done || 0}
                  </Text>
                  <Text style={styles.statLabel}>Chambas Completadas</Text>
                </View>
              </View>
            </BottomSheetView>

            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'reputacion' && styles.tabBtnActive]}
                onPress={() => setActiveTab('reputacion')}
              >
                <Text style={[styles.tabText, activeTab === 'reputacion' && styles.tabTextActive]}>
                  Reputación
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'galeria' && styles.tabBtnActive]}
                onPress={() => setActiveTab('galeria')}
              >
                <Text style={[styles.tabText, activeTab === 'galeria' && styles.tabTextActive]}>
                  Galería
                </Text>
              </TouchableOpacity>
            </View>

            <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
              {loading ? (
                <ActivityIndicator style={{ marginTop: 40 }} color="#059669" />
              ) : activeTab === 'reputacion' ? (
                reviews.length > 0 ? (
                  reviews.map((r) => (
                    <View key={r.id} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <Text style={styles.reviewerName}>{r.reviewer?.full_name || 'Cliente'}</Text>
                        <Text style={styles.reviewDate}>
                          {timeAgo(new Date(r.created_at))}
                        </Text>
                      </View>
                      <View style={styles.starsRow}>
                        {Array.from({ length: r.rating }).map((_, i) => (
                          <Ionicons key={i} name="star" size={14} color="#F59E0B" />
                        ))}
                      </View>
                      <Text style={styles.reviewComment}>{r.comment}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>Este técnico aún no tiene reseñas.</Text>
                )
              ) : (
                portfolio.length > 0 ? (
                  portfolio.map((p) => (
                    <View key={p.id} style={styles.portfolioCard}>
                      <Text style={styles.emptyText}>Imagen Antes/Después no implementada en UI aún.</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>Este técnico no ha subido fotos a su galería.</Text>
                )
              )}
            </BottomSheetScrollView>

            <View style={styles.footer}>
              <Text style={styles.activityText}>{getLastActivityText()}</Text>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => onConfirm(application)}
              >
                <Text style={styles.confirmBtnText}>Confirmar y Contratar Técnico</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  placeholderView: {
    height: 1,
  },
  indicator: {
    backgroundColor: '#CBD5E1',
    width: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  categories: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  verifiedText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 24,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#059669',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
  },
  reviewCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  reviewDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  reviewComment: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  portfolioCard: {
    backgroundColor: '#E2E8F0',
    height: 120,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 30,
    fontSize: 15,
  },
  footer: {
    backgroundColor: '#FFF',
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  activityText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
  },
  confirmBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
